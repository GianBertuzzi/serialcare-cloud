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
  c.nombre AS cliente_nombre,
  o.diagnostico,
  o.informe_tecnico,
  o.garantia_aprobada_por_admin,
  o.observacion_admin AS decision_admin,
  g.estado,
  g.observacion,
  g.observacion_admin,
  g.observacion_marca,
  g.fecha_solicitud,
  g.fecha_revision,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id_repuesto_usado', ru.id_detalle,
      'id_detalle', ru.id_detalle,
      'id_orden', ru.id_orden,
      'id_repuesto', ru.id_repuesto,
      'nombre_repuesto', ru.nombre_repuesto,
      'cantidad', ru.cantidad,
      'precio_unitario', ru.precio_unitario,
      'subtotal', ru.subtotal,
      'cubierto_garantia', ru.cubierto_garantia,
      'observacion', ru.observacion,
      'fecha_registro', ru.fecha_registro
    ) ORDER BY ru.fecha_registro DESC, ru.id_detalle DESC)
    FROM repuestos_usados ru
    WHERE ru.id_orden = g.id_orden
  ), '[]'::json) AS repuestos_usados
FROM garantias g
INNER JOIN ordenes_servicio o ON o.id_orden = g.id_orden
INNER JOIN productos p ON p.id_producto = g.id_producto
INNER JOIN clientes c ON c.id_cliente = o.id_cliente
LEFT JOIN usuarios u ON u.id_usuario = g.id_tecnico
LEFT JOIN sucursales s ON s.id_sucursal = g.id_sucursal`;

router.get("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const isMarca = false;

  try {
    const usuarioSucursal = isMarca ? null : await getUsuarioSucursal(req.usuario.id_usuario);

    if (!isMarca && !usuarioSucursal?.id_sucursal) {
      return res.status(400).json({ error: "Usuario ADMIN/TECNICO no tiene sucursal asignada" });
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
});

module.exports = router;