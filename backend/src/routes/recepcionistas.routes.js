const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");
const {
  getAdminSucursal,
  requireAdminSucursal
} = require("../services/adminSucursal.service");

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol("ADMIN"));

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

const RECEPCIONISTA_SELECT = `SELECT
  u.id_usuario,
  u.nombre,
  u.email,
  u.id_sucursal,
  s.nombre AS nombre_sucursal,
  u.estado,
  u.fecha_creacion
FROM usuarios u
INNER JOIN roles r ON r.id_rol = u.id_rol
LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal`;

router.get("/", async (req, res) => {
  try {
    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario);

    if (!requireAdminSucursal(adminSucursal, res)) {
      return;
    }

    const result = await db.query(
      `${RECEPCIONISTA_SELECT}
      WHERE r.nombre_rol = 'RECEPCIONISTA'
        AND u.id_sucursal = $1
      ORDER BY u.fecha_creacion DESC, u.id_usuario DESC`,
      [adminSucursal.id_sucursal]
    );

    return res.json({ recepcionistas: result.rows });
  } catch (error) {
    console.error("Error listando recepcionistas:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req, res) => {
  const nombre = clean(req.body?.nombre);
  const email = clean(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!nombre) {
    return res.status(400).json({ error: "nombre es obligatorio" });
  }

  if (!email) {
    return res.status(400).json({ error: "email es obligatorio" });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "password debe tener minimo 8 caracteres" });
  }

  try {
    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario);

    if (!requireAdminSucursal(adminSucursal, res)) {
      return;
    }

    const rolResult = await db.query(
      "SELECT id_rol FROM roles WHERE nombre_rol = 'RECEPCIONISTA' LIMIT 1"
    );

    if (rolResult.rows.length === 0) {
      return res.status(500).json({ error: "Rol RECEPCIONISTA no configurado" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, id_rol, id_sucursal, estado)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVO')
      RETURNING id_usuario, nombre, email, id_sucursal, estado, fecha_creacion`,
      [nombre, email, hash, rolResult.rows[0].id_rol, adminSucursal.id_sucursal]
    );

    return res.status(201).json({ recepcionista: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
    }

    console.error("Error creando recepcionista:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id", async (req, res) => {
  const idRecepcionista = Number(req.params.id);
  const camposPermitidos = new Set(["nombre", "estado"]);
  const camposInvalidos = Object.keys(req.body || {}).filter(
    (campo) => !camposPermitidos.has(campo)
  );

  if (!Number.isInteger(idRecepcionista) || idRecepcionista <= 0) {
    return res.status(400).json({ error: "id de recepcionista invalido" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite modificar nombre y estado" });
  }

  const tieneNombre = Object.prototype.hasOwnProperty.call(req.body || {}, "nombre");
  const tieneEstado = Object.prototype.hasOwnProperty.call(req.body || {}, "estado");
  const nombre = tieneNombre ? clean(req.body.nombre) : null;
  const estado = tieneEstado ? clean(req.body.estado).toUpperCase() : null;

  if (!tieneNombre && !tieneEstado) {
    return res.status(400).json({ error: "nombre o estado es obligatorio" });
  }

  if (tieneNombre && !nombre) {
    return res.status(400).json({ error: "nombre no puede estar vacio" });
  }

  if (tieneEstado && !["ACTIVO", "INACTIVO"].includes(estado)) {
    return res.status(400).json({ error: "estado debe ser ACTIVO o INACTIVO" });
  }

  try {
    const adminSucursal = await getAdminSucursal(req.usuario.id_usuario);

    if (!requireAdminSucursal(adminSucursal, res)) {
      return;
    }

    const result = await db.query(
      `UPDATE usuarios u
      SET nombre = COALESCE($1, u.nombre),
          estado = COALESCE($2, u.estado)
      FROM roles r
      WHERE u.id_rol = r.id_rol
        AND r.nombre_rol = 'RECEPCIONISTA'
        AND u.id_usuario = $3
        AND u.id_sucursal = $4
      RETURNING u.id_usuario, u.nombre, u.email, u.id_sucursal, u.estado, u.fecha_creacion`,
      [nombre, estado, idRecepcionista, adminSucursal.id_sucursal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Recepcionista no encontrado para la sucursal"
      });
    }

    return res.json({ recepcionista: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando recepcionista:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
