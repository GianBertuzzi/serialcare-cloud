const app = require("./recepcionCotizaciones.app");
const { startModuleServer } = require("../shared/http/moduleApplication");

startModuleServer({
  app,
  moduleName: "recepcion-cotizaciones",
  portVariable: "PORT_RECEPCION_COTIZACIONES",
  defaultPort: 3002
});
