const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getUsuarioSucursal(idUsuario) {
  const result = await db.query(
    `SELECT u.id_sucursal, s.nombre AS nombre_sucursal, s.estado AS estado_sucursal
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

const CLIENTE_SELECT = `SELECT
  c.id_cliente,
  c.id_sucursal,
  s.nombre AS nombre_sucursal,
  c.id_usuario,
  c.nombre,
  c.rut,
  c.telefono,
  c.email,
  c.direccion,
  c.estado,
  c.fecha_creacion,
  COUNT(p.id_producto)::INTEGER AS cantidad_maquinas
FROM clientes c
INNER JOIN sucursales s ON s.id_sucursal = c.id_sucursal
LEFT JOIN productos p ON p.id_cliente = c.id_cliente`;

router.get("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, req.usuario.rol)) {
      return;
    }

    const result = await db.query(
      `${CLIENTE_SELECT}
      WHERE c.id_sucursal = $1
      GROUP BY c.id_cliente, s.nombre
      ORDER BY c.fecha_creacion DESC, c.id_cliente DESC`,
      [usuarioSucursal.id_sucursal]
    );

    return res.json({ clientes: result.rows });
  } catch (error) {
    console.error("Error listando clientes:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id/productos", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, req.usuario.rol)) {
      return;
    }

    const result = await db.query(
      `SELECT
        p.id_producto,
        p.id_cliente,
        p.id_sucursal,
        p.id_tipo_maquina,
        tm.nombre AS tipo_maquina,
        tm.valor_ingreso,
        p.numero_serie,
        p.marca,
        p.modelo,
        p.descripcion,
        p.estado_garantia,
        p.alerta_propiedad,
        p.fecha_registro,
        pm.codigo_comercial,
        pm.descripcion AS descripcion_modelo
      FROM productos p
      LEFT JOIN productos_modelo pm ON pm.id_modelo = p.id_modelo
      LEFT JOIN tipos_maquina tm ON tm.id_tipo_maquina = p.id_tipo_maquina
      WHERE p.id_cliente = $1
        AND p.id_sucursal = $2
      ORDER BY p.fecha_registro DESC`,
      [req.params.id, usuarioSucursal.id_sucursal]
    );

    return res.json({ productos: result.rows });
  } catch (error) {
    console.error("Error listando productos del cliente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN"), async (req, res) => {
  const nombre = clean(req.body?.nombre);
  const rut = clean(req.body?.rut) || null;
  const telefono = clean(req.body?.telefono) || null;
  const email = clean(req.body?.email).toLowerCase() || null;
  const direccion = clean(req.body?.direccion) || null;

  if (!nombre) {
    return res.status(400).json({ error: "nombre es obligatorio" });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const result = await db.query(
      `INSERT INTO clientes (id_sucursal, nombre, rut, telefono, email, direccion, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
      RETURNING
        id_cliente,
        id_sucursal,
        nombre,
        rut,
        telefono,
        email,
        direccion,
        estado,
        fecha_creacion`,
      [usuarioSucursal.id_sucursal, nombre, rut, telefono, email, direccion]
    );

    return res.status(201).json({ cliente: result.rows[0] });
  } catch (error) {
    console.error("Error creando cliente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", verificarRol("ADMIN"), async (req, res) => {
  const nombre = clean(req.body?.nombre) || null;
  const rut = clean(req.body?.rut) || null;
  const telefono = clean(req.body?.telefono) || null;
  const email = clean(req.body?.email).toLowerCase() || null;
  const direccion = clean(req.body?.direccion) || null;
  const estado = clean(req.body?.estado).toUpperCase() || null;

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, "ADMIN")) {
      return;
    }

    const result = await db.query(
      `UPDATE clientes
      SET nombre = COALESCE($1, nombre),
          rut = COALESCE($2, rut),
          telefono = COALESCE($3, telefono),
          email = COALESCE($4, email),
          direccion = COALESCE($5, direccion),
          estado = COALESCE($6, estado)
      WHERE id_cliente = $7
        AND id_sucursal = $8
      RETURNING
        id_cliente,
        id_sucursal,
        nombre,
        rut,
        telefono,
        email,
        direccion,
        estado,
        fecha_creacion`,
      [nombre, rut, telefono, email, direccion, estado, req.params.id, usuarioSucursal.id_sucursal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado para la sucursal" });
    }

    return res.json({ cliente: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando cliente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;