CREATE UNIQUE INDEX IF NOT EXISTS ux_productos_numero_serie_normalizado
ON productos (UPPER(BTRIM(numero_serie)))
WHERE numero_serie IS NOT NULL
  AND BTRIM(numero_serie) <> '';

DROP INDEX IF EXISTS idx_productos_numero_serie;
