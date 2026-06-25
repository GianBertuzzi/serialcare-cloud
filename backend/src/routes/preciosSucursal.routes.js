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

function parseNonNegativeNumber(value, fieldName, res) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    res.status(400).json({
      error: `${fieldName} debe ser numero mayor o igual a 0`
    });
    return null;
  }

  return numberValue;
}

const PRECIO_SELECT = `SELECT
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
INNER JOIN sucursales s ON s.id_sucursal = pms.id_sucursal`;

router.get("/", async (req, res) => {
  try {
    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario);

    if (!validateSucursal(adminSucursal, res)) {
      return;
    }

    const result = await db.query(
      `${PRECIO_SELECT}
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

router.post("/", async (req, res) => {
  const { id_modelo, valor_revision, valor_mano_obra = 0 } = req.body || {};

  const modeloId = Number(id_modelo);

  if (!Number.isInteger(modeloId) || modeloId <= 0) {
    return res.status(400).json({ error: "id_modelo es obligatorio" });
  }

  const revisionValue = parseNonNegativeNumber(
    valor_revision,
    "valor_revision",
    res
  );

  if (revisionValue === null) {
    return;
  }

  const manoObraValue = parseNonNegativeNumber(
    valor_mano_obra,
    "valor_mano_obra",
    res
  );

  if (manoObraValue === null) {
    return;
  }

  try {
    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario);

    if (!validateSucursal(adminSucursal, res)) {
      return;
    }

    const duplicateResult = await db.query(
      `SELECT id_precio
      FROM precios_modelo_sucursal
      WHERE id_sucursal = $1
        AND id_modelo = $2
      LIMIT 1`,
      [adminSucursal.id_sucursal, modeloId]
    );

    if (duplicateResult.rows.length > 0) {
      return res.status(400).json({
        error: "Este modelo ya tiene precio configurado para la sucursal"
      });
    }

    const result = await db.query(
      `INSERT INTO precios_modelo_sucursal (
        id_sucursal,
        id_modelo,
        valor_revision,
        valor_mano_obra,
        estado
      )
      VALUES ($1, $2, $3, $4, 'ACTIVO')
      RETURNING id_precio`,
      [adminSucursal.id_sucursal, modeloId, revisionValue, manoObraValue]
    );

    const precioResult = await db.query(
      `${PRECIO_SELECT}
      WHERE pms.id_precio = $1
      LIMIT 1`,
      [result.rows[0].id_precio]
    );

    return res.status(201).json({ precio: precioResult.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        error: "Este modelo ya tiene precio configurado para la sucursal"
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({ error: "Modelo no encontrado" });
    }

    console.error("Error creando precio de sucursal:", error);
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

