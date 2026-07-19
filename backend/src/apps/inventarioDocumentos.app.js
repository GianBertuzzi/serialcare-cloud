const repuestosRoutes = require("../routes/repuestos.routes");
const ordenesInventarioRoutes = require("../modules/inventario-documentos/ordenesInventario.routes");
const { createModuleApp } = require("../shared/http/moduleApplication");

module.exports = createModuleApp({
  moduleName: "inventario-documentos",
  mountRoutes(app) {
    app.use("/api/repuestos", repuestosRoutes);
    app.use("/api/ordenes", ordenesInventarioRoutes);
  }
});
