const db = require("../../db");

async function getUsuarioSucursal(idUsuario, client = db) {
  const result = await client.query(
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
  if (!usuarioSucursal?.id_sucursal) {
    res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    return false;
  }

  return true;
}

module.exports = { getUsuarioSucursal, requireSucursal };
