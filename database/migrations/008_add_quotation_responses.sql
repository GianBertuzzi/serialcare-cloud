CREATE TABLE IF NOT EXISTS respuestas_cotizacion (
  id_respuesta SERIAL PRIMARY KEY,
  id_cotizacion INTEGER NOT NULL,
  id_orden INTEGER NOT NULL,
  version_cotizacion INTEGER NOT NULL,
  respuesta VARCHAR(40) NOT NULL,
  observacion TEXT NULL,
  id_registrada_por INTEGER NOT NULL,
  fecha_respuesta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_respuestas_cotizacion_id_cotizacion
    UNIQUE (id_cotizacion),
  CONSTRAINT ck_respuestas_cotizacion_respuesta
    CHECK (respuesta IN ('APROBADA', 'SOLICITA_NUEVA_COTIZACION', 'RECHAZADA')),
  CONSTRAINT ck_respuestas_cotizacion_version_positiva
    CHECK (version_cotizacion > 0),
  CONSTRAINT fk_respuestas_cotizacion_cotizacion
    FOREIGN KEY (id_cotizacion)
    REFERENCES cotizaciones(id_cotizacion)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT,
  CONSTRAINT fk_respuestas_cotizacion_orden
    FOREIGN KEY (id_orden)
    REFERENCES ordenes_servicio(id_orden)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT,
  CONSTRAINT fk_respuestas_cotizacion_usuario
    FOREIGN KEY (id_registrada_por)
    REFERENCES usuarios(id_usuario)
    ON UPDATE NO ACTION
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_respuestas_cotizacion_orden_fecha_desc
  ON respuestas_cotizacion (id_orden, fecha_respuesta DESC);

CREATE INDEX IF NOT EXISTS idx_respuestas_cotizacion_respuesta
  ON respuestas_cotizacion (respuesta);

CREATE INDEX IF NOT EXISTS idx_respuestas_cotizacion_registrada_por
  ON respuestas_cotizacion (id_registrada_por);
