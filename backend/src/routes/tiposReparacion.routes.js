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

function parseBoolean(value) {
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

router.get("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, req.usuario.rol)) {
      return;
    }

    const result = await db.query(
      `SELECT
        tr.id_tipo_reparacion,
        tr.id_sucursal,
        s.nombre AS nombre_sucursal,
        tr.nombre,
        tr.descripcion,
        tr.valor_ingreso,
        tr.aplica_garantia,
        tr.estado,
        tr.fecha_creacion
      FROM tipos_reparacion tr
      INNER JOIN sucursales s ON s.id_sucursal = tr.id_sucursal
      WHERE tr.id_sucursal = $1
      ORDER BY tr.nombre ASC`,
      [usuarioSucursal.id_sucursal]
    );

    return res.json({ tipos: result.rows });
  } catch (error) {
    console.error("Error listando tipos de reparacion:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN"), async (req, res) => {
  const nombre = clean(req.body?.nombre);
  const descripcion = clean(req.body?.descripcion) || null;
  const valorIngreso = parseMoney(req.body?.valor_ingreso, res);
  const aplicaGarantia = parseBoolean(req.body?.aplica_garantia);

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
      `INSERT INTO tipos_reparacion (id_sucursal, nombre, descripcion, valor_ingreso, aplica_garantia, estado)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVO')
      RETURNING id_tipo_reparacion, id_sucursal, nombre, descripcion, valor_ingreso, aplica_garantia, estado, fecha_creacion`,
      [usuarioSucursal.id_sucursal, nombre, descripcion, valorIngreso, aplicaGarantia]
    );

    return res.status(201).json({ tipo: result.rows[0] });
  } catch (error) {
    console.error("Error creando tipo de reparacion:", error);
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
      `UPDATE tipos_reparacion
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          valor_ingreso = COALESCE($3, valor_ingreso),
          aplica_garantia = COALESCE($4, aplica_garantia),
          estado = COALESCE($5, estado)
      WHERE id_tipo_reparacion = $6
        AND id_sucursal = $7
      RETURNING id_tipo_reparacion, id_sucursal, nombre, descripcion, valor_ingreso, aplica_garantia, estado, fecha_creacion`,
      [nombre, descripcion, valorIngreso, aplicaGarantia, estado, req.params.id, usuarioSucursal.id_sucursal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tipo de reparacion no encontrado para la sucursal" });
    }

    return res.json({ tipo: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando tipo de reparacion:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;