const app = require("./clientesMaquinas.app");
const { startModuleServer } = require("../shared/http/moduleApplication");

startModuleServer({
  app,
  moduleName: "clientes-maquinas",
  portVariable: "PORT_CLIENTES_MAQUINAS",
  defaultPort: 3001
});
