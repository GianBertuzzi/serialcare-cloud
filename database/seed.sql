INSERT INTO roles (nombre_rol) VALUES
  ('ADMIN'),
  ('TECNICO'),
  ('CLIENTE'),
  ('MARCA');

INSERT INTO sucursales (
  nombre,
  ciudad,
  region,
  direccion,
  costo_ingreso_taller,
  estado
) VALUES
  (
    'Servicio Tecnico Temuco',
    'Temuco',
    'La Araucania',
    'Av. Alemania 1234',
    15000,
    'ACTIVA'
  ),
  (
    'Servicio Tecnico Santiago',
    'Santiago',
    'Metropolitana',
    'Av. Providencia 2450',
    25000,
    'ACTIVA'
  ),
  (
    'Servicio Tecnico Concepcion',
    'Concepcion',
    'Biobio',
    'Av. Paicavi 880',
    18000,
    'ACTIVA'
  );

INSERT INTO productos_modelo (
  codigo_comercial,
  descripcion,
  familia,
  marca,
  certificado
) VALUES
  ('TF55FX', 'Motor gasolina 5.5 HP Toyama', 'Motores gasolina', 'Toyama', TRUE),
  ('TF65', 'Motor gasolina 6.5 HP Toyama', 'Motores gasolina', 'Toyama', TRUE),
  ('120-MKII', 'Husqvarna 120 Mark II', 'Motosierras', 'Husqvarna', TRUE),
  ('143R-II', 'Desbrozadora 143R-II', 'Desbrozadoras', 'Husqvarna', TRUE),
  ('DF-320', 'Refrigerador DF-320', 'Linea blanca', 'Defenza', TRUE),
  ('LV-18', 'Lavadora LV-18', 'Linea blanca', 'Defenza', TRUE),
  ('GP-2200', 'Generador portatil GP-2200', 'Generadores', 'ACME', TRUE),
  ('CP-50', 'Compresor CP-50', 'Compresores', 'ACME', TRUE),
  ('MT-150', 'Motor MT-150', 'Motores gasolina', 'MotoTech', TRUE),
  ('FX-400', 'Refrigerador FX-400', 'Linea blanca', 'FrioMax', TRUE);

INSERT INTO precios_modelo_sucursal (
  id_sucursal,
  id_modelo,
  valor_revision,
  valor_mano_obra,
  estado
)
SELECT
  s.id_sucursal,
  m.id_modelo,
  CASE s.nombre
    WHEN 'Servicio Tecnico Temuco' THEN
      CASE m.codigo_comercial
        WHEN 'TF55FX' THEN 18000
        WHEN 'TF65' THEN 20000
        WHEN '120-MKII' THEN 22000
        WHEN '143R-II' THEN 24000
        WHEN 'DF-320' THEN 26000
        WHEN 'LV-18' THEN 25000
        WHEN 'GP-2200' THEN 21000
        WHEN 'CP-50' THEN 23000
        WHEN 'MT-150' THEN 19000
        WHEN 'FX-400' THEN 28000
        ELSE 15000
      END
    WHEN 'Servicio Tecnico Santiago' THEN
      CASE m.codigo_comercial
        WHEN 'TF55FX' THEN 24000
        WHEN 'TF65' THEN 26000
        WHEN '120-MKII' THEN 29000
        WHEN '143R-II' THEN 31000
        WHEN 'DF-320' THEN 34000
        WHEN 'LV-18' THEN 33000
        WHEN 'GP-2200' THEN 28000
        WHEN 'CP-50' THEN 30000
        WHEN 'MT-150' THEN 25000
        WHEN 'FX-400' THEN 36000
        ELSE 25000
      END
    WHEN 'Servicio Tecnico Concepcion' THEN
      CASE m.codigo_comercial
        WHEN 'TF55FX' THEN 20000
        WHEN 'TF65' THEN 22000
        WHEN '120-MKII' THEN 25000
        WHEN '143R-II' THEN 27000
        WHEN 'DF-320' THEN 30000
        WHEN 'LV-18' THEN 29000
        WHEN 'GP-2200' THEN 24000
        WHEN 'CP-50' THEN 26000
        WHEN 'MT-150' THEN 21000
        WHEN 'FX-400' THEN 32000
        ELSE 18000
      END
    ELSE 0
  END AS valor_revision,
  CASE s.nombre
    WHEN 'Servicio Tecnico Temuco' THEN 22000
    WHEN 'Servicio Tecnico Santiago' THEN 30000
    WHEN 'Servicio Tecnico Concepcion' THEN 26000
    ELSE 0
  END AS valor_mano_obra,
  'ACTIVO'
FROM sucursales s
CROSS JOIN productos_modelo m;

INSERT INTO usuarios (nombre, email, password_hash, id_rol, id_sucursal, estado) VALUES
  (
    'Administrador SerialCare',
    'admin@serialcare.cl',
    '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    'ACTIVO'
  ),
  (
    'Tecnico SerialCare',
    'tecnico@serialcare.cl',
    '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    'ACTIVO'
  ),
  (
    'Cliente Demo',
    'cliente@serialcare.cl',
    '$2b$10$zaUpm38YZEHkAoDZkF88BeLPProiSIxO4q4vOyNMPofclE9qoLyV6',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'CLIENTE'),
    NULL,
    'ACTIVO'
  ),
  (
    'Marca Demo',
    'marca@serialcare.cl',
    '$2b$10$BBbWAIDBJeVOy9jG2ha00.SPpwCsDkSz3Ka/ey.ExfCmZtjrVktqG',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'MARCA'),
    NULL,
    'ACTIVO'
  );

INSERT INTO productos (
  numero_serie,
  marca,
  modelo,
  id_modelo,
  id_cliente,
  estado_garantia,
  alerta_propiedad
) VALUES
  (
    'SC-ACME-0001',
    'ACME',
    'Generador portatil GP-2200',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = 'GP-2200'),
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'ACTIVA',
    FALSE
  ),
  (
    'SC-ACME-0002',
    'ACME',
    'Compresor CP-50',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = 'CP-50'),
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'VENCIDA',
    FALSE
  ),
  (
    'SC-HUSQ-0001',
    'Husqvarna',
    'Motosierra 120 Mark II',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = '120-MKII'),
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'ACTIVA',
    FALSE
  ),
  (
    'SC-HUSQ-0002',
    'Husqvarna',
    'Desbrozadora 143R-II',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = '143R-II'),
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'VENCIDA',
    FALSE
  ),
  (
    'SC-DEF-0001',
    'Defenza',
    'Refrigerador DF-320',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = 'DF-320'),
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'ACTIVA',
    FALSE
  ),
  (
    'SC-DEF-0002',
    'Defenza',
    'Lavadora LV-18',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = 'LV-18'),
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'EN_REVISION',
    FALSE
  ),
  (
    'SC-MOTO-0001',
    'MotoTech',
    'Motor MT-150',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = 'MT-150'),
    NULL,
    'PENDIENTE',
    TRUE
  ),
  (
    'SC-REFRI-0001',
    'FrioMax',
    'Refrigerador FX-400',
    (SELECT id_modelo FROM productos_modelo WHERE codigo_comercial = 'FX-400'),
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'VENCIDA',
    FALSE
  );

INSERT INTO ordenes_servicio (
  id_producto,
  id_tecnico,
  id_sucursal,
  id_modelo,
  costo_ingreso_taller,
  valor_revision,
  tipo_orden,
  diagnostico,
  estado
) VALUES
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-ACME-0001'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT id_modelo FROM productos WHERE numero_serie = 'SC-ACME-0001'),
    (SELECT costo_ingreso_taller FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT pms.valor_revision FROM precios_modelo_sucursal pms INNER JOIN productos p ON p.id_modelo = pms.id_modelo WHERE p.numero_serie = 'SC-ACME-0001' AND pms.id_sucursal = (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco')),
    'REPARACION',
    'Cliente reporta dificultad de partida en frio. Orden pendiente de primera revision.',
    'PENDIENTE'
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-HUSQ-0001'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT id_modelo FROM productos WHERE numero_serie = 'SC-HUSQ-0001'),
    (SELECT costo_ingreso_taller FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT pms.valor_revision FROM precios_modelo_sucursal pms INNER JOIN productos p ON p.id_modelo = pms.id_modelo WHERE p.numero_serie = 'SC-HUSQ-0001' AND pms.id_sucursal = (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco')),
    'DIAGNOSTICO',
    'Equipo ingresa por perdida de potencia. Tecnico revisa filtro, bujia y carburacion.',
    'EN_DIAGNOSTICO'
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-DEF-0002'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT id_modelo FROM productos WHERE numero_serie = 'SC-DEF-0002'),
    (SELECT costo_ingreso_taller FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT pms.valor_revision FROM precios_modelo_sucursal pms INNER JOIN productos p ON p.id_modelo = pms.id_modelo WHERE p.numero_serie = 'SC-DEF-0002' AND pms.id_sucursal = (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco')),
    'REPARACION',
    'Lavadora reparada por reemplazo de bomba de drenaje y prueba de ciclo completo.',
    'REPARADA'
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-REFRI-0001'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT id_modelo FROM productos WHERE numero_serie = 'SC-REFRI-0001'),
    (SELECT costo_ingreso_taller FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'),
    (SELECT pms.valor_revision FROM precios_modelo_sucursal pms INNER JOIN productos p ON p.id_modelo = pms.id_modelo WHERE p.numero_serie = 'SC-REFRI-0001' AND pms.id_sucursal = (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco')),
    'REPARACION',
    'Refrigerador cerrado luego de cambio de termostato y validacion de temperatura.',
    'CERRADA'
  );

INSERT INTO garantias (
  id_producto,
  estado,
  observacion,
  fecha_revision
) VALUES
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-HUSQ-0001'),
    'PENDIENTE',
    'Solicitud recibida por falla intermitente de encendido. Pendiente de evaluacion tecnica.',
    NULL
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-DEF-0001'),
    'APROBADA',
    'Garantia aprobada por defecto de fabrica en modulo de control.',
    CURRENT_TIMESTAMP
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-ACME-0002'),
    'RECHAZADA',
    'Garantia rechazada por vencimiento del periodo de cobertura.',
    CURRENT_TIMESTAMP
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-MOTO-0001'),
    'EN_REVISION',
    'Producto con alerta de propiedad. Marca debe validar documentacion antes de resolver.',
    NULL
  );
