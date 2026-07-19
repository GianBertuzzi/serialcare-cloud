const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseMoney(value, fieldName, res) {
  const numberValue = value === undefined || value === null || value === "" ? 0 : Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    res.status(400).json({ error: `${fieldName} debe ser numero mayor o igual a 0` });
    return null;
  }

  return Math.round(numberValue);
}

function parseNonNegativeInteger(value, fieldName, res, defaultValue = 0) {
  const numberValue = value === undefined || value === null || value === "" ? defaultValue : Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    res.status(400).json({ error: `${fieldName} debe ser numero entero mayor o igual a 0` });
    return null;
  }

  return numberValue;
}

function parsePositiveInteger(value, fieldName, res) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    res.status(400).json({ error: `${fieldName} debe ser numero entero mayor que 0` });
    return null;
  }

  return numberValue;
}

function getStockStatus(stock, stockMinimo) {
  const currentStock = Number(stock || 0);
  const minimumStock = Number(stockMinimo || 0);

  if (currentStock === 0) return "AGOTADO";
  if (currentStock <= minimumStock) return "BAJO";
  return "NORMAL";
}

function serializeRepuesto(repuesto) {
  return {
    ...repuesto,
    estado_stock: getStockStatus(repuesto.stock, repuesto.stock_minimo)
  };
}

function getInvalidFields(body, allowedFields) {
  return Object.keys(body || {}).filter((field) => !allowedFields.has(field));
}

async function getUsuarioSucursal(idUsuario, queryable = db) {
  const result = await queryable.query(
    `SELECT u.id_sucursal, s.nombre AS nombre_sucursal
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

function requireSucursal(usuarioSucursal, res, rol = "usuario") {
  if (!usuarioSucursal?.id_sucursal) {
    res.status(400).json({ error: `El ${rol} no tiene sucursal asignada` });
    return false;
  }

  return true;
}

async function getRepuestoForUpdate(client, idRepuesto, idSucursal) {
  const result = await client.query(
    `SELECT id_repuesto, id_sucursal, codigo, nombre, marca, precio, stock, stock_minimo, estado, fecha_creacion
    FROM repuestos
    WHERE id_repuesto = $1
      AND id_sucursal = $2
    FOR UPDATE`,
    [idRepuesto, idSucursal]
  );

  return result.rows[0] || null;
}

router.get("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, req.usuario.rol)) {
      return;
    }

    const result = await db.query(
      `SELECT
        r.id_repuesto,
        r.id_sucursal,
        s.nombre AS nombre_sucursal,
        r.codigo,
        r.nombre,
        r.marca,
        r.precio,
        r.stock,
        r.stock_minimo,
        r.estado,
        r.fecha_creacion
      FROM repuestos r
      INNER JOIN sucursales s ON s.id_sucursal = r.id_sucursal
      WHERE r.id_sucursal = $1
      ORDER BY r.nombre ASC`,
      [usuarioSucursal.id_sucursal]
    );

    return res.json({ repuestos: result.rows.map(serializeRepuesto) });
  } catch (error) {
    console.error("Error listando repuestos:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN"), async (req, res) => {
  const allowedFields = new Set(["codigo", "nombre", "marca", "precio", "stock_inicial", "stock_minimo"]);
  const invalidFields = getInvalidFields(req.body, allowedFields);

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "stock")) {
    return res.status(400).json({ error: "Use stock_inicial al crear; stock no se acepta directamente" });
  }

  if (invalidFields.length > 0) {
    return res.status(400).json({ error: "Solo se permite enviar codigo, nombre, marca, precio, stock_inicial y stock_minimo" });
  }

  const codigo = clean(req.body?.codigo) || null;
  const nombre = clean(req.body?.nombre);
  const marca = clean(req.body?.marca) || null;

  if (!nombre) {
    return res.status(400).json({ error: "nombre es obligatorio" });
  }

  const precio = parseMoney(req.body?.precio, "precio", res);
  const stockInicial = parseNonNegativeInteger(req.body?.stock_inicial, "stock_inicial", res);
  const stockMinimo = parseNonNegativeInteger(req.body?.stock_minimo, "stock_minimo", res);

  if (precio === null || stockInicial === null || stockMinimo === null) {
    return;
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      await client.query("ROLLBACK");
      return;
    }

    const result = await client.query(
      `INSERT INTO repuestos (
        id_sucursal, codigo, nombre, marca, precio, stock, stock_minimo, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVO')
      RETURNING id_repuesto, id_sucursal, codigo, nombre, marca, precio, stock, stock_minimo, estado, fecha_creacion`,
      [usuarioSucursal.id_sucursal, codigo, nombre, marca, precio, stockInicial, stockMinimo]
    );

    let movimiento = null;

    if (stockInicial > 0) {
      const movimientoResult = await client.query(
        `INSERT INTO movimientos_inventario (
          id_repuesto, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
          motivo, id_usuario
        )
        VALUES ($1, 'ENTRADA', $2, 0, $2, $3, $4)
        RETURNING id_movimiento, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
          motivo, fecha_creacion`,
        [
          result.rows[0].id_repuesto,
          stockInicial,
          "Stock inicial al crear el repuesto",
          req.usuario.id_usuario
        ]
      );
      movimiento = movimientoResult.rows[0];
    }

    await client.query("COMMIT");
    return res.status(201).json({
      repuesto: serializeRepuesto(result.rows[0]),
      movimiento
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creando repuesto:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.put("/:id", verificarRol("ADMIN"), async (req, res) => {
  const idRepuesto = Number(req.params.id);
  const allowedFields = new Set(["codigo", "nombre", "precio", "stock_minimo", "estado"]);
  const invalidFields = getInvalidFields(req.body, allowedFields);

  if (!Number.isInteger(idRepuesto) || idRepuesto <= 0) {
    return res.status(400).json({ error: "id de repuesto no es valido" });
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "stock")) {
    return res.status(400).json({ error: "stock no puede modificarse directamente; use entrada o ajuste" });
  }

  if (invalidFields.length > 0) {
    return res.status(400).json({ error: "Solo se permite modificar codigo, nombre, precio, stock_minimo y estado" });
  }

  const hasCodigo = Object.prototype.hasOwnProperty.call(req.body || {}, "codigo");
  const hasNombre = Object.prototype.hasOwnProperty.call(req.body || {}, "nombre");
  const hasPrecio = Object.prototype.hasOwnProperty.call(req.body || {}, "precio");
  const hasStockMinimo = Object.prototype.hasOwnProperty.call(req.body || {}, "stock_minimo");
  const hasEstado = Object.prototype.hasOwnProperty.call(req.body || {}, "estado");

  if (!hasCodigo && !hasNombre && !hasPrecio && !hasStockMinimo && !hasEstado) {
    return res.status(400).json({ error: "Debe enviar al menos un campo permitido" });
  }

  const codigo = hasCodigo ? clean(req.body.codigo) || null : null;
  const nombre = hasNombre ? clean(req.body.nombre) : null;
  const estado = hasEstado ? clean(req.body.estado).toUpperCase() : null;

  if (hasNombre && !nombre) {
    return res.status(400).json({ error: "nombre no puede estar vacio" });
  }

  if (hasEstado && !["ACTIVO", "INACTIVO"].includes(estado)) {
    return res.status(400).json({ error: "estado debe ser ACTIVO o INACTIVO" });
  }

  const precio = hasPrecio ? parseMoney(req.body.precio, "precio", res) : null;
  const stockMinimo = hasStockMinimo
    ? parseNonNegativeInteger(req.body.stock_minimo, "stock_minimo", res)
    : null;

  if ((hasPrecio && precio === null) || (hasStockMinimo && stockMinimo === null)) {
    return;
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const result = await db.query(
      `UPDATE repuestos
      SET codigo = CASE WHEN $1 THEN $2 ELSE codigo END,
          nombre = CASE WHEN $3 THEN $4 ELSE nombre END,
          precio = CASE WHEN $5 THEN $6 ELSE precio END,
          stock_minimo = CASE WHEN $7 THEN $8 ELSE stock_minimo END,
          estado = CASE WHEN $9 THEN $10 ELSE estado END
      WHERE id_repuesto = $11
        AND id_sucursal = $12
      RETURNING id_repuesto, id_sucursal, codigo, nombre, marca, precio, stock, stock_minimo, estado, fecha_creacion`,
      [
        hasCodigo,
        codigo,
        hasNombre,
        nombre,
        hasPrecio,
        precio,
        hasStockMinimo,
        stockMinimo,
        hasEstado,
        estado,
        idRepuesto,
        usuarioSucursal.id_sucursal
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Repuesto no encontrado para la sucursal" });
    }

    return res.json({ repuesto: serializeRepuesto(result.rows[0]) });
  } catch (error) {
    console.error("Error actualizando repuesto:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/:id/entrada", verificarRol("ADMIN"), async (req, res) => {
  const idRepuesto = Number(req.params.id);
  const invalidFields = getInvalidFields(req.body, new Set(["cantidad", "motivo"]));
  const motivo = clean(req.body?.motivo);

  if (!Number.isInteger(idRepuesto) || idRepuesto <= 0) {
    return res.status(400).json({ error: "id de repuesto no es valido" });
  }

  if (invalidFields.length > 0) {
    return res.status(400).json({ error: "Solo se permite enviar cantidad y motivo" });
  }

  const cantidad = parsePositiveInteger(req.body?.cantidad, "cantidad", res);

  if (cantidad === null) return;

  if (!motivo) {
    return res.status(400).json({ error: "motivo es obligatorio" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      await client.query("ROLLBACK");
      return;
    }

    const repuesto = await getRepuestoForUpdate(client, idRepuesto, usuarioSucursal.id_sucursal);

    if (!repuesto) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Repuesto no encontrado para la sucursal" });
    }

    const stockAnterior = Number(repuesto.stock);
    const stockNuevo = stockAnterior + cantidad;
    const updateResult = await client.query(
      `UPDATE repuestos
      SET stock = $1
      WHERE id_repuesto = $2
        AND id_sucursal = $3
      RETURNING id_repuesto, id_sucursal, codigo, nombre, marca, precio, stock, stock_minimo, estado, fecha_creacion`,
      [stockNuevo, idRepuesto, usuarioSucursal.id_sucursal]
    );
    const movimientoResult = await client.query(
      `INSERT INTO movimientos_inventario (
        id_repuesto, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
        motivo, id_usuario
      )
      VALUES ($1, 'ENTRADA', $2, $3, $4, $5, $6)
      RETURNING id_movimiento, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
        motivo, fecha_creacion`,
      [idRepuesto, cantidad, stockAnterior, stockNuevo, motivo, req.usuario.id_usuario]
    );

    await client.query("COMMIT");
    return res.json({
      repuesto: serializeRepuesto(updateResult.rows[0]),
      movimiento: movimientoResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error registrando entrada de inventario:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.post("/:id/ajuste", verificarRol("ADMIN"), async (req, res) => {
  const idRepuesto = Number(req.params.id);
  const invalidFields = getInvalidFields(req.body, new Set(["tipo", "cantidad", "motivo"]));
  const tipo = clean(req.body?.tipo).toUpperCase();
  const motivo = clean(req.body?.motivo);

  if (!Number.isInteger(idRepuesto) || idRepuesto <= 0) {
    return res.status(400).json({ error: "id de repuesto no es valido" });
  }

  if (invalidFields.length > 0) {
    return res.status(400).json({ error: "Solo se permite enviar tipo, cantidad y motivo" });
  }

  if (!["POSITIVO", "NEGATIVO"].includes(tipo)) {
    return res.status(400).json({ error: "tipo debe ser POSITIVO o NEGATIVO" });
  }

  const cantidad = parsePositiveInteger(req.body?.cantidad, "cantidad", res);

  if (cantidad === null) return;

  if (!motivo) {
    return res.status(400).json({ error: "motivo es obligatorio" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      await client.query("ROLLBACK");
      return;
    }

    const repuesto = await getRepuestoForUpdate(client, idRepuesto, usuarioSucursal.id_sucursal);

    if (!repuesto) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Repuesto no encontrado para la sucursal" });
    }

    const stockAnterior = Number(repuesto.stock);

    if (tipo === "NEGATIVO" && cantidad > stockAnterior) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "El ajuste negativo no puede superar el stock actual",
        stock_actual: stockAnterior
      });
    }

    const stockNuevo = tipo === "POSITIVO"
      ? stockAnterior + cantidad
      : stockAnterior - cantidad;
    const tipoMovimiento = tipo === "POSITIVO" ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO";
    const updateResult = await client.query(
      `UPDATE repuestos
      SET stock = $1
      WHERE id_repuesto = $2
        AND id_sucursal = $3
      RETURNING id_repuesto, id_sucursal, codigo, nombre, marca, precio, stock, stock_minimo, estado, fecha_creacion`,
      [stockNuevo, idRepuesto, usuarioSucursal.id_sucursal]
    );
    const movimientoResult = await client.query(
      `INSERT INTO movimientos_inventario (
        id_repuesto, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
        motivo, id_usuario
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id_movimiento, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
        motivo, fecha_creacion`,
      [
        idRepuesto,
        tipoMovimiento,
        cantidad,
        stockAnterior,
        stockNuevo,
        motivo,
        req.usuario.id_usuario
      ]
    );

    await client.query("COMMIT");
    return res.json({
      repuesto: serializeRepuesto(updateResult.rows[0]),
      movimiento: movimientoResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error ajustando inventario:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.get("/:id/movimientos", verificarRol("ADMIN"), async (req, res) => {
  const idRepuesto = Number(req.params.id);

  if (!Number.isInteger(idRepuesto) || idRepuesto <= 0) {
    return res.status(400).json({ error: "id de repuesto no es valido" });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const repuestoResult = await db.query(
      `SELECT id_repuesto, codigo, nombre, stock, stock_minimo, estado
      FROM repuestos
      WHERE id_repuesto = $1
        AND id_sucursal = $2
      LIMIT 1`,
      [idRepuesto, usuarioSucursal.id_sucursal]
    );

    if (repuestoResult.rows.length === 0) {
      return res.status(404).json({ error: "Repuesto no encontrado para la sucursal" });
    }

    const movimientosResult = await db.query(
      `SELECT
        mi.id_movimiento,
        mi.tipo_movimiento AS tipo,
        mi.cantidad,
        mi.stock_anterior,
        mi.stock_nuevo,
        mi.motivo,
        mi.id_usuario,
        u.nombre AS usuario,
        mi.fecha_creacion AS fecha,
        mi.id_orden,
        os.estado AS estado_orden,
        p.numero_serie
      FROM movimientos_inventario mi
      INNER JOIN usuarios u ON u.id_usuario = mi.id_usuario
      LEFT JOIN ordenes_servicio os ON os.id_orden = mi.id_orden
      LEFT JOIN productos p ON p.id_producto = os.id_producto
      WHERE mi.id_repuesto = $1
      ORDER BY mi.fecha_creacion DESC, mi.id_movimiento DESC`,
      [idRepuesto]
    );

    return res.json({
      repuesto: serializeRepuesto(repuestoResult.rows[0]),
      movimientos: movimientosResult.rows
    });
  } catch (error) {
    console.error("Error consultando movimientos de inventario:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;