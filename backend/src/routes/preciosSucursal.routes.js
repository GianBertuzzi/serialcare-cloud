const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol("ADMIN"));

async function getAdminSucursal(idUsuario) {
  const result = await db.query(
    `SELECT
      u.id_sucursal,
      s.nombre AS nombre_sucursal,
      s.estado AS estado_sucursal
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

function validateSucursal(adminSucursal, res) {
  if (!adminSucursal || !adminSucursal.id_sucursal) {
    res.status(400).json({
      error: "Usuario ADMIN no tiene sucursal asignada"
    });
    return false;
  }

  return true;
}

router.get("/", async (req, res) => {
  try {
    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario);

    if (!validateSucursal(adminSucursal, res)) {
      return;
    }

    const result = await db.query(
      `SELECT
        pms.id_precio,
        pms.id_sucursal,
        s.nombre AS nombre_sucursal,
        pms.id_modelo,
        pm.codigo_comercial,
        pm.descripcion,
        pm.familia,
        pm.marca,
        pm.certificado,
        pms.valor_revision,
        pms.valor_mano_obra,
        pms.estado
      FROM precios_modelo_sucursal pms
      INNER JOIN productos_modelo pm ON pm.id_modelo = pms.id_modelo
      INNER JOIN sucursales s ON s.id_sucursal = pms.id_sucursal
      WHERE pms.id_sucursal = $1
      ORDER BY pm.marca ASC, pm.descripcion ASC`,
      [adminSucursal.id_sucursal]
    );

    return res.json({
      nombre_sucursal: adminSucursal.nombre_sucursal,
      precios: result.rows
    });
  } catch (error) {
    console.error("Error listando precios de sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { valor_revision = null, valor_mano_obra = null, estado = null } =
    req.body || {};

  try {
    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario);

    if (!validateSucursal(adminSucursal, res)) {
      return;
    }

    const result = await db.query(
      `UPDATE precios_modelo_sucursal
      SET valor_revision = COALESCE($1, valor_revision),
          valor_mano_obra = COALESCE($2, valor_mano_obra),
          estado = COALESCE($3, estado)
      WHERE id_precio = $4
        AND id_sucursal = $5
      RETURNING
        id_precio,
        id_sucursal,
        id_modelo,
        valor_revision,
        valor_mano_obra,
        estado`,
      [valor_revision, valor_mano_obra, estado, id, adminSucursal.id_sucursal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Precio no encontrado para la sucursal del ADMIN"
      });
    }

    return res.json({ precio: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando precio de sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
