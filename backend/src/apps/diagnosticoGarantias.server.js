const app = require("./diagnosticoGarantias.app");
const { startModuleServer } = require("../shared/http/moduleApplication");

startModuleServer({
  app,
  moduleName: "diagnostico-garantias",
  portVariable: "PORT_DIAGNOSTICO_GARANTIAS",
  defaultPort: 3003
});
