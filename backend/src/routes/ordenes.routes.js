const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

const TIPOS_ORDEN = [
  "REPARACION",
  "GARANTIA",
  "MANTENIMIENTO",
  "PUESTA_EN_MARCHA"
];

const ORDEN_SELECT = `SELECT
  o.id_orden,
  o.id_producto,
  p.numero_serie,
  p.marca,
  p.modelo,
  o.id_modelo,
  pm.codigo_comercial,
  pm.descripcion AS descripcion_modelo,
  o.id_tecnico,
  u.nombre AS tecnico_nombre,
  u.email AS tecnico_email,
  o.id_sucursal,
  s.nombre AS nombre_sucursal,
  o.costo_ingreso_taller,
  o.valor_revision,
  o.tipo_orden,
  o.diagnostico,
  o.estado,
  o.fecha_creacion
FROM ordenes_servicio o
INNER JOIN productos p ON p.id_producto = o.id_producto
LEFT JOIN productos_modelo pm ON pm.id_modelo = o.id_modelo
LEFT JOIN usuarios u ON u.id_usuario = o.id_tecnico
LEFT JOIN sucursales s ON s.id_sucursal = o.id_sucursal`;

const GARANTIA_DETALLE_SELECT = `SELECT
  g.id_garantia,
  g.id_orden,
  g.id_producto,
  g.id_sucursal,
  s.nombre AS nombre_sucursal,
  g.id_tecnico,
  u.nombre AS tecnico,
  u.email AS tecnico_email,
  p.numero_serie,
  p.marca,
  p.modelo,
  o.diagnostico,
  g.estado,
  g.observacion,
  g.observacion_marca,
  g.fecha_solicitud,
  g.fecha_revision
FROM garantias g
INNER JOIN ordenes_servicio o ON o.id_orden = g.id_orden
INNER JOIN productos p ON p.id_producto = g.id_producto
LEFT JOIN usuarios u ON u.id_usuario = g.id_tecnico
LEFT JOIN sucursales s ON s.id_sucursal = g.id_sucursal`;

router.use(verificarToken);

async function getUsuarioSucursal(idUsuario) {
  const result = await db.query(
    `SELECT
      u.id_usuario,
      u.id_sucursal,
      s.nombre AS nombre_sucursal,
      s.estado AS estado_sucursal,
      s.costo_ingreso_taller
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

function requireSucursal(usuarioSucursal, res) {
  if (!usuarioSucursal || !usuarioSucursal.id_sucursal) {
    res.status(400).json({
      error: "Usuario ADMIN/TECNICO no tiene sucursal asignada"
    });
    return false;
  }

  return true;
}

async function getOrdenDetalle(idOrden) {
  const result = await db.query(
    `${ORDEN_SELECT}
    WHERE o.id_orden = $1
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
}

async function getGarantiaDetalle(idGarantia) {
  const result = await db.query(
    `${GARANTIA_DETALLE_SELECT}
    WHERE g.id_garantia = $1
    LIMIT 1`,
    [idGarantia]
  );

  return result.rows[0] || null;
}

async function getOrdenParaUsuario(idOrden, usuario, allowMarca = false) {
  const orden = await getOrdenDetalle(idOrden);

  if (!orden) {
    return { status: 404, error: "Orden no encontrada" };
  }

  if (usuario.rol === "MARCA" && allowMarca) {
    return { orden, usuarioSucursal: null };
  }

  const usuarioSucursal = await getUsuarioSucursal(usuario.id_usuario);

  if (!usuarioSucursal || !usuarioSucursal.id_sucursal) {
    return {
      status: 400,
      error: "Usuario ADMIN/TECNICO no tiene sucursal asignada"
    };
  }

  if (Number(orden.id_sucursal) !== Number(usuarioSucursal.id_sucursal)) {
    return {
      status: 404,
      error: "Orden no encontrada para la sucursal del usuario"
    };
  }

  return { orden, usuarioSucursal };
}

function parsePositiveInteger(value, defaultValue) {
  const numberValue = value === undefined || value === null || value === ""
    ? defaultValue
    : Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return null;
  }

  return numberValue;
}

function parseMoney(value, defaultValue = 0) {
  const numberValue = value === undefined || value === null || value === ""
    ? defaultValue
    : Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return Math.round(numberValue);
}

router.get(
  "/",
  verificarRol("ADMIN", "TECNICO", "MARCA"),
  async (req, res) => {
    const isMarca = req.usuario.rol === "MARCA";

    try {
      const usuarioSucursal = isMarca
        ? null
        : await getUsuarioSucursal(req.usuario.id_usuario);

      if (!isMarca && !requireSucursal(usuarioSucursal, res)) {
        return;
      }

      const params = isMarca ? [] : [usuarioSucursal.id_sucursal];

      const result = await db.query(
        `${ORDEN_SELECT}
        ${isMarca ? "" : "WHERE o.id_sucursal = $1"}
        ORDER BY o.fecha_creacion DESC`,
        params
      );

      return res.json({ ordenes: result.rows });
    } catch (error) {
      console.error("Error listando ordenes de servicio:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const {
    id_producto,
    numero_serie,
    tipo_orden = "REPARACION",
    diagnostico = ""
  } = req.body || {};

  const hasProductoId =
    id_producto !== undefined &&
    id_producto !== null &&
    String(id_producto).trim() !== "";
  const numeroSerie =
    typeof numero_serie === "string" ? numero_serie.trim() : "";
  const tipoOrden = String(tipo_orden || "REPARACION").trim().toUpperCase();
  const diagnosticoOrden =
    typeof diagnostico === "string" ? diagnostico.trim() : "";

  if (!hasProductoId && !numeroSerie) {
    return res.status(400).json({
      error: "id_producto o numero_serie es obligatorio"
    });
  }

  if (!TIPOS_ORDEN.includes(tipoOrden)) {
    return res.status(400).json({
      error: "tipo_orden no es valido"
    });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res)) {
      return;
    }

    if (usuarioSucursal.estado_sucursal !== "ACTIVA") {
      return res.status(403).json({
        error: "La sucursal del usuario esta INACTIVA y no puede crear ordenes"
      });
    }

    const productoResult = hasProductoId
      ? await db.query(
          `SELECT id_producto, numero_serie, marca, modelo, id_modelo
          FROM productos
          WHERE id_producto = $1
          LIMIT 1`,
          [id_producto]
        )
      : await db.query(
          `SELECT id_producto, numero_serie, marca, modelo, id_modelo
          FROM productos
          WHERE UPPER(numero_serie) = UPPER($1)
          LIMIT 1`,
          [numeroSerie]
        );

    if (productoResult.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const producto = productoResult.rows[0];

    if (!producto.id_modelo) {
      return res.status(400).json({
        error: "El producto no tiene un modelo de maquina asociado"
      });
    }

    const precioResult = await db.query(
      `SELECT valor_revision
      FROM precios_modelo_sucursal
      WHERE id_sucursal = $1
        AND id_modelo = $2
        AND estado = 'ACTIVO'
      LIMIT 1`,
      [usuarioSucursal.id_sucursal, producto.id_modelo]
    );

    if (precioResult.rows.length === 0) {
      return res.status(400).json({
        error:
          "No existe valor de revision configurado para este modelo en la sucursal"
      });
    }

    const idTecnico =
      req.usuario.rol === "TECNICO" ? req.usuario.id_usuario : null;

    const result = await db.query(
      `INSERT INTO ordenes_servicio (
        id_producto,
        id_tecnico,
        id_sucursal,
        id_modelo,
        costo_ingreso_taller,
        valor_revision,
        tipo_orden,
        diagnostico,
        estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDIENTE')
      RETURNING id_orden`,
      [
        producto.id_producto,
        idTecnico,
        usuarioSucursal.id_sucursal,
        producto.id_modelo,
        usuarioSucursal.costo_ingreso_taller || 0,
        precioResult.rows[0].valor_revision,
        tipoOrden,
        diagnosticoOrden
      ]
    );

    const orden = await getOrdenDetalle(result.rows[0].id_orden);

    return res.status(201).json({ orden });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({
        error: "Producto, tecnico, sucursal o modelo no encontrado"
      });
    }

    console.error("Error creando orden de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get(
  "/:id/repuestos",
  verificarRol("ADMIN", "TECNICO", "MARCA"),
  async (req, res) => {
    try {
      const access = await getOrdenParaUsuario(
        req.params.id,
        req.usuario,
        true
      );

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const result = await db.query(
        `SELECT
          id_repuesto_usado,
          id_orden,
          nombre_repuesto,
          cantidad,
          precio_unitario,
          cubierto_garantia,
          observacion,
          fecha_registro
        FROM repuestos_usados
        WHERE id_orden = $1
        ORDER BY fecha_registro DESC, id_repuesto_usado DESC`,
        [access.orden.id_orden]
      );

      return res.json({ repuestos: result.rows });
    } catch (error) {
      console.error("Error listando repuestos de orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post(
  "/:id/repuestos",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const {
      nombre_repuesto,
      cantidad = 1,
      precio_unitario = 0,
      cubierto_garantia = false,
      observacion = ""
    } = req.body || {};

    const nombreRepuesto =
      typeof nombre_repuesto === "string" ? nombre_repuesto.trim() : "";
    const cantidadValue = parsePositiveInteger(cantidad, 1);
    const precioUnitarioValue = parseMoney(precio_unitario, 0);
    const cubiertoGarantiaValue =
      cubierto_garantia === true || cubierto_garantia === "true";
    const observacionValue =
      typeof observacion === "string" ? observacion.trim() : "";

    if (!nombreRepuesto) {
      return res.status(400).json({ error: "nombre_repuesto es obligatorio" });
    }

    if (cantidadValue === null) {
      return res.status(400).json({
        error: "cantidad debe ser un numero entero mayor o igual a 1"
      });
    }

    if (precioUnitarioValue === null) {
      return res.status(400).json({
        error: "precio_unitario debe ser un numero mayor o igual a 0"
      });
    }

    try {
      const access = await getOrdenParaUsuario(req.params.id, req.usuario);

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const result = await db.query(
        `INSERT INTO repuestos_usados (
          id_orden,
          nombre_repuesto,
          cantidad,
          precio_unitario,
          cubierto_garantia,
          observacion
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id_repuesto_usado,
          id_orden,
          nombre_repuesto,
          cantidad,
          precio_unitario,
          cubierto_garantia,
          observacion,
          fecha_registro`,
        [
          access.orden.id_orden,
          nombreRepuesto,
          cantidadValue,
          precioUnitarioValue,
          cubiertoGarantiaValue,
          observacionValue
        ]
      );

      return res.status(201).json({ repuesto: result.rows[0] });
    } catch (error) {
      console.error("Error agregando repuesto a orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post(
  "/:id/solicitar-garantia",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const motivoRaw = req.body?.motivo_solicitud ?? req.body?.observacion ?? "";
    const observacion =
      typeof motivoRaw === "string" ? motivoRaw.trim() : String(motivoRaw || "");

    try {
      const access = await getOrdenParaUsuario(req.params.id, req.usuario);

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const duplicateResult = await db.query(
        `SELECT id_garantia
        FROM garantias
        WHERE id_orden = $1
          AND estado IN ('PENDIENTE', 'EN_REVISION')
        LIMIT 1`,
        [access.orden.id_orden]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(409).json({
          error: "Ya existe una solicitud de garantia pendiente para esta orden"
        });
      }

      const idTecnico =
        access.orden.id_tecnico ||
        (req.usuario.rol === "TECNICO" ? req.usuario.id_usuario : null);

      const result = await db.query(
        `INSERT INTO garantias (
          id_orden,
          id_producto,
          id_sucursal,
          id_tecnico,
          estado,
          observacion
        )
        VALUES ($1, $2, $3, $4, 'PENDIENTE', $5)
        RETURNING id_garantia`,
        [
          access.orden.id_orden,
          access.orden.id_producto,
          access.orden.id_sucursal,
          idTecnico,
          observacion || "Solicitud de garantia levantada desde orden de servicio"
        ]
      );

      const garantia = await getGarantiaDetalle(result.rows[0].id_garantia);

      return res.status(201).json({ garantia });
    } catch (error) {
      console.error("Error solicitando garantia desde orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.put(
  "/:id/estado",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "estado es obligatorio" });
    }

    try {
      const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

      if (!requireSucursal(usuarioSucursal, res)) {
        return;
      }

      const result = await db.query(
        `UPDATE ordenes_servicio
        SET estado = $1
        WHERE id_orden = $2
          AND id_sucursal = $3
        RETURNING id_orden`,
        [estado, id, usuarioSucursal.id_sucursal]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Orden no encontrada para la sucursal del usuario"
        });
      }

      const orden = await getOrdenDetalle(result.rows[0].id_orden);

      return res.json({ orden });
    } catch (error) {
      console.error("Error actualizando estado de orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

module.exports = router;