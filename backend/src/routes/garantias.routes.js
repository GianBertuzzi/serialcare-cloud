const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);

async function getUsuarioSucursal(idUsuario) {
  const result = await db.query(
    `SELECT id_sucursal
    FROM usuarios
    WHERE id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

const GARANTIA_SELECT = `SELECT
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
  g.fecha_revision,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id_repuesto_usado', ru.id_repuesto_usado,
      'id_orden', ru.id_orden,
      'nombre_repuesto', ru.nombre_repuesto,
      'cantidad', ru.cantidad,
      'precio_unitario', ru.precio_unitario,
      'cubierto_garantia', ru.cubierto_garantia,
      'observacion', ru.observacion,
      'fecha_registro', ru.fecha_registro
    ) ORDER BY ru.fecha_registro DESC, ru.id_repuesto_usado DESC)
    FROM repuestos_usados ru
    WHERE ru.id_orden = g.id_orden
  ), '[]'::json) AS repuestos_usados
FROM garantias g
INNER JOIN ordenes_servicio o ON o.id_orden = g.id_orden
INNER JOIN productos p ON p.id_producto = g.id_producto
LEFT JOIN usuarios u ON u.id_usuario = g.id_tecnico
LEFT JOIN sucursales s ON s.id_sucursal = g.id_sucursal`;

router.get(
  "/",
  verificarRol("ADMIN", "TECNICO", "MARCA"),
  async (req, res) => {
    const isMarca = req.usuario.rol === "MARCA";

    try {
      const usuarioSucursal = isMarca
        ? null
        : await getUsuarioSucursal(req.usuario.id_usuario);

      if (!isMarca && !usuarioSucursal?.id_sucursal) {
        return res.status(400).json({
          error: "Usuario ADMIN/TECNICO no tiene sucursal asignada"
        });
      }

      const result = await db.query(
        `${GARANTIA_SELECT}
        ${isMarca ? "" : "WHERE g.id_sucursal = $1"}
        ORDER BY g.fecha_solicitud DESC, g.id_garantia DESC`,
        isMarca ? [] : [usuarioSucursal.id_sucursal]
      );

      return res.json({ garantias: result.rows });
    } catch (error) {
      console.error("Error listando garantias:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

async function getGarantiaDetalle(idGarantia) {
  const result = await db.query(
    `${GARANTIA_SELECT}
    WHERE g.id_garantia = $1
    LIMIT 1`,
    [idGarantia]
  );

  return result.rows[0] || null;
}

async function updateGarantia(req, res, estado, defaultObservacion) {
  const { id } = req.params;
  const body = req.body || {};
  const observacionMarcaRaw =
    body.observacion_marca ?? body.observacion ?? defaultObservacion;
  const observacionMarca =
    typeof observacionMarcaRaw === "string"
      ? observacionMarcaRaw.trim()
      : String(observacionMarcaRaw || defaultObservacion);

  try {
    const result = await db.query(
      `UPDATE garantias
      SET estado = $1,
          observacion_marca = $2,
          fecha_revision = CURRENT_TIMESTAMP
      WHERE id_garantia = $3
      RETURNING id_garantia`,
      [estado, observacionMarca || defaultObservacion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Garantia no encontrada" });
    }

    const garantia = await getGarantiaDetalle(result.rows[0].id_garantia);

    return res.json({ garantia });
  } catch (error) {
    console.error(`Error actualizando garantia a ${estado}:`, error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}

router.put(
  "/:id/aprobar",
  verificarRol("MARCA"),
  async (req, res) => {
    return updateGarantia(req, res, "APROBADA", "Garantia aprobada");
  }
);

router.put(
  "/:id/rechazar",
  verificarRol("MARCA"),
  async (req, res) => {
    return updateGarantia(req, res, "RECHAZADA", "Garantia rechazada");
  }
);

module.exports = router;