const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "[PostgreSQL] DATABASE_URL no esta configurada. Revisa backend/.env."
  );
}

const pool = new Pool({
  connectionString: databaseUrl
});

pool.on("error", (error) => {
  console.error("[PostgreSQL] Error inesperado en el pool:", error);
});

function query(text, params) {
  return pool.query(text, params).catch((error) => {
    console.error("[PostgreSQL] Error ejecutando consulta:", {
      message: error.message,
      code: error.code
    });
    throw error;
  });
}

module.exports = {
  query,
  pool
};
