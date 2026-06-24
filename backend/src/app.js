const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const db = require("./db");
const authRoutes = require("./routes/auth.routes");
const productosRoutes = require("./routes/productos.routes");
const ordenesRoutes = require("./routes/ordenes.routes");
const garantiasRoutes = require("./routes/garantias.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/ordenes", ordenesRoutes);
app.use("/api/garantias", garantiasRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "serialcare-backend"
  });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() AS now");

    return res.json({
      status: "ok",
      message: "conexion OK",
      now: result.rows[0].now
    });
  } catch (error) {
    console.error("[PostgreSQL] Fallo la conexion en /api/db-test:", {
      message: error.message,
      code: error.code
    });

    return res.status(500).json({
      status: "error",
      error: "No se pudo conectar a PostgreSQL"
    });
  }
});

module.exports = app;
