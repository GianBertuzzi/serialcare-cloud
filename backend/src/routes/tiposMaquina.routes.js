const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseMoney(value, res) {
  const numberValue = value === undefined || value === null || value === "" ? 0 : Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    res.status(400).json({ error: "valor_ingreso debe ser numero mayor o igual a 0" });
    return null;
  }

  return Math.round(numberValue);
}

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "si", "1"].includes(value.toLowerCase());
  return Boolean(value);
}

async function getUsuarioSucursal(idUsuario) {
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

function requireSucursal(usuarioSucursal, res, rol = "usuario") {
  if (!usuarioSucursal?.id_sucursal) {
    res.status(400).json({ error: `El ${rol} no tiene sucursal asignada` });
    return false;
  }

  return true;
}

const SELECT_TIPOS = `SELECT
  tm.id_tipo_maquina,
  tm.id_sucursal,
  s.nombre AS nombre_sucursal,
  tm.nombre,
  tm.descripcion,
  tm.valor_ingreso,
  tm.aplica_garantia,
  tm.estado,
  tm.fecha_creacion
FROM tipos_maquina tm
INNER JOIN sucursales s ON s.id_sucursal = tm.id_sucursal`;

router.get("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, req.usuario.rol)) {
      return;
    }

    const result = await db.query(
      `${SELECT_TIPOS}
      WHERE tm.id_sucursal = $1
      ORDER BY tm.nombre ASC`,
      [usuarioSucursal.id_sucursal]
    );

    return res.json({ tipos: result.rows, tipos_maquina: result.rows });
  } catch (error) {
    console.error("Error listando tipos de maquina:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN"), async (req, res) => {
  const nombre = clean(req.body?.nombre);
  const descripcion = clean(req.body?.descripcion) || null;
  const valorIngreso = parseMoney(req.body?.valor_ingreso, res);
  const aplicaGarantia = parseBoolean(req.body?.aplica_garantia, true);
  const estado = clean(req.body?.estado).toUpperCase() || "ACTIVO";

  if (!nombre) {
    return res.status(400).json({ error: "nombre es obligatorio" });
  }

  if (valorIngreso === null) {
    return;
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const result = await db.query(
      `INSERT INTO tipos_maquina (id_sucursal, nombre, descripcion, valor_ingreso, aplica_garantia, estado)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_tipo_maquina`,
      [usuarioSucursal.id_sucursal, nombre, descripcion, valorIngreso, aplicaGarantia, estado]
    );

    const tipoResult = await db.query(`${SELECT_TIPOS} WHERE tm.id_tipo_maquina = $1`, [result.rows[0].id_tipo_maquina]);
    return res.status(201).json({ tipo: tipoResult.rows[0], tipo_maquina: tipoResult.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Ya existe un tipo de maquina con ese nombre en la sucursal" });
    }

    console.error("Error creando tipo de maquina:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", verificarRol("ADMIN"), async (req, res) => {
  const nombre = req.body?.nombre === undefined ? null : clean(req.body.nombre);
  const descripcion = req.body?.descripcion === undefined ? null : clean(req.body.descripcion);
  const valorIngreso = req.body?.valor_ingreso === undefined ? null : parseMoney(req.body.valor_ingreso, res);
  const aplicaGarantia = req.body?.aplica_garantia === undefined ? null : parseBoolean(req.body.aplica_garantia);
  const estado = req.body?.estado === undefined ? null : clean(req.body.estado).toUpperCase();

  if (valorIngreso === null && req.body?.valor_ingreso !== undefined) {
    return;
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const result = await db.query(
      `UPDATE tipos_maquina
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          valor_ingreso = COALESCE($3, valor_ingreso),
          aplica_garantia = COALESCE($4, aplica_garantia),
          estado = COALESCE($5, estado)
      WHERE id_tipo_maquina = $6
        AND id_sucursal = $7
      RETURNING id_tipo_maquina`,
      [nombre, descripcion, valorIngreso, aplicaGarantia, estado, req.params.id, usuarioSucursal.id_sucursal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tipo de maquina no encontrado para la sucursal" });
    }

    const tipoResult = await db.query(`${SELECT_TIPOS} WHERE tm.id_tipo_maquina = $1`, [result.rows[0].id_tipo_maquina]);
    return res.json({ tipo: tipoResult.rows[0], tipo_maquina: tipoResult.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Ya existe un tipo de maquina con ese nombre en la sucursal" });
    }

    console.error("Error actualizando tipo de maquina:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;