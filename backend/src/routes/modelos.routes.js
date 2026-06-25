const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol("ADMIN"));

async function getAdminSucursal(idUsuario, client = db) {
  const result = await client.query(
    `SELECT
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

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value.toLowerCase() === "si";
  }

  return Boolean(value);
}

const MODELO_PRECIO_SELECT = `SELECT
  pm.id_modelo,
  pm.codigo_comercial,
  pm.descripcion,
  pm.familia,
  pm.marca,
  pm.certificado,
  pms.id_precio,
  pms.id_sucursal,
  s.nombre AS nombre_sucursal,
  pms.valor_revision,
  pms.valor_mano_obra,
  pms.estado
FROM productos_modelo pm
INNER JOIN precios_modelo_sucursal pms ON pms.id_modelo = pm.id_modelo
INNER JOIN sucursales s ON s.id_sucursal = pms.id_sucursal`;

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

router.post("/", async (req, res) => {
  const {
    codigo_comercial,
    descripcion,
    familia = null,
    marca = null,
    certificado = true,
    valor_revision,
    valor_mano_obra = 0
  } = req.body || {};

  const codigoComercial =
    typeof codigo_comercial === "string" ? codigo_comercial.trim() : "";
  const descripcionModelo =
    typeof descripcion === "string" ? descripcion.trim() : "";
  const familiaModelo = typeof familia === "string" ? familia.trim() : familia;
  const marcaModelo = typeof marca === "string" ? marca.trim() : marca;

  if (!codigoComercial) {
    return res.status(400).json({ error: "codigo_comercial es obligatorio" });
  }

  if (!descripcionModelo) {
    return res.status(400).json({ error: "descripcion es obligatoria" });
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

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario, client);

    if (!validateSucursal(adminSucursal, res)) {
      await client.query("ROLLBACK");
      return;
    }

    const duplicateResult = await client.query(
      `SELECT id_modelo
      FROM productos_modelo
      WHERE UPPER(codigo_comercial) = UPPER($1)
      LIMIT 1`,
      [codigoComercial]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Ya existe un modelo con ese código comercial"
      });
    }

    const modeloResult = await client.query(
      `INSERT INTO productos_modelo (
        codigo_comercial,
        descripcion,
        familia,
        marca,
        certificado
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_modelo`,
      [
        codigoComercial,
        descripcionModelo,
        familiaModelo || null,
        marcaModelo || null,
        parseBoolean(certificado)
      ]
    );

    const modeloId = modeloResult.rows[0].id_modelo;

    await client.query(
      `INSERT INTO precios_modelo_sucursal (
        id_sucursal,
        id_modelo,
        valor_revision,
        valor_mano_obra,
        estado
      )
      VALUES ($1, $2, $3, $4, 'ACTIVO')`,
      [adminSucursal.id_sucursal, modeloId, revisionValue, manoObraValue]
    );

    const createdResult = await client.query(
      `${MODELO_PRECIO_SELECT}
      WHERE pm.id_modelo = $1
        AND pms.id_sucursal = $2
      LIMIT 1`,
      [modeloId, adminSucursal.id_sucursal]
    );

    await client.query("COMMIT");

    return res.status(201).json({ modelo: createdResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(400).json({
        error: "Ya existe un modelo con ese código comercial"
      });
    }

    console.error("Error creando modelo de maquina:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

module.exports = router;
