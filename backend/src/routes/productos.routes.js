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

async function getUsuarioSucursal(idUsuario) {
  const result = await db.query(
    `SELECT
      u.id_usuario,
      u.id_sucursal,
      s.nombre AS nombre_sucursal
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN", "TECNICO", "MARCA", "CLIENTE"),
  async (req, res) => {
    const rol = req.usuario.rol;
    const isCliente = rol === "CLIENTE";
    const isSucursalUser = rol === "ADMIN" || rol === "TECNICO";
    let params = [];
    let whereClause = "";
    let ordenScopeClause = "";

    try {
      if (isCliente) {
        params = [req.usuario.id_usuario];
        whereClause = "WHERE p.id_cliente = $1";
      }

      if (isSucursalUser) {
        const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

        if (!usuarioSucursal || !usuarioSucursal.id_sucursal) {
          return res.status(400).json({
            error: "Usuario ADMIN/TECNICO no tiene sucursal asignada"
          });
        }

        params = [usuarioSucursal.id_sucursal];
        ordenScopeClause = "AND os.id_sucursal = $1";
        whereClause = `WHERE (
          EXISTS (
            SELECT 1
            FROM ordenes_servicio os_scope
            WHERE os_scope.id_producto = p.id_producto
              AND os_scope.id_sucursal = $1
          )
          OR NOT EXISTS (
            SELECT 1
            FROM ordenes_servicio os_any
            WHERE os_any.id_producto = p.id_producto
          )
        )`;
      }

      const result = await db.query(
        `SELECT
          p.id_producto,
          p.numero_serie,
          p.marca,
          p.modelo,
          p.id_modelo,
          pm.codigo_comercial,
          pm.descripcion AS descripcion_modelo,
          pm.familia AS familia_modelo,
          pm.certificado AS modelo_certificado,
          p.id_cliente,
          p.estado_garantia,
          p.alerta_propiedad,
          p.fecha_registro,
          ultima_orden.id_orden AS id_ultima_orden,
          ultima_orden.estado AS estado_reparacion,
          ultima_orden.fecha_creacion AS fecha_ultima_orden,
          ultima_orden.nombre_sucursal,
          ultima_orden.costo_ingreso_taller,
          ultima_orden.valor_revision
        FROM productos p
        LEFT JOIN productos_modelo pm ON pm.id_modelo = p.id_modelo
        LEFT JOIN LATERAL (
          SELECT
            os.id_orden,
            os.estado,
            os.fecha_creacion,
            os.costo_ingreso_taller,
            os.valor_revision,
            s.nombre AS nombre_sucursal
          FROM ordenes_servicio os
          LEFT JOIN sucursales s ON s.id_sucursal = os.id_sucursal
          WHERE os.id_producto = p.id_producto
            ${ordenScopeClause}
          ORDER BY os.fecha_creacion DESC
          LIMIT 1
        ) ultima_orden ON TRUE
        ${whereClause}
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
      id_modelo = null,
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
          id_modelo,
          id_cliente,
          estado_garantia,
          alerta_propiedad
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id_producto,
          numero_serie,
          marca,
          modelo,
          id_modelo,
          id_cliente,
          estado_garantia,
          alerta_propiedad,
          fecha_registro`,
        [
          numero_serie,
          marca,
          modelo,
          id_modelo,
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
        return res.status(404).json({ error: "Cliente o modelo no encontrado" });
      }

      console.error("Error creando producto:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

module.exports = router;
