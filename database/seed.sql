INSERT INTO roles (nombre_rol) VALUES
  ('ADMIN'),
  ('TECNICO'),
  ('CLIENTE'),
  ('MARCA');

INSERT INTO sucursales (nombre, ciudad, region, direccion, costo_ingreso_taller, estado) VALUES
  ('Servicio Tecnico Temuco', 'Temuco', 'La Araucania', 'Av. Alemania 1234', 15000, 'ACTIVA'),
  ('Servicio Tecnico Santiago', 'Santiago', 'Metropolitana', 'Av. Providencia 2450', 25000, 'ACTIVA'),
  ('Servicio Tecnico Concepcion', 'Concepcion', 'Biobio', 'Av. Paicavi 880', 18000, 'ACTIVA'),
  ('Servicio Tecnico Valdivia', 'Valdivia', 'Los Rios', 'Av. Principal 123', 19000, 'ACTIVA');

INSERT INTO usuarios (nombre, email, password_hash, id_rol, id_sucursal, estado) VALUES
  ('Marca Demo', 'marca@serialcare.cl', '$2b$10$BBbWAIDBJeVOy9jG2ha00.SPpwCsDkSz3Ka/ey.ExfCmZtjrVktqG', (SELECT id_rol FROM roles WHERE nombre_rol = 'MARCA'), NULL, 'ACTIVO'),
  ('Administrador SerialCare Temuco', 'admin@serialcare.cl', '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C', (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'), 'ACTIVO'),
  ('Tecnico SerialCare Temuco', 'tecnico@serialcare.cl', '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i', (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'), 'ACTIVO'),
  ('Cliente Demo', 'cliente@serialcare.cl', '$2b$10$zaUpm38YZEHkAoDZkF88BeLPProiSIxO4q4vOyNMPofclE9qoLyV6', (SELECT id_rol FROM roles WHERE nombre_rol = 'CLIENTE'), NULL, 'ACTIVO'),
  ('Admin Sucursal Temuco', 'admin.temuco@serialcare.cl', '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C', (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'), 'ACTIVO'),
  ('Admin Sucursal Santiago', 'admin.santiago@serialcare.cl', '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C', (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Santiago'), 'ACTIVO'),
  ('Admin Sucursal Concepcion', 'admin.concepcion@serialcare.cl', '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C', (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Concepcion'), 'ACTIVO'),
  ('Admin Valdivia', 'admin.valdivia@serialcare.cl', '$2b$10$.1cAA5VG3UX1/VTztx1OD./RqwrkJE5bj/NAh/FDJVAXOrO1pE58C', (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Valdivia'), 'ACTIVO'),
  ('Tecnico Sucursal Temuco', 'tecnico.temuco@serialcare.cl', '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i', (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'), 'ACTIVO'),
  ('Tecnico Sucursal Santiago', 'tecnico.santiago@serialcare.cl', '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i', (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Santiago'), 'ACTIVO'),
  ('Tecnico Sucursal Concepcion', 'tecnico.concepcion@serialcare.cl', '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i', (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Concepcion'), 'ACTIVO'),
  ('Tecnico Valdivia', 'tecnico.valdivia@serialcare.cl', '$2b$10$Vsv9JGhIyDWVy1ZezCmSU.X.apBoG8Gj/YFP61RDYTTN.zi8m3f0i', (SELECT id_rol FROM roles WHERE nombre_rol = 'TECNICO'), (SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Valdivia'), 'ACTIVO');

INSERT INTO clientes (id_sucursal, id_usuario, nombre, rut, telefono, email, direccion, estado) VALUES
  ((SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'), (SELECT id_usuario FROM usuarios WHERE email = 'cliente@serialcare.cl'), 'Inversiones del Norte SpA', '76.123.456-7', '+56 9 6123 4501', 'cliente@serialcare.cl', 'Los Robles 140, Temuco', 'ACTIVO'),
  ((SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Temuco'), NULL, 'Agricola Rio Cautin', '77.234.111-2', '+56 9 7444 1000', 'operaciones@riocautin.cl', 'Camino Labranza Km 8', 'ACTIVO'),
  ((SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Santiago'), NULL, 'Comercial Andes Ltda.', '78.555.100-9', '+56 2 2450 1212', 'servicio@comercialandes.cl', 'Av. Apoquindo 4100', 'ACTIVO'),
  ((SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Santiago'), NULL, 'Constructora Horizonte', '79.222.300-5', '+56 9 8890 7788', 'mantencion@horizonte.cl', 'Santa Isabel 620', 'ACTIVO'),
  ((SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Concepcion'), NULL, 'Minera del Sur S.A.', '80.111.555-0', '+56 41 223 4500', 'equipos@minerasur.cl', 'Barros Arana 1001', 'ACTIVO'),
  ((SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Concepcion'), NULL, 'Frigorifico Pacifico Ltda.', '81.333.444-1', '+56 9 9000 3400', 'servicio@fripacifico.cl', 'Camino a Coronel 300', 'ACTIVO'),
  ((SELECT id_sucursal FROM sucursales WHERE nombre = 'Servicio Tecnico Valdivia'), NULL, 'Forestal Valdivia Ltda.', '82.777.888-4', '+56 9 7333 1111', 'taller@forestalvaldivia.cl', 'Ruta T-350 Km 3', 'ACTIVO');

INSERT INTO productos_modelo (codigo_comercial, descripcion, familia, marca, certificado) VALUES
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

INSERT INTO tipos_maquina (id_sucursal, nombre, descripcion, valor_ingreso, aplica_garantia, estado)
SELECT s.id_sucursal, x.nombre, x.descripcion,
  CASE s.nombre
    WHEN 'Servicio Tecnico Temuco' THEN x.temuco
    WHEN 'Servicio Tecnico Santiago' THEN x.santiago
    WHEN 'Servicio Tecnico Concepcion' THEN x.concepcion
    WHEN 'Servicio Tecnico Valdivia' THEN x.valdivia
    ELSE x.temuco
  END,
  x.aplica_garantia,
  'ACTIVO'
FROM sucursales s
CROSS JOIN (VALUES
  ('Compresor', 'Equipos de aire comprimido y taller', 15000, 18000, 17000, 16000, TRUE),
  ('Desbrozadora', 'Equipos de corte y desmalezado', 24000, 26000, 25000, 24500, TRUE),
  ('Motosierra', 'Motosierras y equipos forestales livianos', 22000, 25000, 24000, 23000, TRUE),
  ('Refrigerador', 'Equipos de frio domestico o comercial', 26000, 30000, 28000, 27000, TRUE),
  ('Generador', 'Generadores portatiles y respaldo electrico', 21000, 24000, 23000, 22000, TRUE),
  ('Lavadora', 'Lavadoras automaticas y equipos linea blanca', 25000, 29000, 27000, 26000, TRUE),
  ('Motor gasolina', 'Motores estacionarios a gasolina', 19000, 23000, 21000, 20000, TRUE)
) AS x(nombre, descripcion, temuco, santiago, concepcion, valdivia, aplica_garantia);

INSERT INTO precios_modelo_sucursal (id_sucursal, id_modelo, valor_revision, valor_mano_obra, estado)
SELECT s.id_sucursal, m.id_modelo, tm.valor_ingreso, 0, 'ACTIVO'
FROM sucursales s
CROSS JOIN productos_modelo m
INNER JOIN tipos_maquina tm ON tm.id_sucursal = s.id_sucursal
  AND tm.nombre = CASE
    WHEN m.codigo_comercial IN ('CP-50') THEN 'Compresor'
    WHEN m.codigo_comercial IN ('143R-II') THEN 'Desbrozadora'
    WHEN m.codigo_comercial IN ('120-MKII') THEN 'Motosierra'
    WHEN m.codigo_comercial IN ('DF-320', 'FX-400') THEN 'Refrigerador'
    WHEN m.codigo_comercial IN ('GP-2200') THEN 'Generador'
    WHEN m.codigo_comercial IN ('LV-18') THEN 'Lavadora'
    ELSE 'Motor gasolina'
  END;

INSERT INTO repuestos (id_sucursal, codigo, nombre, marca, precio, stock, estado)
SELECT s.id_sucursal, x.codigo, x.nombre, x.marca,
  CASE s.nombre
    WHEN 'Servicio Tecnico Santiago' THEN x.precio + 2500
    WHEN 'Servicio Tecnico Concepcion' THEN x.precio + 1200
    WHEN 'Servicio Tecnico Valdivia' THEN x.precio + 900
    ELSE x.precio
  END,
  x.stock,
  'ACTIVO'
FROM sucursales s
CROSS JOIN (VALUES
  ('NGK-BPMR7A', 'Bujia NGK BPMR7A', 'NGK', 4500, 20),
  ('FILT-120', 'Filtro de aire motosierra 120', 'Husqvarna', 6900, 12),
  ('KIT-MT150', 'Kit empaquetadura carburador MT-150', 'MotoTech', 12500, 8),
  ('MOD-DF320', 'Modulo de control DF-320', 'Defenza', 48000, 4),
  ('PRES-CP50', 'Presostato compresor CP-50', 'ACME', 18000, 6),
  ('BOM-LV18', 'Bomba de drenaje LV-18', 'Defenza', 22000, 5)
) AS x(codigo, nombre, marca, precio, stock);

WITH productos_seed (numero_serie, marca, modelo, tipo_nombre, descripcion, codigo_modelo, cliente_nombre, sucursal_nombre, estado_garantia, alerta_propiedad) AS (
  VALUES
    ('SC-ACME-0001', 'ACME', 'Generador portatil GP-2200', 'Generador', 'Generador portatil para respaldo electrico', 'GP-2200', 'Inversiones del Norte SpA', 'Servicio Tecnico Temuco', 'ACTIVA', FALSE),
    ('SC-ACME-0002', 'ACME', 'Compresor CP-50', 'Compresor', 'Compresor de taller 50 litros', 'CP-50', 'Agricola Rio Cautin', 'Servicio Tecnico Temuco', 'VENCIDA', FALSE),
    ('SC-HUSQ-0001', 'Husqvarna', 'Motosierra 120 Mark II', 'Motosierra', 'Motosierra uso forestal liviano', '120-MKII', 'Inversiones del Norte SpA', 'Servicio Tecnico Temuco', 'ACTIVA', FALSE),
    ('SC-HUSQ-0002', 'Husqvarna', 'Desbrozadora 143R-II', 'Desbrozadora', 'Equipo de corte profesional', '143R-II', 'Comercial Andes Ltda.', 'Servicio Tecnico Santiago', 'VENCIDA', FALSE),
    ('SC-DEF-0001', 'Defenza', 'Refrigerador DF-320', 'Refrigerador', 'Refrigerador domestico dos puertas', 'DF-320', 'Minera del Sur S.A.', 'Servicio Tecnico Concepcion', 'ACTIVA', FALSE),
    ('SC-DEF-0002', 'Defenza', 'Lavadora LV-18', 'Lavadora', 'Lavadora automatica 18 kg', 'LV-18', 'Minera del Sur S.A.', 'Servicio Tecnico Concepcion', 'EN_REVISION', FALSE),
    ('SC-MOTO-0001', 'MotoTech', 'Motor MT-150', 'Motor gasolina', 'Motor estacionario a gasolina', 'MT-150', 'Constructora Horizonte', 'Servicio Tecnico Santiago', 'PENDIENTE', TRUE),
    ('SC-REFRI-0001', 'FrioMax', 'Refrigerador FX-400', 'Refrigerador', 'Refrigerador comercial de alto volumen', 'FX-400', 'Frigorifico Pacifico Ltda.', 'Servicio Tecnico Concepcion', 'VENCIDA', FALSE),
    ('SC-VALD-0001', 'Husqvarna', 'Motosierra 120 Mark II', 'Motosierra', 'Equipo de demostracion Valdivia', '120-MKII', 'Forestal Valdivia Ltda.', 'Servicio Tecnico Valdivia', 'ACTIVA', FALSE)
)
INSERT INTO productos (numero_serie, marca, modelo, id_tipo_maquina, tipo_maquina, descripcion, id_modelo, id_cliente, id_sucursal, estado_garantia, alerta_propiedad)
SELECT ps.numero_serie, ps.marca, ps.modelo, tm.id_tipo_maquina, tm.nombre, ps.descripcion, pm.id_modelo, c.id_cliente, s.id_sucursal, ps.estado_garantia, ps.alerta_propiedad
FROM productos_seed ps
INNER JOIN sucursales s ON s.nombre = ps.sucursal_nombre
INNER JOIN clientes c ON c.nombre = ps.cliente_nombre AND c.id_sucursal = s.id_sucursal
INNER JOIN tipos_maquina tm ON tm.nombre = ps.tipo_nombre AND tm.id_sucursal = s.id_sucursal
LEFT JOIN productos_modelo pm ON pm.codigo_comercial = ps.codigo_modelo;

WITH ordenes_seed (numero_serie, tecnico_email, tipo_atencion, descripcion_problema, diagnostico, informe_tecnico, mano_obra, estado, garantia_admin, observacion_admin) AS (
  VALUES
    ('SC-ACME-0001', 'tecnico.temuco@serialcare.cl', 'REPARACION', 'Cliente reporta dificultad de partida en frio.', 'Pendiente de primera revision.', '', 0, 'PENDIENTE', NULL::BOOLEAN, NULL),
    ('SC-HUSQ-0001', 'tecnico.temuco@serialcare.cl', 'GARANTIA', 'Equipo ingresa por perdida de potencia.', 'Filtro y carburacion en revision.', 'Se recomienda limpieza y cambio de filtro.', 22000, 'EN_DIAGNOSTICO', NULL::BOOLEAN, NULL),
    ('SC-ACME-0002', 'tecnico@serialcare.cl', 'GARANTIA', 'Compresor evaluado por solicitud fuera de periodo.', 'Garantia vencida y presostato defectuoso.', 'Cliente rechaza reparacion fuera de garantia.', 24000, 'CERRADA', FALSE, 'Garantia rechazada por vencimiento.'),
    ('SC-HUSQ-0002', 'tecnico.santiago@serialcare.cl', 'MANTENCION', 'Desbrozadora ingresa para mantencion preventiva.', 'Se detecta desgaste normal en filtro.', 'Ajuste de carburacion y limpieza general.', 30000, 'EN_DIAGNOSTICO', NULL::BOOLEAN, NULL),
    ('SC-MOTO-0001', 'tecnico.santiago@serialcare.cl', 'GARANTIA', 'Producto con alerta de propiedad solicita revision documental.', 'Pendiente validacion documental.', '', 0, 'PENDIENTE', NULL::BOOLEAN, NULL),
    ('SC-DEF-0001', 'tecnico.concepcion@serialcare.cl', 'GARANTIA', 'Refrigerador con falla de modulo de control.', 'Modulo de control defectuoso.', 'Modulo reemplazado y temperatura validada.', 26000, 'REPARADA', TRUE, 'Aceptada como garantia interna.'),
    ('SC-DEF-0002', 'tecnico.concepcion@serialcare.cl', 'REPARACION', 'Lavadora no drena correctamente.', 'Bomba de drenaje defectuosa.', 'Bomba reemplazada y ciclo probado completo.', 26000, 'REPARADA', FALSE, 'Reparacion comun aprobada por cliente.'),
    ('SC-REFRI-0001', 'tecnico.concepcion@serialcare.cl', 'MANTENCION', 'Refrigerador comercial requiere mantencion.', 'Termostato fuera de rango.', 'Cambio de termostato y validacion de temperatura.', 26000, 'CERRADA', FALSE, 'Caso cerrado como reparacion comun.'),
    ('SC-VALD-0001', 'tecnico.valdivia@serialcare.cl', 'REPARACION', 'Equipo nuevo de Valdivia para prueba multisitio.', 'Pendiente revision inicial.', '', 0, 'PENDIENTE', NULL::BOOLEAN, NULL)
)
INSERT INTO ordenes_servicio (id_sucursal, id_cliente, id_producto, id_tipo_maquina, id_tecnico, id_modelo, costo_ingreso_taller, valor_ingreso, valor_revision, tipo_atencion, tipo_orden, descripcion_problema, diagnostico, informe_tecnico, mano_obra, garantia_aprobada_por_admin, observacion_admin, estado)
SELECT p.id_sucursal, p.id_cliente, p.id_producto, p.id_tipo_maquina, u.id_usuario, p.id_modelo, s.costo_ingreso_taller, tm.valor_ingreso, tm.valor_ingreso, os.tipo_atencion, os.tipo_atencion, os.descripcion_problema, os.diagnostico, os.informe_tecnico, os.mano_obra, os.garantia_admin, os.observacion_admin, os.estado
FROM ordenes_seed os
INNER JOIN productos p ON p.numero_serie = os.numero_serie
INNER JOIN sucursales s ON s.id_sucursal = p.id_sucursal
INNER JOIN tipos_maquina tm ON tm.id_tipo_maquina = p.id_tipo_maquina
LEFT JOIN usuarios u ON u.email = os.tecnico_email;

WITH repuestos_seed (numero_serie, codigo, cantidad, cubierto_garantia, observacion) AS (
  VALUES
    ('SC-HUSQ-0001', 'NGK-BPMR7A', 1, TRUE, 'Repuesto sugerido para falla de encendido.'),
    ('SC-HUSQ-0001', 'FILT-120', 1, TRUE, 'Filtro contaminado durante diagnostico.'),
    ('SC-MOTO-0001', 'KIT-MT150', 1, FALSE, 'Pendiente de validacion por alerta de propiedad.'),
    ('SC-DEF-0001', 'MOD-DF320', 1, TRUE, 'Repuesto cubierto por garantia interna.'),
    ('SC-ACME-0002', 'PRES-CP50', 1, FALSE, 'No cubierto por garantia vencida.'),
    ('SC-DEF-0002', 'BOM-LV18', 1, FALSE, 'Repuesto facturado como reparacion comun.')
)
INSERT INTO repuestos_usados (id_orden, id_repuesto, nombre_repuesto, cantidad, precio_unitario, subtotal, cubierto_garantia, observacion)
SELECT o.id_orden, r.id_repuesto, r.nombre, rs.cantidad, r.precio, rs.cantidad * r.precio, rs.cubierto_garantia, rs.observacion
FROM repuestos_seed rs
INNER JOIN productos p ON p.numero_serie = rs.numero_serie
INNER JOIN ordenes_servicio o ON o.id_producto = p.id_producto
INNER JOIN repuestos r ON r.id_sucursal = o.id_sucursal AND r.codigo = rs.codigo;

INSERT INTO cotizaciones (id_orden, total_repuestos, valor_ingreso, mano_obra, total_general, total, estado, observacion, fecha_respuesta)
SELECT o.id_orden, COALESCE(SUM(ru.subtotal), 0), o.valor_ingreso, o.mano_obra, o.valor_ingreso + o.mano_obra + COALESCE(SUM(ru.subtotal), 0), o.valor_ingreso + o.mano_obra + COALESCE(SUM(ru.subtotal), 0),
  CASE o.estado WHEN 'CERRADA' THEN 'APROBADA' WHEN 'REPARADA' THEN 'ENVIADA' ELSE 'BORRADOR' END,
  'Cotizacion generada desde datos de prueba.',
  CASE WHEN o.estado = 'CERRADA' THEN CURRENT_TIMESTAMP - INTERVAL '1 day' ELSE NULL END
FROM ordenes_servicio o
LEFT JOIN repuestos_usados ru ON ru.id_orden = o.id_orden
GROUP BY o.id_orden;

WITH evidencias_seed (numero_serie, tipo, nombre_archivo, referencia_url, descripcion) AS (
  VALUES
    ('SC-HUSQ-0001', 'IMAGEN', 'husq-0001-carburador.jpg', 'https://demo.serialcare.local/evidencias/husq-0001-carburador.jpg', 'Foto de carburador antes de limpieza.'),
    ('SC-HUSQ-0001', 'TEXTO', 'husq-0001-ingreso.txt', 'https://demo.serialcare.local/evidencias/husq-0001-ingreso.txt', 'Registro simulado de ingreso a taller.'),
    ('SC-MOTO-0001', 'PDF', 'moto-0001-documentos.pdf', 'https://demo.serialcare.local/evidencias/moto-0001-documentos.pdf', 'Documento simulado para validar alerta de propiedad.'),
    ('SC-DEF-0001', 'IMAGEN', 'def-0001-modulo.jpg', 'https://demo.serialcare.local/evidencias/def-0001-modulo.jpg', 'Evidencia de modulo de control reemplazado.'),
    ('SC-VALD-0001', 'TEXTO', 'vald-0001-ingreso.txt', 'https://demo.serialcare.local/evidencias/vald-0001-ingreso.txt', 'Referencia inicial para prueba de Valdivia.')
)
INSERT INTO evidencias_orden (id_orden, tipo, nombre_archivo, referencia_url, url_archivo, descripcion)
SELECT o.id_orden, es.tipo, es.nombre_archivo, es.referencia_url, es.referencia_url, es.descripcion
FROM evidencias_seed es
INNER JOIN productos p ON p.numero_serie = es.numero_serie
INNER JOIN ordenes_servicio o ON o.id_producto = p.id_producto;

WITH garantias_seed (numero_serie, tecnico_email, estado, observacion, observacion_admin, fecha_solicitud, fecha_revision) AS (
  VALUES
    ('SC-HUSQ-0001', 'tecnico.temuco@serialcare.cl', 'PENDIENTE', 'Tecnico solicita evaluacion de garantia por perdida de potencia.', NULL, CURRENT_TIMESTAMP - INTERVAL '2 days', NULL::TIMESTAMP),
    ('SC-MOTO-0001', 'tecnico.santiago@serialcare.cl', 'EN_REVISION', 'Sucursal Santiago revisa garantia con alerta de propiedad.', NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', NULL::TIMESTAMP),
    ('SC-DEF-0001', 'tecnico.concepcion@serialcare.cl', 'APROBADA', 'Falla de modulo de control cubierta por garantia interna.', 'Aceptada por admin de sucursal.', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('SC-ACME-0002', 'tecnico@serialcare.cl', 'RECHAZADA', 'Solicitud fuera de periodo de cobertura.', 'Rechazada por garantia vencida.', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
)
INSERT INTO garantias (id_orden, id_producto, id_sucursal, id_tecnico, estado, observacion, observacion_admin, observacion_marca, fecha_solicitud, fecha_revision)
SELECT o.id_orden, p.id_producto, o.id_sucursal, COALESCE(u.id_usuario, o.id_tecnico), gs.estado, gs.observacion, gs.observacion_admin, gs.observacion_admin, gs.fecha_solicitud, gs.fecha_revision
FROM garantias_seed gs
INNER JOIN productos p ON p.numero_serie = gs.numero_serie
INNER JOIN ordenes_servicio o ON o.id_producto = p.id_producto
LEFT JOIN usuarios u ON u.email = gs.tecnico_email;