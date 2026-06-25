const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.get("/serie/:numeroSerie", async (req, res) => {
  const { numeroSerie } = req.params;

  try {
    const result = await db.query(
      `SELECT
        numero_serie,
        marca,
        modelo,
        estado_garantia,
        alerta_propiedad
      FROM productos
      WHERE numero_serie = $1
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

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN", "TECNICO", "MARCA", "CLIENTE"),
  async (req, res) => {
    const isCliente = req.usuario.rol === "CLIENTE";
    const params = isCliente ? [req.usuario.id_usuario] : [];

    try {
      const result = await db.query(
        `SELECT
          p.id_producto,
          p.numero_serie,
          p.marca,
          p.modelo,
          p.id_cliente,
          p.estado_garantia,
          p.alerta_propiedad,
          p.fecha_registro,
          ultima_orden.id_orden AS id_ultima_orden,
          ultima_orden.estado AS estado_reparacion,
          ultima_orden.fecha_creacion AS fecha_ultima_orden
        FROM productos p
        LEFT JOIN LATERAL (
          SELECT
            os.id_orden,
            os.estado,
            os.fecha_creacion
          FROM ordenes_servicio os
          WHERE os.id_producto = p.id_producto
          ORDER BY os.fecha_creacion DESC
          LIMIT 1
        ) ultima_orden ON TRUE
        ${isCliente ? "WHERE p.id_cliente = $1" : ""}
        ORDER BY p.fecha_registro DESC`,
        params
      );

      return res.json({ productos: result.rows });
    } catch (error) {
      console.error("Error listando productos:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  async (req, res) => {
    const {
      numero_serie,
      marca,
      modelo,
      id_cliente = null,
      estado_garantia = "PENDIENTE",
      alerta_propiedad = false
    } = req.body || {};

    if (!numero_serie || !marca || !modelo) {
      return res.status(400).json({
        error: "numero_serie, marca y modelo son obligatorios"
      });
    }

    try {
      const result = await db.query(
        `INSERT INTO productos (
          numero_serie,
          marca,
          modelo,
          id_cliente,
          estado_garantia,
          alerta_propiedad
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id_producto,
          numero_serie,
          marca,
          modelo,
          id_cliente,
          estado_garantia,
          alerta_propiedad,
          fecha_registro`,
        [
          numero_serie,
          marca,
          modelo,
          id_cliente,
          estado_garantia,
          alerta_propiedad
        ]
      );

      return res.status(201).json({ producto: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "El numero de serie ya existe" });
      }

      if (error.code === "23503") {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }

      console.error("Error creando producto:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

module.exports = router;
