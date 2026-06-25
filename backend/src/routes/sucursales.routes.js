const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol("MARCA"));

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado,
        fecha_creacion
      FROM sucursales
      ORDER BY id_sucursal ASC`
    );

    return res.json({ sucursales: result.rows });
  } catch (error) {
    console.error("Error listando sucursales:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req, res) => {
  const {
    nombre,
    ciudad = null,
    region = null,
    direccion = null,
    costo_ingreso_taller = 0,
    estado = "ACTIVA"
  } = req.body || {};

  if (!nombre) {
    return res.status(400).json({ error: "nombre es obligatorio" });
  }

  try {
    const result = await db.query(
      `INSERT INTO sucursales (
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado,
        fecha_creacion`,
      [nombre, ciudad, region, direccion, costo_ingreso_taller, estado]
    );

    return res.status(201).json({ sucursal: result.rows[0] });
  } catch (error) {
    console.error("Error creando sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    nombre = null,
    ciudad = null,
    region = null,
    direccion = null,
    costo_ingreso_taller = null,
    estado = null
  } = req.body || {};

  try {
    const result = await db.query(
      `UPDATE sucursales
      SET nombre = COALESCE($1, nombre),
          ciudad = COALESCE($2, ciudad),
          region = COALESCE($3, region),
          direccion = COALESCE($4, direccion),
          costo_ingreso_taller = COALESCE($5, costo_ingreso_taller),
          estado = COALESCE($6, estado)
      WHERE id_sucursal = $7
      RETURNING
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado,
        fecha_creacion`,
      [nombre, ciudad, region, direccion, costo_ingreso_taller, estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }

    return res.json({ sucursal: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/desactivar", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE sucursales
      SET estado = 'INACTIVA'
      WHERE id_sucursal = $1
      RETURNING
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado,
        fecha_creacion`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }

    return res.json({ sucursal: result.rows[0] });
  } catch (error) {
    console.error("Error desactivando sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
