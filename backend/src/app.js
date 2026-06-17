const express = require("express");
const cors = require("cors");
require("dotenv").config();
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

module.exports = app;
