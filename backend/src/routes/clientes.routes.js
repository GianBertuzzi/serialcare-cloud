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
    `SELECT
      u.id_sucursal,
      s.nombre AS nombre_sucursal,
      s.estado AS estado_sucursal,
      r.nombre_rol AS rol
    FROM usuarios u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

function requireSucursal(usuarioSucursal, res, rolesPermitidos) {
  if (!usuarioSucursal?.id_sucursal) {
    res.status(400).json({ error: "El usuario no tiene sucursal asignada" });
    return false;
  }

  if (!rolesPermitidos.includes(usuarioSucursal.rol)) {
    res.status(403).json({ error: "Acceso denegado" });
    return false;
  }

  return true;
}

function parseLimit(value) {
  if (value === undefined) {
    return 100;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 100;
  }

  return Math.min(parsed, 200);
}

async function findClienteByRut(rut, excludedId = null) {
  if (!rut) {
    return null;
  }

  const result = await db.query(
    `SELECT id_cliente
    FROM clientes
    WHERE rut IS NOT NULL
      AND BTRIM(rut) <> ''
      AND UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g')) <> ''
      AND UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g')) =
          UPPER(REGEXP_REPLACE(BTRIM($1), '[^0-9Kk]', '', 'g'))
      AND ($2::INTEGER IS NULL OR id_cliente <> $2)
    LIMIT 1`,
    [rut, excludedId]
  );

  return result.rows[0] || null;
}

function isRutUniqueViolation(error) {
  return error.code === "23505" && error.constraint === "ux_clientes_rut_normalizado";
}

const CLIENTE_SELECT = `SELECT
  c.id_cliente,
  c.id_sucursal,
  c.id_sucursal AS id_sucursal_registro,
  s.nombre AS nombre_sucursal,
  s.nombre AS nombre_sucursal_registro,
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

router.get("/", verificarRol("ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const search = clean(req.query?.search);
  const limit = parseLimit(req.query?.limit);

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, ["ADMIN", "RECEPCIONISTA"])) {
      return;
    }

    const result = await db.query(
      `${CLIENTE_SELECT}
      WHERE (
        $1 = ''
        OR c.nombre ILIKE '%' || $1 || '%'
        OR COALESCE(c.telefono, '') ILIKE '%' || $1 || '%'
        OR COALESCE(c.email, '') ILIKE '%' || $1 || '%'
        OR (
          c.rut IS NOT NULL
          AND UPPER(REGEXP_REPLACE(BTRIM($1), '[^0-9Kk]', '', 'g')) <> ''
          AND UPPER(REGEXP_REPLACE(BTRIM(c.rut), '[^0-9Kk]', '', 'g')) LIKE
              '%' || UPPER(REGEXP_REPLACE(BTRIM($1), '[^0-9Kk]', '', 'g')) || '%'
        )
      )
      GROUP BY c.id_cliente, s.nombre
      ORDER BY c.nombre ASC, c.id_cliente ASC
      LIMIT $2`,
      [search, limit]
    );

    return res.json({ clientes: result.rows });
  } catch (error) {
    console.error("Error listando clientes:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id/productos", verificarRol("ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const idCliente = Number(req.params.id);

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    return res.status(400).json({ error: "id de cliente invalido" });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, ["ADMIN", "RECEPCIONISTA"])) {
      return;
    }

    const clienteResult = await db.query(
      "SELECT id_cliente FROM clientes WHERE id_cliente = $1 LIMIT 1",
      [idCliente]
    );

    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const result = await db.query(
      `SELECT
        p.id_producto,
        p.id_cliente,
        p.id_sucursal,
        p.id_sucursal AS id_sucursal_registro,
        s.nombre AS nombre_sucursal,
        s.nombre AS nombre_sucursal_registro,
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
      INNER JOIN sucursales s ON s.id_sucursal = p.id_sucursal
      LEFT JOIN productos_modelo pm ON pm.id_modelo = p.id_modelo
      LEFT JOIN tipos_maquina tm ON tm.id_tipo_maquina = p.id_tipo_maquina
      WHERE p.id_cliente = $1
      ORDER BY p.fecha_registro DESC, p.id_producto DESC`,
      [idCliente]
    );

    return res.json({ productos: result.rows });
  } catch (error) {
    console.error("Error listando productos del cliente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN", "RECEPCIONISTA"), async (req, res) => {
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

    if (!requireSucursal(usuarioSucursal, res, ["ADMIN", "RECEPCIONISTA"])) {
      return;
    }

    if (await findClienteByRut(rut)) {
      return res.status(409).json({ error: "Ya existe un cliente con ese RUT" });
    }

    const result = await db.query(
      `INSERT INTO clientes (id_sucursal, nombre, rut, telefono, email, direccion, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
      RETURNING
        id_cliente,
        id_sucursal,
        id_sucursal AS id_sucursal_registro,
        nombre,
        rut,
        telefono,
        email,
        direccion,
        estado,
        fecha_creacion`,
      [usuarioSucursal.id_sucursal, nombre, rut, telefono, email, direccion]
    );

    return res.status(201).json({
      cliente: {
        ...result.rows[0],
        nombre_sucursal: usuarioSucursal.nombre_sucursal,
        nombre_sucursal_registro: usuarioSucursal.nombre_sucursal
      }
    });
  } catch (error) {
    if (isRutUniqueViolation(error)) {
      return res.status(409).json({ error: "Ya existe un cliente con ese RUT" });
    }

    console.error("Error creando cliente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", verificarRol("ADMIN"), async (req, res) => {
  const idCliente = Number(req.params.id);
  const nombre = clean(req.body?.nombre) || null;
  const rut = clean(req.body?.rut) || null;
  const telefono = clean(req.body?.telefono) || null;
  const email = clean(req.body?.email).toLowerCase() || null;
  const direccion = clean(req.body?.direccion) || null;
  const estado = clean(req.body?.estado).toUpperCase() || null;

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    return res.status(400).json({ error: "id de cliente invalido" });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res, ["ADMIN"])) {
      return;
    }

    const clienteResult = await db.query(
      `SELECT id_cliente
      FROM clientes
      WHERE id_cliente = $1
        AND id_sucursal = $2
      LIMIT 1`,
      [idCliente, usuarioSucursal.id_sucursal]
    );

    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado para la sucursal" });
    }

    if (rut && await findClienteByRut(rut, idCliente)) {
      return res.status(409).json({ error: "Ya existe un cliente con ese RUT" });
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
        id_sucursal AS id_sucursal_registro,
        nombre,
        rut,
        telefono,
        email,
        direccion,
        estado,
        fecha_creacion`,
      [nombre, rut, telefono, email, direccion, estado, idCliente, usuarioSucursal.id_sucursal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado para la sucursal" });
    }

    return res.json({
      cliente: {
        ...result.rows[0],
        nombre_sucursal: usuarioSucursal.nombre_sucursal,
        nombre_sucursal_registro: usuarioSucursal.nombre_sucursal
      }
    });
  } catch (error) {
    if (isRutUniqueViolation(error)) {
      return res.status(409).json({ error: "Ya existe un cliente con ese RUT" });
    }

    console.error("Error actualizando cliente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;