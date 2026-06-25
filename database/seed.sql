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
    U&'Servicio T\00E9cnico Temuco',
    'Temuco',
    U&'La Araucan\00EDa',
    'Av. Alemania 1234',
    15000,
    'ACTIVA'
  ),
  (
    U&'Servicio T\00E9cnico Santiago',
    'Santiago',
    'Metropolitana',
    'Av. Providencia 2450',
    25000,
    'ACTIVA'
  ),
  (
    U&'Servicio T\00E9cnico Concepci\00F3n',
    U&'Concepci\00F3n',
    U&'Biob\00EDo',
    U&'Av. Paicav\00ED 880',
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
    WHEN U&'Servicio T\00E9cnico Temuco' THEN
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
    WHEN U&'Servicio T\00E9cnico Santiago' THEN
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
    WHEN U&'Servicio T\00E9cnico Concepci\00F3n' THEN
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
    WHEN U&'Servicio T\00E9cnico Temuco' THEN 22000
    WHEN U&'Servicio T\00E9cnico Santiago' THEN 30000
    WHEN U&'Servicio T\00E9cnico Concepci\00F3n' THEN 26000
    ELSE 0
  END AS valor_mano_obra,
  'ACTIVO'
FROM sucursales s
CROSS JOIN productos_modelo m;

INSERT INTO usuarios (nombre, email, password_hash, id_rol, id_sucursal, estado) VALUES
  (
    'Administrador SerialCare Temuco',
    'admin@serialcare.cl',
    '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Temuco'),
    'ACTIVO'
  ),
  (
    'Tecnico SerialCare Temuco',
    'tecnico@serialcare.cl',
    '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Temuco'),
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
  ),
  (
    'Admin Sucursal Temuco',
    'admin.temuco@serialcare.cl',
    '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Temuco'),
    'ACTIVO'
  ),
  (
    'Admin Sucursal Santiago',
    'admin.santiago@serialcare.cl',
    '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Santiago'),
    'ACTIVO'
  ),
  (
    U&'Admin Sucursal Concepci\00F3n',
    'admin.concepcion@serialcare.cl',
    '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Concepci\00F3n'),
    'ACTIVO'
  ),
  (
    U&'T\00E9cnico Sucursal Temuco',
    'tecnico.temuco@serialcare.cl',
    '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Temuco'),
    'ACTIVO'
  ),
  (
    U&'T\00E9cnico Sucursal Santiago',
    'tecnico.santiago@serialcare.cl',
    '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Santiago'),
    'ACTIVO'
  ),
  (
    U&'T\00E9cnico Sucursal Concepci\00F3n',
    'tecnico.concepcion@serialcare.cl',
    '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'),
    (SELECT id_sucursal FROM sucursales WHERE nombre = U&'Servicio T\00E9cnico Concepci\00F3n'),
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

WITH ordenes_seed (
  numero_serie,
  tecnico_email,
  sucursal_nombre,
  tipo_orden,
  diagnostico,
  estado
) AS (
  VALUES
    (
      'SC-ACME-0001',
      'tecnico.temuco@serialcare.cl',
      U&'Servicio T\00E9cnico Temuco',
      'REPARACION',
      'Cliente reporta dificultad de partida en frio. Orden pendiente de primera revision.',
      'PENDIENTE'
    ),
    (
      'SC-HUSQ-0001',
      'tecnico.temuco@serialcare.cl',
      U&'Servicio T\00E9cnico Temuco',
      'GARANTIA',
      'Equipo ingresa por perdida de potencia. Tecnico revisa filtro, bujia y carburacion.',
      'EN_DIAGNOSTICO'
    ),
    (
      'SC-ACME-0002',
      'tecnico@serialcare.cl',
      U&'Servicio T\00E9cnico Temuco',
      'GARANTIA',
      'Compresor evaluado por solicitud de garantia fuera de periodo de cobertura.',
      'CERRADA'
    ),
    (
      'SC-HUSQ-0002',
      'tecnico.santiago@serialcare.cl',
      U&'Servicio T\00E9cnico Santiago',
      'MANTENIMIENTO',
      'Desbrozadora ingresa para mantencion preventiva y ajuste de carburacion.',
      'EN_DIAGNOSTICO'
    ),
    (
      'SC-MOTO-0001',
      'tecnico.santiago@serialcare.cl',
      U&'Servicio T\00E9cnico Santiago',
      'GARANTIA',
      'Producto con alerta de propiedad. Sucursal solicita revision documental.',
      'PENDIENTE'
    ),
    (
      'SC-DEF-0001',
      'tecnico.concepcion@serialcare.cl',
      U&'Servicio T\00E9cnico Concepci\00F3n',
      'GARANTIA',
      'Refrigerador revisado por falla de modulo de control. Caso aprobado por garantia.',
      'REPARADA'
    ),
    (
      'SC-DEF-0002',
      'tecnico.concepcion@serialcare.cl',
      U&'Servicio T\00E9cnico Concepci\00F3n',
      'REPARACION',
      'Lavadora reparada por reemplazo de bomba de drenaje y prueba de ciclo completo.',
      'REPARADA'
    ),
    (
      'SC-REFRI-0001',
      'tecnico.concepcion@serialcare.cl',
      U&'Servicio T\00E9cnico Concepci\00F3n',
      'MANTENIMIENTO',
      'Refrigerador cerrado luego de cambio de termostato y validacion de temperatura.',
      'CERRADA'
    )
)
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
)
SELECT
  p.id_producto,
  u.id_usuario,
  s.id_sucursal,
  p.id_modelo,
  s.costo_ingreso_taller,
  pms.valor_revision,
  os.tipo_orden,
  os.diagnostico,
  os.estado
FROM ordenes_seed os
INNER JOIN productos p ON p.numero_serie = os.numero_serie
INNER JOIN usuarios u ON u.email = os.tecnico_email
INNER JOIN sucursales s ON s.nombre = os.sucursal_nombre
INNER JOIN precios_modelo_sucursal pms
  ON pms.id_sucursal = s.id_sucursal
  AND pms.id_modelo = p.id_modelo;

WITH repuestos_seed (
  numero_serie,
  sucursal_clave,
  nombre_repuesto,
  cantidad,
  precio_unitario,
  cubierto_garantia,
  observacion
) AS (
  VALUES
    (
      'SC-HUSQ-0001',
      'TEMUCO',
      'Bujia NGK BPMR7A',
      1,
      4500,
      TRUE,
      'Repuesto sugerido para falla de encendido.'
    ),
    (
      'SC-HUSQ-0001',
      'TEMUCO',
      'Filtro de aire motosierra 120',
      1,
      6900,
      TRUE,
      'Filtro contaminado durante diagnostico.'
    ),
    (
      'SC-MOTO-0001',
      'SANTIAGO',
      'Kit empaquetadura carburador MT-150',
      1,
      12500,
      FALSE,
      'Pendiente de validacion por alerta de propiedad.'
    ),
    (
      'SC-DEF-0001',
      'CONCEPCION',
      'Modulo de control DF-320',
      1,
      48000,
      TRUE,
      'Repuesto cubierto por garantia aprobada.'
    ),
    (
      'SC-ACME-0002',
      'TEMUCO',
      'Presostato compresor CP-50',
      1,
      18000,
      FALSE,
      'No cubierto por garantia vencida.'
    )
)
INSERT INTO repuestos_usados (
  id_orden,
  nombre_repuesto,
  cantidad,
  precio_unitario,
  cubierto_garantia,
  observacion
)
SELECT
  o.id_orden,
  rs.nombre_repuesto,
  rs.cantidad,
  rs.precio_unitario,
  rs.cubierto_garantia,
  rs.observacion
FROM repuestos_seed rs
INNER JOIN productos p ON p.numero_serie = rs.numero_serie
INNER JOIN sucursales s ON (
  (rs.sucursal_clave = 'TEMUCO' AND s.nombre LIKE 'Servicio T%Temuco') OR
  (rs.sucursal_clave = 'SANTIAGO' AND s.nombre LIKE 'Servicio T%Santiago') OR
  (rs.sucursal_clave = 'CONCEPCION' AND s.nombre LIKE 'Servicio T%Concepci%')
)
INNER JOIN ordenes_servicio o
  ON o.id_producto = p.id_producto
  AND o.id_sucursal = s.id_sucursal;


WITH cotizaciones_seed (
  numero_serie,
  sucursal_clave,
  mano_obra,
  estado,
  observacion
) AS (
  VALUES
    ('SC-HUSQ-0001', 'TEMUCO', 22000, 'ENVIADA', 'Cotizacion por limpieza de carburador y repuestos menores.'),
    ('SC-MOTO-0001', 'SANTIAGO', 30000, 'BORRADOR', 'Cotizacion preliminar pendiente de revision documental.'),
    ('SC-DEF-0001', 'CONCEPCION', 26000, 'APROBADA', 'Mano de obra cubierta por garantia de modulo de control.'),
    ('SC-ACME-0002', 'TEMUCO', 24000, 'RECHAZADA', 'Cliente rechaza reparacion fuera de garantia.')
)
INSERT INTO cotizaciones (
  id_orden,
  mano_obra,
  total_repuestos,
  total,
  estado,
  observacion,
  fecha_respuesta
)
SELECT
  o.id_orden,
  cs.mano_obra,
  COALESCE(SUM(ru.cantidad * ru.precio_unitario), 0) AS total_repuestos,
  cs.mano_obra + COALESCE(SUM(ru.cantidad * ru.precio_unitario), 0) AS total,
  cs.estado,
  cs.observacion,
  CASE WHEN cs.estado IN ('APROBADA', 'RECHAZADA') THEN CURRENT_TIMESTAMP - INTERVAL '1 day' ELSE NULL END
FROM cotizaciones_seed cs
INNER JOIN productos p ON p.numero_serie = cs.numero_serie
INNER JOIN sucursales s ON (
  (cs.sucursal_clave = 'TEMUCO' AND s.nombre LIKE 'Servicio T%Temuco') OR
  (cs.sucursal_clave = 'SANTIAGO' AND s.nombre LIKE 'Servicio T%Santiago') OR
  (cs.sucursal_clave = 'CONCEPCION' AND s.nombre LIKE 'Servicio T%Concepci%')
)
INNER JOIN ordenes_servicio o
  ON o.id_producto = p.id_producto
  AND o.id_sucursal = s.id_sucursal
LEFT JOIN repuestos_usados ru ON ru.id_orden = o.id_orden
GROUP BY o.id_orden, cs.mano_obra, cs.estado, cs.observacion;

WITH evidencias_seed (
  numero_serie,
  sucursal_clave,
  tipo,
  nombre_archivo,
  url_archivo,
  descripcion
) AS (
  VALUES
    ('SC-HUSQ-0001', 'TEMUCO', 'IMAGEN', 'husq-0001-carburador.jpg', 'https://demo.serialcare.local/evidencias/husq-0001-carburador.jpg', 'Foto de carburador antes de limpieza.'),
    ('SC-HUSQ-0001', 'TEMUCO', 'DOCUMENTO', 'husq-0001-ingreso.txt', 'https://demo.serialcare.local/evidencias/husq-0001-ingreso.txt', 'Registro simulado de ingreso a taller.'),
    ('SC-MOTO-0001', 'SANTIAGO', 'PDF', 'moto-0001-documentos.pdf', 'https://demo.serialcare.local/evidencias/moto-0001-documentos.pdf', 'Documento simulado para validar alerta de propiedad.'),
    ('SC-DEF-0001', 'CONCEPCION', 'IMAGEN', 'def-0001-modulo.jpg', 'https://demo.serialcare.local/evidencias/def-0001-modulo.jpg', 'Evidencia de modulo de control reemplazado.')
)
INSERT INTO evidencias_orden (
  id_orden,
  tipo,
  nombre_archivo,
  url_archivo,
  descripcion
)
SELECT
  o.id_orden,
  es.tipo,
  es.nombre_archivo,
  es.url_archivo,
  es.descripcion
FROM evidencias_seed es
INNER JOIN productos p ON p.numero_serie = es.numero_serie
INNER JOIN sucursales s ON (
  (es.sucursal_clave = 'TEMUCO' AND s.nombre LIKE 'Servicio T%Temuco') OR
  (es.sucursal_clave = 'SANTIAGO' AND s.nombre LIKE 'Servicio T%Santiago') OR
  (es.sucursal_clave = 'CONCEPCION' AND s.nombre LIKE 'Servicio T%Concepci%')
)
INNER JOIN ordenes_servicio o
  ON o.id_producto = p.id_producto
  AND o.id_sucursal = s.id_sucursal;
WITH garantias_seed (
  numero_serie,
  sucursal_clave,
  tecnico_email,
  estado,
  observacion,
  observacion_marca,
  fecha_solicitud,
  fecha_revision
) AS (
  VALUES
    (
      'SC-ACME-0001',
      'TEMUCO',
      'tecnico.temuco@serialcare.cl',
      'PENDIENTE',
      'Sucursal Temuco solicita garantia por falla intermitente de partida reportada por cliente.',
      NULL,
      CURRENT_TIMESTAMP - INTERVAL '2 days',
      NULL::TIMESTAMP
    ),
    (
      'SC-MOTO-0001',
      'SANTIAGO',
      'tecnico.santiago@serialcare.cl',
      'EN_REVISION',
      'Sucursal Santiago solicita revision documental por producto con alerta de propiedad registrada.',
      NULL,
      CURRENT_TIMESTAMP - INTERVAL '1 day',
      NULL::TIMESTAMP
    ),
    (
      'SC-DEF-0001',
      'CONCEPCION',
      'tecnico.concepcion@serialcare.cl',
      'APROBADA',
      'Sucursal Concepcion solicita cobertura por falla de modulo de control.',
      'Garantia aprobada por defecto de fabrica en modulo de control.',
      CURRENT_TIMESTAMP - INTERVAL '5 days',
      CURRENT_TIMESTAMP - INTERVAL '4 days'
    ),
    (
      'SC-ACME-0002',
      'TEMUCO',
      'tecnico@serialcare.cl',
      'RECHAZADA',
      'Sucursal Temuco solicita cobertura para compresor evaluado fuera de periodo.',
      'Garantia rechazada por vencimiento del periodo de cobertura.',
      CURRENT_TIMESTAMP - INTERVAL '6 days',
      CURRENT_TIMESTAMP - INTERVAL '5 days'
    )
)
INSERT INTO garantias (
  id_orden,
  id_producto,
  id_sucursal,
  id_tecnico,
  estado,
  observacion,
  observacion_marca,
  fecha_solicitud,
  fecha_revision
)
SELECT
  o.id_orden,
  p.id_producto,
  s.id_sucursal,
  COALESCE(u.id_usuario, o.id_tecnico),
  gs.estado,
  gs.observacion,
  gs.observacion_marca,
  gs.fecha_solicitud,
  gs.fecha_revision
FROM garantias_seed gs
INNER JOIN productos p ON p.numero_serie = gs.numero_serie
INNER JOIN sucursales s ON (
  (gs.sucursal_clave = 'TEMUCO' AND s.nombre LIKE 'Servicio T%Temuco') OR
  (gs.sucursal_clave = 'SANTIAGO' AND s.nombre LIKE 'Servicio T%Santiago') OR
  (gs.sucursal_clave = 'CONCEPCION' AND s.nombre LIKE 'Servicio T%Concepci%')
)
INNER JOIN ordenes_servicio o
  ON o.id_producto = p.id_producto
  AND o.id_sucursal = s.id_sucursal
LEFT JOIN usuarios u ON u.email = gs.tecnico_email;