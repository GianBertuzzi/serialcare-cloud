-- Datos mínimos para una instalación nueva de un solo negocio.
-- El ADMIN inicial se crea desde variables de entorno en db:initialize.

INSERT INTO roles (nombre_rol)
VALUES
  ('ADMIN'),
  ('TECNICO'),
  ('CLIENTE'),
  ('MARCA')
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO sucursales (
  id_sucursal,
  nombre,
  ciudad,
  region,
  direccion,
  costo_ingreso_taller,
  estado
)
VALUES (
  1,
  'Servicio Tecnico SerialCare',
  'Temuco',
  'La Araucania',
  'Configurar direccion',
  0,
  'ACTIVA'
)
ON CONFLICT (id_sucursal) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('sucursales', 'id_sucursal'),
  GREATEST((SELECT COALESCE(MAX(id_sucursal), 1) FROM sucursales), 1),
  true
);

INSERT INTO tipos_maquina (
  id_sucursal,
  nombre,
  descripcion,
  valor_ingreso,
  aplica_garantia,
  estado
)
VALUES
  (1, 'Compresor', 'Equipos de aire comprimido y taller', 0, TRUE, 'ACTIVO'),
  (1, 'Desbrozadora', 'Equipos de corte y desmalezado', 0, TRUE, 'ACTIVO'),
  (1, 'Motosierra', 'Motosierras y equipos forestales', 0, TRUE, 'ACTIVO'),
  (1, 'Refrigerador', 'Equipos de frio', 0, TRUE, 'ACTIVO'),
  (1, 'Generador', 'Generadores electricos', 0, TRUE, 'ACTIVO'),
  (1, 'Lavadora', 'Lavadoras y linea blanca', 0, TRUE, 'ACTIVO'),
  (1, 'Motor gasolina', 'Motores estacionarios a gasolina', 0, TRUE, 'ACTIVO')
ON CONFLICT (id_sucursal, nombre) DO NOTHING;
