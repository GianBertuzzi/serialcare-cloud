INSERT INTO roles (nombre_rol) VALUES
  ('ADMIN'),
  ('TECNICO'),
  ('CLIENTE'),
  ('MARCA');

INSERT INTO usuarios (nombre, email, password_hash, id_rol, estado) VALUES
  (
    'Administrador SerialCare',
    'admin@serialcare.cl',
    '$2b$10$b9xfhgdLd1zxjNVIyfhj..j.tZbco12XyCHEbLq.R9W1F.h7uSQMS',
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
    'Monitor Vital X100',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'VIGENTE',
    FALSE
  ),
  (
    'SC-ACME-0002',
    'ACME',
    'Bomba Infusion B200',
    (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'),
    'PENDIENTE',
    FALSE
  ),
  (
    'SC-MEDIX-0001',
    'MEDIX',
    'Sensor Clinico S10',
    NULL,
    'SIN_REGISTRAR',
    TRUE
  );

INSERT INTO ordenes_servicio (
  id_producto,
  id_tecnico,
  diagnostico,
  estado
) VALUES (
  (SELECT id_producto FROM productos WHERE numero_serie = 'SC-ACME-0001'),
  (SELECT id_usuario FROM usuarios WHERE email = 'tecnico@serialcare.cl'),
  'Revision inicial: equipo no enciende correctamente.',
  'ABIERTA'
);

INSERT INTO garantias (
  id_producto,
  estado,
  observacion,
  fecha_revision
) VALUES (
  (SELECT id_producto FROM productos WHERE numero_serie = 'SC-ACME-0002'),
  'PENDIENTE',
  'Solicitud de garantia pendiente de revision.',
  NULL
);
