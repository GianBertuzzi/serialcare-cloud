const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getUsuarioSucursal(idUsuario) {
  const result = await db.query(
    `SELECT u.id_usuario, u.id_sucursal, s.nombre AS nombre_sucursal, s.estado AS estado_sucursal
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

async function getTipoMaquina(idTipoMaquina, idSucursal) {
  const result = await db.query(
    `SELECT id_tipo_maquina, nombre, valor_ingreso
    FROM tipos_maquina
    WHERE id_tipo_maquina = $1
      AND id_sucursal = $2
      AND estado = 'ACTIVO'
    LIMIT 1`,
    [idTipoMaquina, idSucursal]
  );

  return result.rows[0] || null;
}

const PRODUCTO_SELECT = `SELECT
  p.id_producto,
  p.id_cliente,
  c.nombre AS cliente_nombre,
  c.email AS cliente_email,
  c.telefono AS cliente_telefono,
  p.id_sucursal,
  s.nombre AS nombre_sucursal,
  p.id_modelo,
  pm.codigo_comercial,
  pm.descripcion AS descripcion_modelo,
  pm.familia AS familia_modelo,
  pm.certificado AS modelo_certificado,
  p.id_tipo_maquina,
  tm.nombre AS tipo_maquina,
  tm.descripcion AS descripcion_tipo_maquina,
  tm.valor_ingreso,
  tm.aplica_garantia,
  p.numero_serie,
  p.marca,
  p.modelo,
  COALESCE(tm.nombre, p.tipo_maquina) AS tipo_maquina_texto,
  p.descripcion,
  p.estado_garantia,
  p.alerta_propiedad,
  p.fecha_registro,
  ultima_orden.id_orden AS id_ultima_orden,
  ultima_orden.estado AS estado_reparacion,
  ultima_orden.fecha_creacion AS fecha_ultima_orden,
  ultima_orden.tipo_atencion
FROM productos p
LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
LEFT JOIN sucursales s ON s.id_sucursal = p.id_sucursal
LEFT JOIN productos_modelo pm ON pm.id_modelo = p.id_modelo
LEFT JOIN tipos_maquina tm ON tm.id_tipo_maquina = p.id_tipo_maquina
LEFT JOIN LATERAL (
  SELECT os.id_orden, os.estado, os.fecha_creacion, os.tipo_atencion
  FROM ordenes_servicio os
  WHERE os.id_producto = p.id_producto
  ORDER BY os.fecha_creacion DESC
  LIMIT 1
) ultima_orden ON TRUE`;

router.get("/serie/:numeroSerie", async (req, res) => {
  const { numeroSerie } = req.params;

  try {
    const result = await db.query(
      `${PRODUCTO_SELECT}
      WHERE UPPER(p.numero_serie) = UPPER($1)
      LIMIT 1`,
      [numeroSerie]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    return res.json({ producto: result.rows[0] });
  } catch (error) {
    console.error("Error consultando producto por serie:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/", verificarToken, verificarRol("ADMIN", "TECNICO", "MARCA", "CLIENTE"), async (req, res) => {
  try {
    const rol = req.usuario.rol;
    let whereClause = "";
    let params = [];

    if (rol === "ADMIN" || rol === "TECNICO") {
      const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

      if (!requireSucursal(usuarioSucursal, res, rol)) {
        return;
      }

      whereClause = "WHERE p.id_sucursal = $1";
      params = [usuarioSucursal.id_sucursal];
    }

    if (rol === "CLIENTE") {
      whereClause = "WHERE c.id_usuario = $1";
      params = [req.usuario.id_usuario];
    }

    const result = await db.query(
      `${PRODUCTO_SELECT}
      ${whereClause}
      ORDER BY p.fecha_registro DESC, p.id_producto DESC`,
      params
    );

    return res.json({ productos: result.rows });
  } catch (error) {
    console.error("Error listando productos:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarToken, verificarRol("ADMIN"), async (req, res) => {
  const numeroSerie = clean(req.body?.numero_serie).toUpperCase();
  const marca = clean(req.body?.marca);
  const modelo = clean(req.body?.modelo);
  const descripcion = clean(req.body?.descripcion) || null;
  const idCliente = Number(req.body?.id_cliente);
  const idModelo = req.body?.id_modelo ? Number(req.body.id_modelo) : null;
  const idTipoMaquina = Number(req.body?.id_tipo_maquina);
  const estadoGarantia = clean(req.body?.estado_garantia).toUpperCase() || "PENDIENTE";
  const alertaPropiedad = req.body?.alerta_propiedad === true || req.body?.alerta_propiedad === "true";

  if (!numeroSerie || !marca || !modelo) {
    return res.status(400).json({ error: "numero_serie, marca y modelo son obligatorios" });
  }

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    return res.status(400).json({ error: "id_cliente es obligatorio" });
  }

  if (!Number.isInteger(idTipoMaquina) || idTipoMaquina <= 0) {
    return res.status(400).json({ error: "id_tipo_maquina es obligatorio" });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const clienteResult = await db.query(
      `SELECT id_cliente
      FROM clientes
      WHERE id_cliente = $1
        AND id_sucursal = $2
      LIMIT 1`,
      [idCliente, usuarioSucursal.id_sucursal]
    );

    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado para la sucursal" });
    }

    const tipoMaquina = await getTipoMaquina(idTipoMaquina, usuarioSucursal.id_sucursal);

    if (!tipoMaquina) {
      return res.status(404).json({ error: "Tipo de maquina no encontrado para la sucursal" });
    }

    const result = await db.query(
      `INSERT INTO productos (
        id_cliente,
        id_sucursal,
        id_modelo,
        id_tipo_maquina,
        numero_serie,
        marca,
        modelo,
        tipo_maquina,
        descripcion,
        estado_garantia,
        alerta_propiedad
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id_producto`,
      [
        idCliente,
        usuarioSucursal.id_sucursal,
        idModelo,
        idTipoMaquina,
        numeroSerie,
        marca,
        modelo,
        tipoMaquina.nombre,
        descripcion,
        estadoGarantia,
        alertaPropiedad
      ]
    );

    const productoResult = await db.query(`${PRODUCTO_SELECT} WHERE p.id_producto = $1 LIMIT 1`, [result.rows[0].id_producto]);
    return res.status(201).json({ producto: productoResult.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "El numero de serie ya existe" });
    }

    if (error.code === "23503") {
      return res.status(404).json({ error: "Cliente, sucursal, modelo o tipo de maquina no encontrado" });
    }

    console.error("Error creando producto:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", verificarToken, verificarRol("ADMIN"), async (req, res) => {
  const idCliente = req.body?.id_cliente === undefined ? null : Number(req.body.id_cliente);
  const idModelo = req.body?.id_modelo === undefined || req.body?.id_modelo === "" ? null : Number(req.body.id_modelo);
  const idTipoMaquina = req.body?.id_tipo_maquina === undefined || req.body?.id_tipo_maquina === "" ? null : Number(req.body.id_tipo_maquina);
  const numeroSerie = req.body?.numero_serie === undefined ? null : clean(req.body.numero_serie).toUpperCase();
  const marca = req.body?.marca === undefined ? null : clean(req.body.marca);
  const modelo = req.body?.modelo === undefined ? null : clean(req.body.modelo);
  const descripcion = req.body?.descripcion === undefined ? null : clean(req.body.descripcion);
  const estadoGarantia = req.body?.estado_garantia === undefined ? null : clean(req.body.estado_garantia).toUpperCase();
  const alertaPropiedad = req.body?.alerta_propiedad === undefined ? null : (req.body.alerta_propiedad === true || req.body.alerta_propiedad === "true");

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    if (idCliente !== null) {
      const clienteResult = await db.query(
        `SELECT id_cliente
        FROM clientes
        WHERE id_cliente = $1
          AND id_sucursal = $2
        LIMIT 1`,
        [idCliente, usuarioSucursal.id_sucursal]
      );

      if (clienteResult.rows.length === 0) {
        return res.status(404).json({ error: "Cliente no encontrado para la sucursal" });
      }
    }

    let tipoMaquinaNombre = null;
    if (idTipoMaquina !== null) {
      const tipoMaquina = await getTipoMaquina(idTipoMaquina, usuarioSucursal.id_sucursal);
      if (!tipoMaquina) {
        return res.status(404).json({ error: "Tipo de maquina no encontrado para la sucursal" });
      }
      tipoMaquinaNombre = tipoMaquina.nombre;
    }

    const result = await db.query(
      `UPDATE productos
      SET id_cliente = COALESCE($1, id_cliente),
          id_modelo = COALESCE($2, id_modelo),
          id_tipo_maquina = COALESCE($3, id_tipo_maquina),
          numero_serie = COALESCE($4, numero_serie),
          marca = COALESCE($5, marca),
          modelo = COALESCE($6, modelo),
          tipo_maquina = COALESCE($7, tipo_maquina),
          descripcion = COALESCE($8, descripcion),
          estado_garantia = COALESCE($9, estado_garantia),
          alerta_propiedad = COALESCE($10, alerta_propiedad)
      WHERE id_producto = $11
        AND id_sucursal = $12
      RETURNING id_producto`,
      [
        idCliente,
        idModelo,
        idTipoMaquina,
        numeroSerie,
        marca,
        modelo,
        tipoMaquinaNombre,
        descripcion,
        estadoGarantia,
        alertaPropiedad,
        req.params.id,
        usuarioSucursal.id_sucursal
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado para la sucursal" });
    }

    const productoResult = await db.query(`${PRODUCTO_SELECT} WHERE p.id_producto = $1 LIMIT 1`, [result.rows[0].id_producto]);
    return res.json({ producto: productoResult.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "El numero de serie ya existe" });
    }

    console.error("Error actualizando producto:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;