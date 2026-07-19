ALTER TABLE repuestos
  ADD COLUMN IF NOT EXISTS stock_minimo INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_repuestos_stock_minimo_no_negativo'
      AND conrelid = 'public.repuestos'::regclass
  ) THEN
    ALTER TABLE repuestos
      ADD CONSTRAINT ck_repuestos_stock_minimo_no_negativo
      CHECK (stock_minimo >= 0);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id_movimiento SERIAL PRIMARY KEY,
  id_repuesto INTEGER NOT NULL,
  id_orden INTEGER NULL,
  id_detalle_repuesto INTEGER NULL,
  tipo_movimiento VARCHAR(30) NOT NULL,
  cantidad INTEGER NOT NULL,
  stock_anterior INTEGER NOT NULL,
  stock_nuevo INTEGER NOT NULL,
  motivo TEXT NULL,
  id_usuario INTEGER NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clave_idempotencia VARCHAR(120) NULL,
  CONSTRAINT ck_movimientos_inventario_tipo
    CHECK (tipo_movimiento IN (
      'ENTRADA',
      'AJUSTE_POSITIVO',
      'AJUSTE_NEGATIVO',
      'CONSUMO_REPARACION',
      'DEVOLUCION_REPARACION'
    )),
  CONSTRAINT ck_movimientos_inventario_cantidad_positiva
    CHECK (cantidad > 0),
  CONSTRAINT ck_movimientos_inventario_stock_anterior_no_negativo
    CHECK (stock_anterior >= 0),
  CONSTRAINT ck_movimientos_inventario_stock_nuevo_no_negativo
    CHECK (stock_nuevo >= 0),
  CONSTRAINT ck_movimientos_inventario_consumo_con_orden
    CHECK (tipo_movimiento <> 'CONSUMO_REPARACION' OR id_orden IS NOT NULL),
  CONSTRAINT fk_movimientos_inventario_repuesto
    FOREIGN KEY (id_repuesto)
    REFERENCES repuestos(id_repuesto)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT,
  CONSTRAINT fk_movimientos_inventario_orden
    FOREIGN KEY (id_orden)
    REFERENCES ordenes_servicio(id_orden)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT,
  CONSTRAINT fk_movimientos_inventario_detalle_repuesto
    FOREIGN KEY (id_detalle_repuesto)
    REFERENCES repuestos_usados(id_detalle)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT,
  CONSTRAINT fk_movimientos_inventario_usuario
    FOREIGN KEY (id_usuario)
    REFERENCES usuarios(id_usuario)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_movimientos_inventario_clave_idempotencia
  ON movimientos_inventario (clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_repuesto_fecha_desc
  ON movimientos_inventario (id_repuesto, fecha_creacion DESC);

CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_orden_fecha_desc
  ON movimientos_inventario (id_orden, fecha_creacion DESC);

CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_tipo
  ON movimientos_inventario (tipo_movimiento);

CREATE INDEX IF NOT EXISTS idx_repuestos_stock_stock_minimo
  ON repuestos (stock, stock_minimo);
