const clientesRoutes = require("../routes/clientes.routes");
const productosRoutes = require("../routes/productos.routes");
const modelosRoutes = require("../routes/modelos.routes");
const preciosSucursalRoutes = require("../routes/preciosSucursal.routes");
const tiposMaquinaRoutes = require("../routes/tiposMaquina.routes");
const { createModuleApp } = require("../shared/http/moduleApplication");

module.exports = createModuleApp({
  moduleName: "clientes-maquinas",
  mountRoutes(app) {
    app.use("/api/clientes", clientesRoutes);
    app.use("/api/productos", productosRoutes);
    app.use("/api/modelos", modelosRoutes);
    app.use("/api/precios-sucursal", preciosSucursalRoutes);
    app.use("/api/tipos-maquina", tiposMaquinaRoutes);
  }
});
