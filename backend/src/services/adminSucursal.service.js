const db = require("../db");

async function getAdminSucursal(idUsuario) {
  const result = await db.query(
    `SELECT u.id_sucursal, s.nombre AS nombre_sucursal
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

function requireAdminSucursal(adminSucursal, res) {
  if (!adminSucursal?.id_sucursal) {
    res.status(400).json({ error: "Usuario ADMIN no tiene sucursal asignada" });
    return false;
  }

  return true;
}

module.exports = { getAdminSucursal, requireAdminSucursal };
