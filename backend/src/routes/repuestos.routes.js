const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseMoney(value, fieldName, res) {
  const numberValue = value === undefined || value === null || value === "" ? 0 : Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    res.status(400).json({ error: `${fieldName} debe ser numero mayor o igual a 0` });
    return null;
  }

  return Math.round(numberValue);
}

function parseStock(value, res) {
  const numberValue = value === undefined || value === null || value === "" ? 0 : Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    res.status(400).json({ error: "stock debe ser numero entero mayor o igual a 0" });
    return null;
  }

  return numberValue;
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
        r.id_repuesto,
        r.id_sucursal,
        s.nombre AS nombre_sucursal,
        r.codigo,
        r.nombre,
        r.marca,
        r.precio,
        r.stock,
        r.estado,
        r.fecha_creacion
      FROM repuestos r
      INNER JOIN sucursales s ON s.id_sucursal = r.id_sucursal
      WHERE r.id_sucursal = $1
      ORDER BY r.nombre ASC`,
      [usuarioSucursal.id_sucursal]
    );

    return res.json({ repuestos: result.rows });
  } catch (error) {
    console.error("Error listando repuestos:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN"), async (req, res) => {
  const codigo = clean(req.body?.codigo) || null;
  const nombre = clean(req.body?.nombre);
  const marca = clean(req.body?.marca) || null;
  const precio = parseMoney(req.body?.precio, "precio", res);
  const stock = parseStock(req.body?.stock, res);

  if (!nombre) {
    return res.status(400).json({ error: "nombre es obligatorio" });
  }

  if (precio === null || stock === null) {
    return;
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const result = await db.query(
      `INSERT INTO repuestos (id_sucursal, codigo, nombre, marca, precio, stock, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
      RETURNING id_repuesto, id_sucursal, codigo, nombre, marca, precio, stock, estado, fecha_creacion`,
      [usuarioSucursal.id_sucursal, codigo, nombre, marca, precio, stock]
    );

    return res.status(201).json({ repuesto: result.rows[0] });
  } catch (error) {
    console.error("Error creando repuesto:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", verificarRol("ADMIN"), async (req, res) => {
  const codigo = req.body?.codigo === undefined ? null : clean(req.body.codigo);
  const nombre = req.body?.nombre === undefined ? null : clean(req.body.nombre);
  const marca = req.body?.marca === undefined ? null : clean(req.body.marca);
  const precio = req.body?.precio === undefined ? null : parseMoney(req.body.precio, "precio", res);
  const stock = req.body?.stock === undefined ? null : parseStock(req.body.stock, res);
  const estado = req.body?.estado === undefined ? null : clean(req.body.estado).toUpperCase();

  if (precio === null && req.body?.precio !== undefined) return;
  if (stock === null && req.body?.stock !== undefined) return;

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const result = await db.query(
      `UPDATE repuestos
      SET codigo = COALESCE($1, codigo),
          nombre = COALESCE($2, nombre),
          marca = COALESCE($3, marca),
          precio = COALESCE($4, precio),
          stock = COALESCE($5, stock),
          estado = COALESCE($6, estado)
      WHERE id_repuesto = $7
        AND id_sucursal = $8
      RETURNING id_repuesto, id_sucursal, codigo, nombre, marca, precio, stock, estado, fecha_creacion`,
      [codigo, nombre, marca, precio, stock, estado, req.params.id, usuarioSucursal.id_sucursal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Repuesto no encontrado para la sucursal" });
    }

    return res.json({ repuesto: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando repuesto:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;