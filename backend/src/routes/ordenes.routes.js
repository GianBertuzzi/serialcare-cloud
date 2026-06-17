const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);

router.get("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        o.id_orden,
        o.id_producto,
        p.numero_serie,
        p.marca,
        p.modelo,
        o.id_tecnico,
        u.nombre AS tecnico_nombre,
        u.email AS tecnico_email,
        o.diagnostico,
        o.estado,
        o.fecha_creacion
      FROM ordenes_servicio o
      INNER JOIN productos p ON p.id_producto = o.id_producto
      INNER JOIN usuarios u ON u.id_usuario = o.id_tecnico
      ORDER BY o.fecha_creacion DESC`
    );

    return res.json({ ordenes: result.rows });
  } catch (error) {
    console.error("Error listando ordenes de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const {
    id_producto,
    id_tecnico,
    diagnostico,
    estado = "ABIERTA"
  } = req.body || {};

  if (!id_producto || !id_tecnico || !diagnostico) {
    return res.status(400).json({
      error: "id_producto, id_tecnico y diagnostico son obligatorios"
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO ordenes_servicio (
        id_producto,
        id_tecnico,
        diagnostico,
        estado
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id_orden,
        id_producto,
        id_tecnico,
        diagnostico,
        estado,
        fecha_creacion`,
      [id_producto, id_tecnico, diagnostico, estado]
    );

    return res.status(201).json({ orden: result.rows[0] });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({
        error: "Producto o tecnico no encontrado"
      });
    }

    console.error("Error creando orden de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/estado", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};

  if (!estado) {
    return res.status(400).json({ error: "estado es obligatorio" });
  }

  try {
    const result = await db.query(
      `UPDATE ordenes_servicio
      SET estado = $1
      WHERE id_orden = $2
      RETURNING
        id_orden,
        id_producto,
        id_tecnico,
        diagnostico,
        estado,
        fecha_creacion`,
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Orden de servicio no encontrada" });
    }

    return res.json({ orden: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando estado de orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
