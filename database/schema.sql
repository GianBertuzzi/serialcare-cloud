DROP TABLE IF EXISTS garantias CASCADE;
DROP TABLE IF EXISTS evidencias_orden CASCADE;
DROP TABLE IF EXISTS cotizaciones CASCADE;
DROP TABLE IF EXISTS repuestos_usados CASCADE;
DROP TABLE IF EXISTS ordenes_servicio CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS repuestos CASCADE;
DROP TABLE IF EXISTS tipos_reparacion CASCADE;
DROP TABLE IF EXISTS tipos_maquina CASCADE;
DROP TABLE IF EXISTS precios_modelo_sucursal CASCADE;
DROP TABLE IF EXISTS productos_modelo CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS sucursales CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
  id_rol SERIAL PRIMARY KEY,
  nombre_rol VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE sucursales (
  id_sucursal SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  ciudad VARCHAR(80),
  region VARCHAR(80),
  direccion VARCHAR(200),
  costo_ingreso_taller INTEGER NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  id_rol INTEGER NOT NULL REFERENCES roles(id_rol),
  id_sucursal INTEGER NULL REFERENCES sucursales(id_sucursal),
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clientes (
  id_cliente SERIAL PRIMARY KEY,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  id_usuario INTEGER NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  nombre VARCHAR(120) NOT NULL,
  rut VARCHAR(20),
  telefono VARCHAR(30),
  email VARCHAR(120),
  direccion VARCHAR(200),
  estado VARCHAR(20) DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productos_modelo (
  id_modelo SERIAL PRIMARY KEY,
  codigo_comercial VARCHAR(50),
  descripcion VARCHAR(150) NOT NULL,
  familia VARCHAR(80),
  marca VARCHAR(80),
  certificado BOOLEAN DEFAULT TRUE
);

CREATE TABLE precios_modelo_sucursal (
  id_precio SERIAL PRIMARY KEY,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  id_modelo INTEGER NOT NULL REFERENCES productos_modelo(id_modelo),
  valor_revision INTEGER NOT NULL DEFAULT 0,
  valor_mano_obra INTEGER NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  UNIQUE (id_sucursal, id_modelo)
);

CREATE TABLE tipos_maquina (
  id_tipo_maquina SERIAL PRIMARY KEY,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(250),
  valor_ingreso INTEGER NOT NULL DEFAULT 0,
  aplica_garantia BOOLEAN DEFAULT TRUE,
  estado VARCHAR(20) DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id_sucursal, nombre)
);

CREATE TABLE productos (
  id_producto SERIAL PRIMARY KEY,
  id_cliente INTEGER REFERENCES clientes(id_cliente) ON DELETE SET NULL,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  id_modelo INTEGER NULL REFERENCES productos_modelo(id_modelo),
  id_tipo_maquina INTEGER NULL REFERENCES tipos_maquina(id_tipo_maquina),
  numero_serie VARCHAR(80) UNIQUE NOT NULL,
  marca VARCHAR(80),
  modelo VARCHAR(120),
  tipo_maquina VARCHAR(80),
  descripcion VARCHAR(200),
  estado_garantia VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  alerta_propiedad BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE repuestos (
  id_repuesto SERIAL PRIMARY KEY,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  codigo VARCHAR(50),
  nombre VARCHAR(120) NOT NULL,
  marca VARCHAR(80),
  precio INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  estado VARCHAR(20) DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tipos_reparacion (
  id_tipo_reparacion SERIAL PRIMARY KEY,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(250),
  valor_ingreso INTEGER NOT NULL DEFAULT 0,
  aplica_garantia BOOLEAN DEFAULT FALSE,
  estado VARCHAR(20) DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ordenes_servicio (
  id_orden SERIAL PRIMARY KEY,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  id_cliente INTEGER NOT NULL REFERENCES clientes(id_cliente),
  id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
  id_tipo_maquina INTEGER NULL REFERENCES tipos_maquina(id_tipo_maquina),
  id_tipo_reparacion INTEGER NULL REFERENCES tipos_reparacion(id_tipo_reparacion),
  id_tecnico INTEGER NULL REFERENCES usuarios(id_usuario),
  id_modelo INTEGER NULL REFERENCES productos_modelo(id_modelo),
  costo_ingreso_taller INTEGER NOT NULL DEFAULT 0,
  valor_ingreso INTEGER NOT NULL DEFAULT 0,
  valor_revision INTEGER NOT NULL DEFAULT 0,
  tipo_atencion VARCHAR(40) NOT NULL DEFAULT 'REPARACION',
  tipo_orden VARCHAR(30) NOT NULL DEFAULT 'REPARACION',
  descripcion_problema TEXT,
  diagnostico TEXT NOT NULL DEFAULT '',
  informe_tecnico TEXT NOT NULL DEFAULT '',
  mano_obra INTEGER NOT NULL DEFAULT 0,
  garantia_aprobada_por_admin BOOLEAN NULL,
  observacion_admin TEXT,
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE repuestos_usados (
  id_detalle SERIAL PRIMARY KEY,
  id_orden INTEGER NOT NULL REFERENCES ordenes_servicio(id_orden) ON DELETE CASCADE,
  id_repuesto INTEGER NULL REFERENCES repuestos(id_repuesto) ON DELETE SET NULL,
  nombre_repuesto VARCHAR(120) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  cubierto_garantia BOOLEAN DEFAULT FALSE,
  observacion VARCHAR(200),
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cotizaciones (
  id_cotizacion SERIAL PRIMARY KEY,
  id_orden INTEGER NOT NULL UNIQUE REFERENCES ordenes_servicio(id_orden) ON DELETE CASCADE,
  total_repuestos INTEGER NOT NULL DEFAULT 0,
  valor_ingreso INTEGER NOT NULL DEFAULT 0,
  mano_obra INTEGER NOT NULL DEFAULT 0,
  total_general INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  estado VARCHAR(30) DEFAULT 'BORRADOR',
  observacion VARCHAR(300),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta TIMESTAMP NULL
);

CREATE TABLE evidencias_orden (
  id_evidencia SERIAL PRIMARY KEY,
  id_orden INTEGER NOT NULL REFERENCES ordenes_servicio(id_orden) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL,
  nombre_archivo VARCHAR(160),
  referencia_url VARCHAR(300),
  url_archivo VARCHAR(300),
  descripcion VARCHAR(200),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE garantias (
  id_garantia SERIAL PRIMARY KEY,
  id_orden INTEGER NOT NULL REFERENCES ordenes_servicio(id_orden) ON DELETE CASCADE,
  id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
  id_sucursal INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
  id_tecnico INTEGER NULL REFERENCES usuarios(id_usuario),
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  observacion TEXT,
  observacion_admin TEXT,
  observacion_marca TEXT,
  fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_revision TIMESTAMP
);

CREATE UNIQUE INDEX idx_usuarios_email ON usuarios(LOWER(email));
CREATE UNIQUE INDEX idx_productos_numero_serie ON productos(UPPER(numero_serie));
CREATE UNIQUE INDEX idx_productos_modelo_codigo ON productos_modelo(UPPER(codigo_comercial)) WHERE codigo_comercial IS NOT NULL;
CREATE INDEX idx_usuarios_id_sucursal ON usuarios(id_sucursal);
CREATE INDEX idx_clientes_id_sucursal ON clientes(id_sucursal);
CREATE INDEX idx_clientes_id_usuario ON clientes(id_usuario);
CREATE INDEX idx_tipos_maquina_id_sucursal ON tipos_maquina(id_sucursal);
CREATE INDEX idx_productos_id_cliente ON productos(id_cliente);
CREATE INDEX idx_productos_id_sucursal ON productos(id_sucursal);
CREATE INDEX idx_productos_id_modelo ON productos(id_modelo);
CREATE INDEX idx_productos_id_tipo_maquina ON productos(id_tipo_maquina);
CREATE INDEX idx_repuestos_id_sucursal ON repuestos(id_sucursal);
CREATE INDEX idx_tipos_reparacion_id_sucursal ON tipos_reparacion(id_sucursal);
CREATE INDEX idx_precios_modelo_sucursal_id_sucursal ON precios_modelo_sucursal(id_sucursal);
CREATE INDEX idx_precios_modelo_sucursal_id_modelo ON precios_modelo_sucursal(id_modelo);
CREATE INDEX idx_ordenes_servicio_id_producto ON ordenes_servicio(id_producto);
CREATE INDEX idx_ordenes_servicio_id_sucursal ON ordenes_servicio(id_sucursal);
CREATE INDEX idx_ordenes_servicio_id_cliente ON ordenes_servicio(id_cliente);
CREATE INDEX idx_ordenes_servicio_id_tipo_maquina ON ordenes_servicio(id_tipo_maquina);
CREATE INDEX idx_ordenes_servicio_id_tipo_reparacion ON ordenes_servicio(id_tipo_reparacion);
CREATE INDEX idx_repuestos_usados_id_orden ON repuestos_usados(id_orden);
CREATE INDEX idx_cotizaciones_id_orden ON cotizaciones(id_orden);
CREATE INDEX idx_evidencias_orden_id_orden ON evidencias_orden(id_orden);
CREATE INDEX idx_garantias_id_orden ON garantias(id_orden);
CREATE INDEX idx_garantias_id_producto ON garantias(id_producto);
CREATE INDEX idx_garantias_id_sucursal ON garantias(id_sucursal);