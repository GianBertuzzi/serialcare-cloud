function verificarRol(...rolesPermitidos) {
  const roles = rolesPermitidos.flat();

  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    return next();
  };
}

module.exports = verificarRol;
