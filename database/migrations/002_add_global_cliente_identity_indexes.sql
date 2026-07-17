CREATE UNIQUE INDEX IF NOT EXISTS ux_clientes_rut_normalizado
ON clientes (UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g')))
WHERE rut IS NOT NULL
  AND BTRIM(rut) <> ''
  AND UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g')) <> '';

CREATE INDEX IF NOT EXISTS idx_clientes_email_normalizado
ON clientes (LOWER(BTRIM(email)))
WHERE email IS NOT NULL
  AND BTRIM(email) <> '';
