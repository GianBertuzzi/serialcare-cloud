INSERT INTO roles (nombre_rol) VALUES
  ('ADMIN'),
  ('TECNICO'),
  ('CLIENTE'),
  ('MARCA');

INSERT INTO usuarios (nombre, email, password_hash, id_rol, estado) VALUES
  (
    'Administrador SerialCare',
    'admin@serialcare.cl',
    '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'),
    'ACTIVO'
  ),
  (
    'Tecnico SerialCare',
    'tecnico@serialcare.cl',
    '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'),
    'ACTIVO'
  ),
  (
    'Cliente Demo',
    'cliente@serialcare.cl',
    '$2b$10$zaUpm38YZEHkAoDZkF88BeLPProiSIxO4q4vOyNMPofclE9qoLyV6',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'CLIENTE'),
    'ACTIVO'
  ),
  (
    'Marca Demo',
    'marca@serialcare.cl',
    '$2b$10$BBbWAIDBJeVOy9jG2ha00.SPpwCsDkSz3Ka/ey.ExfCmZtjrVktqG',
    (SELECT id_rol FROM roles WHERE nombre_rol = 'MARCA'),
    'ACTIVO'
  );

INSERT INTO productos (
  numero_serie,
  marca,
  modelo,
  id_cliente,
  estado_garantia,
  alerta_propiedad
) VALUES
  (
    'SC-ACME-0001',
    'ACME',
    'Generador portatil GP-2200',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'ACTIVA',
    FALSE
  ),
  (
    'SC-ACME-0002',
    'ACME',
    'Compresor CP-50',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'VENCIDA',
    FALSE
  ),
  (
    'SC-HUSQ-0001',
    'Husqvarna',
    'Motosierra 120 Mark II',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'ACTIVA',
    FALSE
  ),
  (
    'SC-HUSQ-0002',
    'Husqvarna',
    'Desbrozadora 143R-II',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'VENCIDA',
    FALSE
  ),
  (
    'SC-DEF-0001',
    'Defenza',
    'Refrigerador DF-320',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'ACTIVA',
    FALSE
  ),
  (
    'SC-DEF-0002',
    'Defenza',
    'Lavadora LV-18',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'EN_REVISION',
    FALSE
  ),
  (
    'SC-MOTO-0001',
    'MotoTech',
    'Motor MT-150',
    NULL,
    'PENDIENTE',
    TRUE
  ),
  (
    'SC-REFRI-0001',
    'FrioMax',
    'Refrigerador FX-400',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'VENCIDA',
    FALSE
  );

INSERT INTO ordenes_servicio (
  id_producto,
  id_tecnico,
  diagnostico,
  estado
) VALUES
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-ACME-0001'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
    'Cliente reporta dificultad de partida en frio. Orden pendiente de primera revision.',
    'PENDIENTE'
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-HUSQ-0001'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
    'Equipo ingresa por perdida de potencia. Tecnico revisa filtro, bujia y carburacion.',
    'EN_DIAGNOSTICO'
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-DEF-0002'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
    'Lavadora reparada por reemplazo de bomba de drenaje y prueba de ciclo completo.',
    'REPARADA'
  ),
  (
    (SELECT id_producto FROM productos WHERE numero_serie = 'SC-REFRI-0001'),
    (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
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
