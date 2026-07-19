const bcrypt = require("bcrypt");
const fs = require("fs/promises");
const path = require("path");
const { pool } = require("../db");

const databaseDirectory = path.resolve(__dirname, "..", "..", "..", "database");
const migrationsDirectory = path.join(databaseDirectory, "migrations");
const bootstrapPath = path.join(databaseDirectory, "bootstrap.sql");
const bootstrapSeedPath = path.join(databaseDirectory, "bootstrap-seed.sql");
const advisoryLockName = "serialcare_database_initialize";
const baseTables = [
  "roles",
  "sucursales",
  "usuarios",
  "clientes",
  "productos_modelo",
  "precios_modelo_sucursal",
  "tipos_maquina",
  "productos",
  "repuestos",
  "tipos_reparacion",
  "ordenes_servicio",
  "repuestos_usados",
  "cotizaciones",
  "evidencias_orden",
  "garantias"
];

async function listMigrationFiles() {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second, "en"));
}

async function inspectBaseSchema(client) {
  const existingResult = await client.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = current_schema()
       AND tablename = ANY($1::text[])
     ORDER BY tablename`,
    [baseTables]
  );
  const existingTables = new Set(existingResult.rows.map((row) => row.tablename));

  if (existingTables.size === baseTables.length) {
    return "existing";
  }

  if (existingTables.size > 0) {
    const missingTables = baseTables.filter((table) => !existingTables.has(table));
    throw new Error(
      "Esquema base parcial; faltan tablas: " + missingTables.join(", ")
    );
  }

  const otherTablesResult = await client.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = current_schema()
       AND tablename <> 'schema_migrations'
     ORDER BY tablename`
  );

  if (otherTablesResult.rows.length > 0) {
    throw new Error(
      "La base no esta vacia y no contiene el esquema SerialCare esperado: " +
        otherTablesResult.rows.map((row) => row.tablename).join(", ")
    );
  }

  return "empty";
}

async function resolveAdminPasswordHash() {
  const configuredHash = String(process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH || "").trim();
  const configuredPassword = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "");

  if (configuredHash && configuredPassword) {
    throw new Error(
      "Configure solo BOOTSTRAP_ADMIN_PASSWORD o BOOTSTRAP_ADMIN_PASSWORD_HASH, no ambos."
    );
  }

  if (configuredHash) {
    try {
      bcrypt.getRounds(configuredHash);
    } catch {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD_HASH no es un hash bcrypt valido.");
    }
    return configuredHash;
  }

  if (configuredPassword.length < 8) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 8 caracteres para una base nueva."
    );
  }

  const passwordHash = await bcrypt.hash(configuredPassword, 12);
  process.env.BOOTSTRAP_ADMIN_PASSWORD = "";
  return passwordHash;
}

async function provisionInitialAdmin(client) {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const name = String(
    process.env.BOOTSTRAP_ADMIN_NAME || "Administrador SerialCare"
  ).trim();

  if (!email || !email.includes("@")) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL es obligatorio para una base nueva.");
  }

  if (!name) {
    throw new Error("BOOTSTRAP_ADMIN_NAME no puede estar vacio.");
  }

  const passwordHash = await resolveAdminPasswordHash();
  const result = await client.query(
    `WITH admin_input AS (
       SELECT $1::text AS nombre, $2::text AS email, $3::text AS password_hash
     )
     INSERT INTO usuarios (
       nombre, email, password_hash, id_rol, id_sucursal, estado
     )
     SELECT input.nombre, input.email, input.password_hash,
       r.id_rol, s.id_sucursal, 'ACTIVO'
     FROM admin_input input
     INNER JOIN roles r ON r.nombre_rol = 'ADMIN'
     INNER JOIN sucursales s ON s.id_sucursal = 1
     WHERE NOT EXISTS (
       SELECT 1 FROM usuarios u WHERE LOWER(u.email) = LOWER(input.email)
     )
     RETURNING id_usuario`,
    [name, email, passwordHash]
  );

  if (result.rowCount !== 1) {
    throw new Error("No fue posible crear el ADMIN inicial.");
  }

  console.log("[Database] ADMIN inicial creado desde variables de entorno.");
}

async function bootstrapDatabase(client) {
  const bootstrapSql = await fs.readFile(bootstrapPath, "utf8");
  const seedSql = await fs.readFile(bootstrapSeedPath, "utf8");

  await client.query("BEGIN");

  try {
    await client.query(bootstrapSql);
    await client.query(seedSql);
    await provisionInitialAdmin(client);
    await client.query("COMMIT");
    console.log("[Database] Bootstrap base completado.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
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

async function initializeDatabase() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      advisoryLockName
    ]);
    lockAcquired = true;

    const baseState = await inspectBaseSchema(client);
    if (baseState === "empty") {
      console.log("[Database] Base vacia detectada; ejecutando bootstrap seguro.");
      await bootstrapDatabase(client);
    } else {
      console.log("[Database] Esquema base existente; bootstrap omitido.");
    }

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

initializeDatabase()
  .catch((error) => {
    console.error("[Database] Inicializacion fallida:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
