DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_attribute child_column
      ON child_column.attrelid = con.conrelid
      AND child_column.attnum = con.conkey[1]
    JOIN pg_attribute parent_column
      ON parent_column.attrelid = con.confrelid
      AND parent_column.attnum = con.confkey[1]
    WHERE con.conname = 'ordenes_servicio_id_producto_fkey'
      AND con.contype = 'f'
      AND con.conrelid = 'public.ordenes_servicio'::regclass
      AND con.confrelid = 'public.productos'::regclass
      AND array_length(con.conkey, 1) = 1
      AND child_column.attname = 'id_producto'
      AND parent_column.attname = 'id_producto'
  ) THEN
    RAISE EXCEPTION 'No existe la FK esperada ordenes_servicio_id_producto_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_attribute child_column
      ON child_column.attrelid = con.conrelid
      AND child_column.attnum = con.conkey[1]
    JOIN pg_attribute parent_column
      ON parent_column.attrelid = con.confrelid
      AND parent_column.attnum = con.confkey[1]
    WHERE con.conname = 'garantias_id_producto_fkey'
      AND con.contype = 'f'
      AND con.conrelid = 'public.garantias'::regclass
      AND con.confrelid = 'public.productos'::regclass
      AND array_length(con.conkey, 1) = 1
      AND child_column.attname = 'id_producto'
      AND parent_column.attname = 'id_producto'
  ) THEN
    RAISE EXCEPTION 'No existe la FK esperada garantias_id_producto_fkey';
  END IF;
END
$$;

ALTER TABLE ordenes_servicio
  DROP CONSTRAINT ordenes_servicio_id_producto_fkey;

ALTER TABLE ordenes_servicio
  ADD CONSTRAINT ordenes_servicio_id_producto_fkey
  FOREIGN KEY (id_producto)
  REFERENCES productos(id_producto)
  ON UPDATE NO ACTION
  ON DELETE RESTRICT;

ALTER TABLE garantias
  DROP CONSTRAINT garantias_id_producto_fkey;

ALTER TABLE garantias
  ADD CONSTRAINT garantias_id_producto_fkey
  FOREIGN KEY (id_producto)
  REFERENCES productos(id_producto)
  ON UPDATE NO ACTION
  ON DELETE RESTRICT;
