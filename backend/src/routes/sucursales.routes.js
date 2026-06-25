const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol("MARCA"));

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function publicSucursal(row) {
  return {
    id_sucursal: row.id_sucursal,
    nombre: row.nombre,
    ciudad: row.ciudad,
    region: row.region,
    direccion: row.direccion,
    estado: row.estado
  };
}

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        s.id_sucursal,
        s.nombre,
        s.ciudad,
        s.region,
        s.direccion,
        s.costo_ingreso_taller,
        s.estado,
        s.fecha_creacion,
        admin_user.nombre AS admin_nombre,
        admin_user.email AS admin_email
      FROM sucursales s
      LEFT JOIN LATERAL (
        SELECT u.nombre, u.email
        FROM usuarios u
        INNER JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_sucursal = s.id_sucursal
          AND r.nombre_rol = 'ADMIN'
        ORDER BY u.fecha_creacion ASC, u.id_usuario ASC
        LIMIT 1
      ) admin_user ON TRUE
      ORDER BY s.id_sucursal ASC`
    );

    return res.json({ sucursales: result.rows });
  } catch (error) {
    console.error("Error listando sucursales:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", async (req, res) => {
  const nombre = cleanString(req.body?.nombre);
  const ciudad = cleanString(req.body?.ciudad);
  const region = cleanString(req.body?.region);
  const direccion = cleanString(req.body?.direccion) || null;
  const adminNombre = cleanString(req.body?.admin_nombre);
  const adminEmail = cleanString(req.body?.admin_email).toLowerCase();
  const adminPassword =
    typeof req.body?.admin_password === "string" ? req.body.admin_password : "";

  if (!nombre) {
    return res.status(400).json({ error: "nombre es obligatorio" });
  }

  if (!ciudad) {
    return res.status(400).json({ error: "ciudad es obligatoria" });
  }

  if (!region) {
    return res.status(400).json({ error: "region es obligatoria" });
  }

  if (!adminNombre) {
    return res.status(400).json({ error: "admin_nombre es obligatorio" });
  }

  if (!adminEmail) {
    return res.status(400).json({ error: "admin_email es obligatorio" });
  }

  if (!adminPassword) {
    return res.status(400).json({ error: "admin_password es obligatorio" });
  }

  if (adminPassword.length < 6) {
    return res.status(400).json({
      error: "admin_password debe tener minimo 6 caracteres"
    });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `SELECT id_usuario
      FROM usuarios
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Ya existe un usuario con ese correo"
      });
    }

    const rolResult = await client.query(
      `SELECT id_rol
      FROM roles
      WHERE nombre_rol = 'ADMIN'
      LIMIT 1`
    );

    if (rolResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        error: "Rol ADMIN no configurado"
      });
    }

    const sucursalResult = await client.query(
      `INSERT INTO sucursales (
        nombre,
        ciudad,
        region,
        direccion,
        estado
      )
      VALUES ($1, $2, $3, $4, 'ACTIVA')
      RETURNING
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        estado`,
      [nombre, ciudad, region, direccion]
    );

    const sucursal = sucursalResult.rows[0];
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const adminResult = await client.query(
      `INSERT INTO usuarios (
        nombre,
        email,
        password_hash,
        id_rol,
        id_sucursal,
        estado
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVO')
      RETURNING
        id_usuario,
        nombre,
        email,
        id_sucursal`,
      [
        adminNombre,
        adminEmail,
        passwordHash,
        rolResult.rows[0].id_rol,
        sucursal.id_sucursal
      ]
    );

    await client.query("COMMIT");

    const admin = adminResult.rows[0];

    return res.status(201).json({
      sucursal: publicSucursal(sucursal),
      admin: {
        id_usuario: admin.id_usuario,
        nombre: admin.nombre,
        email: admin.email,
        rol: "ADMIN",
        id_sucursal: admin.id_sucursal
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Ya existe un usuario con ese correo"
      });
    }

    console.error("Error creando sucursal con admin inicial:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    nombre = null,
    ciudad = null,
    region = null,
    direccion = null,
    costo_ingreso_taller = null,
    estado = null
  } = req.body || {};

  try {
    const result = await db.query(
      `UPDATE sucursales
      SET nombre = COALESCE($1, nombre),
          ciudad = COALESCE($2, ciudad),
          region = COALESCE($3, region),
          direccion = COALESCE($4, direccion),
          costo_ingreso_taller = COALESCE($5, costo_ingreso_taller),
          estado = COALESCE($6, estado)
      WHERE id_sucursal = $7
      RETURNING
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado,
        fecha_creacion`,
      [nombre, ciudad, region, direccion, costo_ingreso_taller, estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }

    return res.json({ sucursal: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/activar", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE sucursales
      SET estado = 'ACTIVA'
      WHERE id_sucursal = $1
      RETURNING
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado,
        fecha_creacion`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }

    return res.json({ sucursal: result.rows[0] });
  } catch (error) {
    console.error("Error activando sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/desactivar", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE sucursales
      SET estado = 'INACTIVA'
      WHERE id_sucursal = $1
      RETURNING
        id_sucursal,
        nombre,
        ciudad,
        region,
        direccion,
        costo_ingreso_taller,
        estado,
        fecha_creacion`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }

    return res.json({ sucursal: result.rows[0] });
  } catch (error) {
    console.error("Error desactivando sucursal:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;