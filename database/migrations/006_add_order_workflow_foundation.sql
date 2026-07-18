ALTER TABLE ordenes_servicio
  ADD COLUMN IF NOT EXISTS id_creado_por INTEGER NULL,
  ADD COLUMN IF NOT EXISTS id_responsable INTEGER NULL,
  ADD COLUMN IF NOT EXISTS fecha_toma TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS accesorios_recibidos TEXT NULL,
  ADD COLUMN IF NOT EXISTS observaciones_recepcion TEXT NULL,
  ADD COLUMN IF NOT EXISTS fecha_lista_entrega TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_ordenes_servicio_creado_por_usuario'
      AND conrelid = 'public.ordenes_servicio'::regclass
  ) THEN
    ALTER TABLE ordenes_servicio
      ADD CONSTRAINT fk_ordenes_servicio_creado_por_usuario
      FOREIGN KEY (id_creado_por)
      REFERENCES usuarios(id_usuario)
      ON UPDATE NO ACTION
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_ordenes_servicio_responsable_usuario'
      AND conrelid = 'public.ordenes_servicio'::regclass
  ) THEN
    ALTER TABLE ordenes_servicio
      ADD CONSTRAINT fk_ordenes_servicio_responsable_usuario
      FOREIGN KEY (id_responsable)
      REFERENCES usuarios(id_usuario)
      ON UPDATE NO ACTION
      ON DELETE RESTRICT;
  END IF;
END
$$;

UPDATE ordenes_servicio AS orden
SET id_responsable = orden.id_tecnico
FROM usuarios AS usuario
WHERE orden.id_responsable IS NULL
  AND orden.id_tecnico IS NOT NULL
  AND usuario.id_usuario = orden.id_tecnico;

CREATE TABLE IF NOT EXISTS historial_estados_orden (
  id_historial SERIAL PRIMARY KEY,
  id_orden INTEGER NOT NULL,
  estado_anterior VARCHAR(30) NULL,
  estado_nuevo VARCHAR(30) NOT NULL,
  id_usuario INTEGER NULL,
  accion VARCHAR(60) NOT NULL,
  observacion TEXT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historial_estados_orden_orden
    FOREIGN KEY (id_orden)
    REFERENCES ordenes_servicio(id_orden)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT,
  CONSTRAINT fk_historial_estados_orden_usuario
    FOREIGN KEY (id_usuario)
    REFERENCES usuarios(id_usuario)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_historial_estados_orden_orden_fecha
  ON historial_estados_orden (id_orden, fecha_creacion DESC, id_historial DESC);

CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_estado
  ON ordenes_servicio (estado);

CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_responsable_estado
  ON ordenes_servicio (id_responsable, estado);

CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_fecha_creacion
  ON ordenes_servicio (fecha_creacion DESC, id_orden DESC);
