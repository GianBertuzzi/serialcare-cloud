const app = require("./inventarioDocumentos.app");
const { startModuleServer } = require("../shared/http/moduleApplication");

startModuleServer({
  app,
  moduleName: "inventario-documentos",
  portVariable: "PORT_INVENTARIO_DOCUMENTOS",
  defaultPort: 3004
});
