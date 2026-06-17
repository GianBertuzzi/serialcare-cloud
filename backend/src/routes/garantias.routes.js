const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol("ADMIN", "MARCA"));

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        g.id_garantia,
        g.id_producto,
        p.numero_serie,
        p.marca,
        p.modelo,
        g.estado,
        g.observacion,
        g.fecha_revision
      FROM garantias g
      INNER JOIN productos p ON p.id_producto = g.id_producto
      ORDER BY g.id_garantia DESC`
    );

    return res.json({ garantias: result.rows });
  } catch (error) {
    console.error("Error listando garantias:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/aprobar", async (req, res) => {
  const { id } = req.params;
  const { observacion = "Garantia aprobada" } = req.body || {};

  try {
    const result = await db.query(
      `UPDATE garantias
      SET estado = $1,
          observacion = $2,
          fecha_revision = CURRENT_TIMESTAMP
      WHERE id_garantia = $3
      RETURNING
        id_garantia,
        id_producto,
        estado,
        observacion,
        fecha_revision`,
      ["APROBADA", observacion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Garantia no encontrada" });
    }

    return res.json({ garantia: result.rows[0] });
  } catch (error) {
    console.error("Error aprobando garantia:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/rechazar", async (req, res) => {
  const { id } = req.params;
  const { observacion = "Garantia rechazada" } = req.body || {};

  try {
    const result = await db.query(
      `UPDATE garantias
      SET estado = $1,
          observacion = $2,
          fecha_revision = CURRENT_TIMESTAMP
      WHERE id_garantia = $3
      RETURNING
        id_garantia,
        id_producto,
        estado,
        observacion,
        fecha_revision`,
      ["RECHAZADA", observacion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Garantia no encontrada" });
    }

    return res.json({ garantia: result.rows[0] });
  } catch (error) {
    console.error("Error rechazando garantia:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
