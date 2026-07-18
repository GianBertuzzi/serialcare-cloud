ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtotal_original NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_descuento VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS valor_descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_descuento TEXT NULL,
  ADD COLUMN IF NOT EXISTS id_descuento_aplicado_por INTEGER NULL,
  ADD COLUMN IF NOT EXISTS fecha_descuento TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS total_final NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cerrada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS id_cerrada_por INTEGER NULL,
  ADD COLUMN IF NOT EXISTS pdf_estado VARCHAR(20) NOT NULL DEFAULT 'NO_GENERADO',
  ADD COLUMN IF NOT EXISTS pdf_nombre_archivo TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_blob_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_mime_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_size_bytes BIGINT NULL,
  ADD COLUMN IF NOT EXISTS fecha_pdf TIMESTAMP NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cotizaciones
    WHERE estado IS NULL OR BTRIM(estado) = ''
  ) THEN
    RAISE EXCEPTION 'No se puede reforzar cotizaciones.estado: existen valores nulos o vacios';
  END IF;
END
$$;

ALTER TABLE cotizaciones
  ALTER COLUMN estado SET DEFAULT 'BORRADOR',
  ALTER COLUMN estado SET NOT NULL;

UPDATE cotizaciones
SET version = 1,
    subtotal_original = COALESCE(total_general, total, total_repuestos + valor_ingreso + mano_obra, 0),
    total_final = COALESCE(total, total_general, total_repuestos + valor_ingreso + mano_obra, 0),
    cerrada = FALSE
WHERE version = 1
  AND subtotal_original = 0
  AND total_final = 0
  AND cerrada = FALSE;

ALTER TABLE cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_id_orden_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_cotizaciones_orden_version'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT uq_cotizaciones_orden_version
      UNIQUE (id_orden, version);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_cotizaciones_version_positiva'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT ck_cotizaciones_version_positiva
      CHECK (version > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_cotizaciones_tipo_descuento'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT ck_cotizaciones_tipo_descuento
      CHECK (tipo_descuento IS NULL OR tipo_descuento IN ('PORCENTAJE', 'MONTO_FIJO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_cotizaciones_valor_descuento_no_negativo'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT ck_cotizaciones_valor_descuento_no_negativo
      CHECK (valor_descuento >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_cotizaciones_total_final_no_negativo'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT ck_cotizaciones_total_final_no_negativo
      CHECK (total_final >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_cotizaciones_cierre_con_fecha'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT ck_cotizaciones_cierre_con_fecha
      CHECK (cerrada = FALSE OR fecha_cierre IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_cotizaciones_descuento_usuario'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT fk_cotizaciones_descuento_usuario
      FOREIGN KEY (id_descuento_aplicado_por)
      REFERENCES usuarios(id_usuario)
      ON UPDATE NO ACTION
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_cotizaciones_cierre_usuario'
      AND conrelid = 'public.cotizaciones'::regclass
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT fk_cotizaciones_cierre_usuario
      FOREIGN KEY (id_cerrada_por)
      REFERENCES usuarios(id_usuario)
      ON UPDATE NO ACTION
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_orden_version_desc
  ON cotizaciones (id_orden, version DESC);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado
  ON cotizaciones (estado);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cerrada
  ON cotizaciones (cerrada);

CREATE OR REPLACE FUNCTION proteger_cotizacion_cerrada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.cerrada THEN
    RAISE EXCEPTION 'La cotizacion cerrada no puede modificarse ni eliminarse';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_proteger_cotizacion_cerrada ON cotizaciones;

CREATE TRIGGER trg_proteger_cotizacion_cerrada
  BEFORE UPDATE OR DELETE ON cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION proteger_cotizacion_cerrada();
