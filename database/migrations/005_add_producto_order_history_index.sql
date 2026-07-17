CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_producto_historial
ON ordenes_servicio (id_producto, fecha_creacion DESC, id_orden DESC);
