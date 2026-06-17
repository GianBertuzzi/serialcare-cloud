DROP TABLE IF EXISTS garantias CASCADE;
DROP TABLE IF EXISTS ordenes_servicio CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
  id_rol SERIAL PRIMARY KEY,
  nombre_rol VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  id_rol INTEGER NOT NULL REFERENCES roles(id_rol),
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productos (
  id_producto SERIAL PRIMARY KEY,
  numero_serie VARCHAR(80) NOT NULL,
  marca VARCHAR(80) NOT NULL,
  modelo VARCHAR(80) NOT NULL,
  id_cliente INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  estado_garantia VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  alerta_propiedad BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ordenes_servicio (
  id_orden SERIAL PRIMARY KEY,
  id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
  id_tecnico INTEGER NOT NULL REFERENCES usuarios(id_usuario),
  diagnostico TEXT NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'ABIERTA',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE garantias (
  id_garantia SERIAL PRIMARY KEY,
  id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  observacion TEXT,
  fecha_revision TIMESTAMP
);

CREATE UNIQUE INDEX idx_usuarios_email ON usuarios(email);
CREATE UNIQUE INDEX idx_productos_numero_serie ON productos(numero_serie);
CREATE INDEX idx_ordenes_servicio_id_producto ON ordenes_servicio(id_producto);
CREATE INDEX idx_garantias_id_producto ON garantias(id_producto);
