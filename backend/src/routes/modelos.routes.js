const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol("ADMIN"));

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        id_modelo,
        codigo_comercial,
        descripcion,
        familia,
        marca,
        certificado
      FROM productos_modelo
      ORDER BY marca ASC, descripcion ASC`
    );

    return res.json({ modelos: result.rows });
  } catch (error) {
    console.error("Error listando modelos de maquina:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
