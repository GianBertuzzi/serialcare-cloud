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

function registerGracefulShutdown(server, moduleName) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`[Shutdown:${moduleName}] ${signal} recibido; cerrando servidor`);

    const timeout = setTimeout(() => {
      console.error(`[Shutdown:${moduleName}] Tiempo de cierre agotado`);
      process.exit(1);
    }, 10000);
    timeout.unref();

    server.close(async (error) => {
      if (error) {
        clearTimeout(timeout);
        console.error(`[Shutdown:${moduleName}] Error cerrando servidor:`, {
          message: error.message,
          code: error.code
        });
        process.exit(1);
        return;
      }

      try {
        await db.pool.end();
        clearTimeout(timeout);
        console.log(`[Shutdown:${moduleName}] Cierre completado`);
        process.exit(0);
      } catch (poolError) {
        clearTimeout(timeout);
        console.error(`[Shutdown:${moduleName}] Error cerrando PostgreSQL:`, {
          message: poolError.message,
          code: poolError.code
        });
        process.exit(1);
      }
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
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

  registerGracefulShutdown(server, moduleName);

  return server;
}

module.exports = { createModuleApp, startModuleServer };
