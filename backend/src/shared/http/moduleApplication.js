const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("../../db");

function getAllowedOrigins() {
  return (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createModuleApp({ moduleName, mountRoutes }) {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = getAllowedOrigins();

  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true
  }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => res.status(200).json({
    status: "ok",
    module: moduleName
  }));

  app.get("/health/db", async (req, res) => {
    try {
      await db.query("SELECT 1");
      return res.status(200).json({
        status: "ok",
        module: moduleName,
        database: "ok"
      });
    } catch (error) {
      console.error(`[Health:${moduleName}] PostgreSQL no responde:`, {
        message: error.message,
        code: error.code
      });
      return res.status(503).json({
        status: "error",
        module: moduleName,
        database: "unavailable"
      });
    }
  });

  mountRoutes(app);

  app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    console.error(`[Express:${moduleName}] Error no controlado:`, {
      message: error.message,
      stack: isProduction ? undefined : error.stack
    });

    return res.status(error.status || 500).json({
      error: isProduction ? "Error interno del servidor" : error.message
    });
  });

  return app;
}

function getModulePort(portVariable, defaultPort) {
  const configuredValue = process.env[portVariable];
  const port = configuredValue === undefined || configuredValue.trim() === ""
    ? defaultPort
    : Number(configuredValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${portVariable} debe ser un puerto valido entre 1 y 65535`);
  }

  return port;
}

function startModuleServer({ app, moduleName, portVariable, defaultPort }) {
  if (!process.env.JWT_SECRET) {
    console.error(`[Config:${moduleName}] JWT_SECRET no esta configurado`);
    process.exitCode = 1;
    return null;
  }

  let port;
  try {
    port = getModulePort(portVariable, defaultPort);
  } catch (error) {
    console.error(`[Config:${moduleName}] ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const server = app.listen(port, () => {
    console.log(`SerialCare ${moduleName} running on port ${port}`);
  });

  server.on("error", (error) => {
    console.error(`[Server:${moduleName}] No se pudo iniciar:`, {
      message: error.message,
      code: error.code
    });
    process.exitCode = 1;
  });

  return server;
}

module.exports = { createModuleApp, startModuleServer };
