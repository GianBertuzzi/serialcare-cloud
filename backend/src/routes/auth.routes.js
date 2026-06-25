const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");

const router = express.Router();

function publicUser(user) {
  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    estado: user.estado,
    id_sucursal: user.id_sucursal || null,
    nombre_sucursal: user.nombre_sucursal || null
  };
}

const USER_SELECT = `SELECT
  u.id_usuario,
  u.nombre,
  u.email,
  u.password_hash,
  u.id_rol,
  u.id_sucursal,
  s.nombre AS nombre_sucursal,
  u.estado,
  r.nombre_rol AS rol
FROM usuarios u
INNER JOIN roles r ON r.id_rol = u.id_rol
LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal`;

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const emailLogin = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!emailLogin || !password) {
    return res.status(400).json({ error: "Email y password son obligatorios" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET no configurado" });
  }

  try {
    const result = await db.query(
      `${USER_SELECT}
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1`,
      [emailLogin]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      console.error("Error en login: usuario sin password_hash", {
        id_usuario: user.id_usuario,
        email: user.email
      });
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (user.estado !== "ACTIVO") {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        email: user.email,
        rol: user.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      usuario: publicUser(user)
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/me", verificarToken, async (req, res) => {
  try {
    const result = await db.query(
      `${USER_SELECT}
      WHERE u.id_usuario = $1
      LIMIT 1`,
      [req.usuario.id_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json({ usuario: publicUser(result.rows[0]) });
  } catch (error) {
    console.error("Error obteniendo usuario autenticado:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;