const fs = require("fs/promises");
const path = require("path");
const { pool } = require("../db");

const migrationsDirectory = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "database",
  "migrations"
);
const advisoryLockName = "serialcare_schema_migrations";

async function listMigrationFiles() {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second, "en"));
}

async function ensureMigrationsTable(client) {
  await client.query("BEGIN");

  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (" +
        "filename TEXT PRIMARY KEY, " +
        "executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP" +
      ")"
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runMigration(client, filename) {
  const migrationPath = path.join(migrationsDirectory, filename);
  const sql = await fs.readFile(migrationPath, "utf8");

  await client.query("BEGIN");

  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [filename]
    );
    await client.query("COMMIT");
    console.log("[Migrations] Ejecutada: " + filename);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function migrate() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      advisoryLockName
    ]);
    lockAcquired = true;

    await ensureMigrationsTable(client);

    const migrationFiles = await listMigrationFiles();
    const executedResult = await client.query(
      "SELECT filename FROM schema_migrations"
    );
    const executedMigrations = new Set(
      executedResult.rows.map((row) => row.filename)
    );
    const pendingMigrations = migrationFiles.filter(
      (filename) => !executedMigrations.has(filename)
    );

    if (pendingMigrations.length === 0) {
      console.log("[Migrations] No hay migraciones pendientes.");
      return;
    }

    for (const filename of pendingMigrations) {
      await runMigration(client, filename);
    }

    console.log("[Migrations] Completadas: " + pendingMigrations.length);
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
        advisoryLockName
      ]);
    }

    client.release();
  }
}

migrate()
  .catch((error) => {
    console.error("[Migrations] Error:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
