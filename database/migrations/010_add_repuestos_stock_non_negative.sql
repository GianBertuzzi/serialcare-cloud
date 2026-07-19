DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_repuestos_stock_no_negativo'
      AND conrelid = 'public.repuestos'::regclass
  ) THEN
    ALTER TABLE repuestos
      ADD CONSTRAINT ck_repuestos_stock_no_negativo
      CHECK (stock >= 0);
  END IF;
END
$$;
