const garantiasRoutes = require("../routes/garantias.routes");
const tiposReparacionRoutes = require("../routes/tiposReparacion.routes");
const tecnicosRoutes = require("../routes/tecnicos.routes");
const ordenesDiagnosticoRoutes = require("../modules/diagnostico-garantias/ordenesDiagnostico.routes");
const { createModuleApp } = require("../shared/http/moduleApplication");

module.exports = createModuleApp({
  moduleName: "diagnostico-garantias",
  mountRoutes(app) {
    app.use("/api/garantias", garantiasRoutes);
    app.use("/api/tipos-reparacion", tiposReparacionRoutes);
    app.use("/api/tecnicos", tecnicosRoutes);
    app.use("/api/ordenes", ordenesDiagnosticoRoutes);
  }
});
