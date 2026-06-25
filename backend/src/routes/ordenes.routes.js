const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

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
        `SELECT
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
        INNER JOIN usuarios u ON u.id_usuario = o.id_tecnico
        LEFT JOIN sucursales s ON s.id_sucursal = o.id_sucursal
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
    id_tecnico,
    id_modelo = null,
    diagnostico,
    estado = "ABIERTA",
    tipo_orden = "REPARACION"
  } = req.body || {};

  if (!id_producto || !id_tecnico || !diagnostico) {
    return res.status(400).json({
      error: "id_producto, id_tecnico y diagnostico son obligatorios"
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

    const tecnicoResult = await db.query(
      `SELECT id_usuario, id_sucursal
      FROM usuarios
      WHERE id_usuario = $1
      LIMIT 1`,
      [id_tecnico]
    );

    if (tecnicoResult.rows.length === 0) {
      return res.status(404).json({ error: "Tecnico no encontrado" });
    }

    if (tecnicoResult.rows[0].id_sucursal !== usuarioSucursal.id_sucursal) {
      return res.status(403).json({
        error: "El tecnico debe pertenecer a la misma sucursal"
      });
    }

    const productoResult = await db.query(
      `SELECT id_producto, id_modelo
      FROM productos
      WHERE id_producto = $1
      LIMIT 1`,
      [id_producto]
    );

    if (productoResult.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const resolvedModeloId = id_modelo || productoResult.rows[0].id_modelo;

    if (!resolvedModeloId) {
      return res.status(400).json({
        error: "La orden debe tener un modelo de maquina asociado"
      });
    }

    const precioResult = await db.query(
      `SELECT valor_revision
      FROM precios_modelo_sucursal
      WHERE id_sucursal = $1
        AND id_modelo = $2
        AND estado = 'ACTIVO'
      LIMIT 1`,
      [usuarioSucursal.id_sucursal, resolvedModeloId]
    );

    if (precioResult.rows.length === 0) {
      return res.status(400).json({
        error: "No existe precio activo para este modelo en la sucursal del usuario"
      });
    }

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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id_orden,
        id_producto,
        id_tecnico,
        id_sucursal,
        id_modelo,
        costo_ingreso_taller,
        valor_revision,
        tipo_orden,
        diagnostico,
        estado,
        fecha_creacion`,
      [
        id_producto,
        id_tecnico,
        usuarioSucursal.id_sucursal,
        resolvedModeloId,
        usuarioSucursal.costo_ingreso_taller,
        precioResult.rows[0].valor_revision,
        tipo_orden,
        diagnostico,
        estado
      ]
    );

    return res.status(201).json({ orden: result.rows[0] });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({
        error: "Producto, tecnico o modelo no encontrado"
      });
    }

    console.error("Error creando orden de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

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
        RETURNING
          id_orden,
          id_producto,
          id_tecnico,
          id_sucursal,
          id_modelo,
          costo_ingreso_taller,
          valor_revision,
          tipo_orden,
          diagnostico,
          estado,
          fecha_creacion`,
        [estado, id, usuarioSucursal.id_sucursal]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Orden no encontrada para la sucursal del usuario"
        });
      }

      return res.json({ orden: result.rows[0] });
    } catch (error) {
      console.error("Error actualizando estado de orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

module.exports = router;
