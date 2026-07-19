const authRoutes = require("../routes/auth.routes");
const recepcionistasRoutes = require("../routes/recepcionistas.routes");
const ordenesRecepcionRoutes = require("../modules/recepcion-cotizaciones/ordenesRecepcion.routes");
const { createModuleApp } = require("../shared/http/moduleApplication");

module.exports = createModuleApp({
  moduleName: "recepcion-cotizaciones",
  mountRoutes(app) {
    app.use("/api/auth", authRoutes);
    app.use("/api/recepcionistas", recepcionistasRoutes);
    app.use("/api/ordenes", ordenesRecepcionRoutes);
  }
});
