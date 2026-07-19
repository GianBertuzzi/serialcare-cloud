const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");
const { uploadEvidenceFile, uploadPrivateBuffer, downloadPrivateBuffer, deletePrivateBlob } = require("../services/azureBlob.service");
const { generateQuotationPdf } = require("../services/quotationPdf.service");

const router = express.Router();

const TIPOS_ATENCION = ["REVISION_GARANTIA", "REPARACION", "MANTENCION", "PUESTA_EN_MARCHA"];
const TIPOS_EVIDENCIA = ["IMAGEN", "PDF", "LINK", "TEXTO", "DOCUMENTO"];
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024;

const evidenciaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVIDENCE_FILE_SIZE },
  fileFilter(req, file, callback) {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.mimetype)) {
      return callback(new Error("Archivo no permitido. Use imagen JPG/PNG/WEBP, PDF, TXT, DOC o DOCX."));
    }

    return callback(null, true);
  }
});

function uploadEvidenciaMiddleware(req, res, next) {
  evidenciaUpload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "El archivo no puede superar 10 MB" });
    }

    return res.status(400).json({ error: error.message || "No se pudo procesar el archivo" });
  });
}

function inferTipoEvidencia(mimetype) {
  if (mimetype?.startsWith("image/")) return "IMAGEN";
  if (mimetype === "application/pdf") return "PDF";
  if (mimetype === "text/plain") return "TEXTO";
  return "DOCUMENTO";
}

const ORDEN_SELECT = `SELECT
  o.id_orden,
  o.id_sucursal,
  s.nombre AS nombre_sucursal,
  s.ciudad AS ciudad_sucursal,
  s.region AS region_sucursal,
  s.direccion AS direccion_sucursal,
  o.id_cliente,
  c.nombre AS cliente_nombre,
  c.rut AS cliente_rut,
  c.email AS cliente_email,
  c.telefono AS cliente_telefono,
  c.direccion AS cliente_direccion,
  c.id_usuario AS cliente_id_usuario,
  o.id_producto,
  p.numero_serie,
  p.marca,
  p.modelo,
  p.tipo_maquina AS tipo_maquina_texto,
  p.id_tipo_maquina AS id_tipo_maquina_producto,
  COALESCE(tm.nombre, p.tipo_maquina) AS tipo_maquina,
  tm.descripcion AS descripcion_tipo_maquina,
  tm.valor_ingreso AS valor_ingreso_tipo_maquina,
  tm.aplica_garantia AS tipo_maquina_aplica_garantia,
  p.descripcion AS descripcion_producto,
  p.estado_garantia,
  p.alerta_propiedad,
  p.fecha_registro AS fecha_registro_producto,
  o.id_modelo,
  pm.codigo_comercial,
  pm.descripcion AS descripcion_modelo,
  pm.familia AS familia_modelo,
  pm.marca AS marca_modelo,
  pm.certificado AS modelo_certificado,
  o.id_tipo_maquina,
  o.id_tipo_reparacion,
  tr.nombre AS tipo_reparacion,
  tr.descripcion AS descripcion_tipo_reparacion,
  o.id_tecnico,
  u.nombre AS tecnico_nombre,
  u.email AS tecnico_email,
  o.id_creado_por,
  creador.nombre AS creado_por_nombre,
  o.id_responsable,
  responsable.nombre AS responsable_nombre,
  responsable.email AS responsable_email,
  o.fecha_toma,
  o.accesorios_recibidos,
  o.observaciones_recepcion,
  o.fecha_lista_entrega,
  o.fecha_entrega,
  o.fecha_cierre,
  o.version,
  o.costo_ingreso_taller,
  o.valor_ingreso,
  o.valor_revision,
  o.tipo_atencion,
  o.tipo_orden,
  o.descripcion_problema,
  o.diagnostico,
  o.informe_tecnico,
  o.mano_obra,
  o.garantia_aprobada_por_admin,
  o.observacion_admin,
  o.estado,
  o.fecha_creacion
FROM ordenes_servicio o
INNER JOIN sucursales s ON s.id_sucursal = o.id_sucursal
INNER JOIN clientes c ON c.id_cliente = o.id_cliente
INNER JOIN productos p ON p.id_producto = o.id_producto
LEFT JOIN productos_modelo pm ON pm.id_modelo = o.id_modelo
LEFT JOIN tipos_maquina tm ON tm.id_tipo_maquina = o.id_tipo_maquina
LEFT JOIN tipos_reparacion tr ON tr.id_tipo_reparacion = o.id_tipo_reparacion
LEFT JOIN usuarios u ON u.id_usuario = o.id_tecnico
LEFT JOIN usuarios creador ON creador.id_usuario = o.id_creado_por
LEFT JOIN usuarios responsable ON responsable.id_usuario = o.id_responsable`;

const GARANTIA_DETALLE_SELECT = `SELECT
  g.id_garantia,
  g.id_orden,
  g.id_producto,
  g.id_sucursal,
  s.nombre AS nombre_sucursal,
  g.id_tecnico,
  u.nombre AS tecnico,
  u.email AS tecnico_email,
  p.numero_serie,
  p.marca,
  p.modelo,
  o.diagnostico,
  o.informe_tecnico,
  g.estado,
  g.observacion,
  g.observacion_admin,
  g.observacion_marca,
  g.fecha_solicitud,
  g.fecha_revision
FROM garantias g
INNER JOIN ordenes_servicio o ON o.id_orden = g.id_orden
INNER JOIN productos p ON p.id_producto = g.id_producto
LEFT JOIN usuarios u ON u.id_usuario = g.id_tecnico
LEFT JOIN sucursales s ON s.id_sucursal = g.id_sucursal`;

router.use(verificarToken);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTipoAtencion(value) {
  const tipo = clean(value || "REPARACION").toUpperCase();
  if (tipo === "MANTENIMIENTO") return "MANTENCION";
  if (tipo === "GARANTIA") return "REVISION_GARANTIA";
  return tipo;
}

function parsePositiveInteger(value, defaultValue) {
  const numberValue = value === undefined || value === null || value === "" ? defaultValue : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) return null;
  return numberValue;
}

function parseMoney(value, defaultValue = 0) {
  const numberValue = value === undefined || value === null || value === "" ? defaultValue : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue);
}

function parseNonNegativeDecimal(value) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

async function getUsuarioSucursal(idUsuario, client = db) {
  const result = await client.query(
    `SELECT
      u.id_usuario,
      u.id_sucursal,
      s.nombre AS nombre_sucursal,
      s.estado AS estado_sucursal,
      s.costo_ingreso_taller
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

function requireSucursal(usuarioSucursal, res) {
  if (!usuarioSucursal?.id_sucursal) {
    res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    return false;
  }

  return true;
}

async function getOrdenDetalle(idOrden) {
  const result = await db.query(
    `${ORDEN_SELECT}
    WHERE o.id_orden = $1
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
}

async function getGarantiaDetalle(idGarantia) {
  const result = await db.query(
    `${GARANTIA_DETALLE_SELECT}
    WHERE g.id_garantia = $1
    LIMIT 1`,
    [idGarantia]
  );

  return result.rows[0] || null;
}

async function getOrdenParaUsuario(idOrden, usuario, allowMarca = false, allowCliente = false) {
  const orden = await getOrdenDetalle(idOrden);

  if (!orden) {
    return { status: 404, error: "Orden no encontrada" };
  }

  if (usuario.rol === "MARCA" && allowMarca) {
    return { orden, usuarioSucursal: null };
  }

  if (usuario.rol === "CLIENTE" && allowCliente) {
    if (Number(orden.cliente_id_usuario) !== Number(usuario.id_usuario)) {
      return { status: 404, error: "Orden no encontrada para el cliente" };
    }

    return { orden, usuarioSucursal: null };
  }

  const usuarioSucursal = await getUsuarioSucursal(usuario.id_usuario);

  if (!usuarioSucursal?.id_sucursal) {
    return { status: 400, error: "Usuario no tiene sucursal asignada" };
  }

  if (Number(orden.id_sucursal) !== Number(usuarioSucursal.id_sucursal)) {
    return { status: 404, error: "Orden no encontrada para la sucursal del usuario" };
  }

  if (
    usuario.rol === "TECNICO" &&
    orden.id_responsable &&
    Number(orden.id_responsable) !== Number(usuario.id_usuario)
  ) {
    return { status: 404, error: "Orden no encontrada para el tecnico" };
  }

  return { orden, usuarioSucursal };
}

async function createCotizacionVersion(client, idOrden, totalRepuestos, valorIngreso, manoObra, observacion = null) {
  const versionResult = await client.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS siguiente_version
    FROM cotizaciones
    WHERE id_orden = $1`,
    [idOrden]
  );
  const version = Number(versionResult.rows[0].siguiente_version);
  const subtotalOriginal = totalRepuestos + valorIngreso + manoObra;
  const result = await client.query(
    `INSERT INTO cotizaciones (
      id_orden, version, total_repuestos, valor_ingreso, mano_obra,
      total_general, total, estado, observacion, subtotal_original,
      tipo_descuento, valor_descuento, total_final, cerrada, pdf_estado
    )
    VALUES ($1, $2, $3, $4, $5, $6, $6, 'BORRADOR', $7, $8, NULL, 0, $8, FALSE, 'NO_GENERADO')
    RETURNING
      id_cotizacion, id_orden, version, total_repuestos, valor_ingreso,
      mano_obra, total_general, total, estado, observacion,
      subtotal_original, tipo_descuento, valor_descuento, motivo_descuento,
      id_descuento_aplicado_por, fecha_descuento, total_final, cerrada,
      fecha_cierre, id_cerrada_por, pdf_estado, pdf_nombre_archivo,
      pdf_blob_name, pdf_url, pdf_hash, pdf_mime_type, pdf_size_bytes,
      fecha_pdf, fecha_creacion, fecha_actualizacion, fecha_respuesta`,
    [idOrden, version, totalRepuestos, valorIngreso, manoObra, subtotalOriginal, observacion, subtotalOriginal]
  );

  return result.rows[0];
}

async function getRepuestos(idOrden) {
  const result = await db.query(
    `SELECT
      ru.id_detalle,
      ru.id_detalle AS id_repuesto_usado,
      ru.id_orden,
      ru.id_repuesto,
      ru.nombre_repuesto,
      r.codigo AS codigo_repuesto,
      r.marca AS marca_repuesto,
      r.stock AS stock_disponible,
      ru.cantidad,
      ru.precio_unitario,
      ru.subtotal,
      ru.cubierto_garantia,
      ru.observacion,
      ru.fecha_registro
    FROM repuestos_usados ru
    LEFT JOIN repuestos r ON r.id_repuesto = ru.id_repuesto
    WHERE ru.id_orden = $1
    ORDER BY ru.fecha_registro DESC, ru.id_detalle DESC`,
    [idOrden]
  );

  return result.rows;
}

async function getCotizacion(idOrden) {
  const result = await db.query(
    `SELECT
      c.id_cotizacion, c.id_orden, c.version, c.total_repuestos, c.valor_ingreso,
      c.mano_obra, c.total_general, c.total, c.estado, c.observacion,
      c.subtotal_original, c.tipo_descuento, c.valor_descuento, c.motivo_descuento,
      c.id_descuento_aplicado_por, c.fecha_descuento, c.total_final, c.cerrada,
      c.fecha_cierre, c.id_cerrada_por, c.pdf_estado, c.pdf_nombre_archivo,
      c.pdf_blob_name, c.pdf_url, c.pdf_hash, c.pdf_mime_type, c.pdf_size_bytes,
      c.fecha_pdf, c.fecha_creacion, c.fecha_actualizacion, c.fecha_respuesta,
      rc.respuesta,
      rc.observacion AS observacion_respuesta,
      rc.fecha_respuesta AS fecha_respuesta_cliente,
      rc.id_registrada_por,
      ur.nombre AS registrada_por_nombre
    FROM cotizaciones c
    LEFT JOIN respuestas_cotizacion rc ON rc.id_cotizacion = c.id_cotizacion
    LEFT JOIN usuarios ur ON ur.id_usuario = rc.id_registrada_por
    WHERE c.id_orden = $1
    ORDER BY c.version DESC
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
}

async function getCotizacionesResumen(idOrden) {
  const result = await db.query(
    `SELECT
      c.version, c.estado, c.subtotal_original, c.valor_descuento,
      c.total_final, c.cerrada, c.pdf_estado, c.fecha_creacion,
      rc.respuesta, rc.observacion AS observacion_respuesta,
      rc.fecha_respuesta AS fecha_respuesta_cliente,
      ur.nombre AS registrada_por_nombre
    FROM cotizaciones c
    LEFT JOIN respuestas_cotizacion rc ON rc.id_cotizacion = c.id_cotizacion
    LEFT JOIN usuarios ur ON ur.id_usuario = rc.id_registrada_por
    WHERE c.id_orden = $1
    ORDER BY c.version DESC`,
    [idOrden]
  );

  return result.rows;
}

async function getQuotationDocumentData(client, idOrden, version, idSucursal, lockRows = false) {
  const lockClause = lockRows ? "FOR UPDATE OF o" : "";
  const orderResult = await client.query(
    `SELECT
      o.id_orden, o.id_sucursal, o.estado, o.tipo_orden, o.tipo_atencion,
      o.descripcion_problema, o.diagnostico, o.observaciones_recepcion,
      o.garantia_aprobada_por_admin,
      c.nombre AS cliente_nombre, c.rut AS cliente_rut,
      c.telefono AS cliente_telefono, c.email AS cliente_email,
      c.direccion AS cliente_direccion,
      p.numero_serie, p.marca, p.modelo,
      COALESCE(tm.nombre, p.tipo_maquina) AS tipo_maquina,
      COALESCE(responsable.nombre, creador.nombre) AS responsable_nombre
    FROM ordenes_servicio o
    INNER JOIN clientes c ON c.id_cliente = o.id_cliente
    INNER JOIN productos p ON p.id_producto = o.id_producto
    LEFT JOIN tipos_maquina tm ON tm.id_tipo_maquina = o.id_tipo_maquina
    LEFT JOIN usuarios responsable ON responsable.id_usuario = o.id_responsable
    LEFT JOIN usuarios creador ON creador.id_usuario = o.id_creado_por
    WHERE o.id_orden = $1
      AND o.id_sucursal = $2
    ${lockClause}`,
    [idOrden, idSucursal]
  );

  if (orderResult.rows.length === 0) return null;

  const quoteLockClause = lockRows ? "FOR UPDATE" : "";
  const quotationResult = await client.query(
    `SELECT
      c.*,
      (SELECT MAX(version) FROM cotizaciones WHERE id_orden = $1) AS ultima_version
    FROM cotizaciones c
    WHERE c.id_orden = $1
      AND c.version = $2
    ${quoteLockClause}`,
    [idOrden, version]
  );

  if (quotationResult.rows.length === 0) {
    return { orden: orderResult.rows[0], cotizacion: null, repuestos: [] };
  }

  const partsResult = await client.query(
    `SELECT
      COALESCE(r.codigo, '-') AS codigo,
      ru.nombre_repuesto AS nombre,
      ru.cantidad,
      ru.precio_unitario AS valor_unitario,
      ru.subtotal
    FROM repuestos_usados ru
    LEFT JOIN repuestos r ON r.id_repuesto = ru.id_repuesto
    WHERE ru.id_orden = $1
    ORDER BY ru.id_detalle`,
    [idOrden]
  );

  return {
    orden: orderResult.rows[0],
    cotizacion: quotationResult.rows[0],
    repuestos: partsResult.rows
  };
}
async function getBorradorTecnicoFinalizado(idOrden) {
  const result = await db.query(
    `SELECT COALESCE((
      SELECT accion = 'FINALIZAR_BORRADOR_TECNICO'
      FROM historial_estados_orden
      WHERE id_orden = $1
        AND accion IN ('FINALIZAR_BORRADOR_TECNICO', 'REABRIR_COTIZACION')
      ORDER BY fecha_creacion DESC, id_historial DESC
      LIMIT 1
    ), FALSE) AS finalizado`,
    [idOrden]
  );

  return result.rows[0]?.finalizado === true;
}
async function getEvidencias(idOrden) {
  const result = await db.query(
    `SELECT
      id_evidencia,
      id_orden,
      tipo,
      nombre_archivo,
      referencia_url,
      COALESCE(url_archivo, referencia_url) AS url_archivo,
      descripcion,
      fecha_creacion,
      COALESCE(fecha_subida, fecha_creacion) AS fecha_subida
    FROM evidencias_orden
    WHERE id_orden = $1
    ORDER BY COALESCE(fecha_subida, fecha_creacion) DESC, id_evidencia DESC`,
    [idOrden]
  );

  return result.rows;
}

async function getGarantiaPorOrden(idOrden) {
  const result = await db.query(
    `${GARANTIA_DETALLE_SELECT}
    WHERE g.id_orden = $1
    ORDER BY g.fecha_solicitud DESC, g.id_garantia DESC
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
}

async function buildOrdenDetalle(orden) {
  const [repuestos, cotizacion, cotizaciones, garantia, evidencias, borradorTecnicoFinalizado] = await Promise.all([
    getRepuestos(orden.id_orden),
    getCotizacion(orden.id_orden),
    getCotizacionesResumen(orden.id_orden),
    getGarantiaPorOrden(orden.id_orden),
    getEvidencias(orden.id_orden),
    getBorradorTecnicoFinalizado(orden.id_orden)
  ]);

  return {
    orden,
    producto: {
      id_producto: orden.id_producto,
      numero_serie: orden.numero_serie,
      marca: orden.marca,
      modelo: orden.modelo,
      tipo_maquina: orden.tipo_maquina,
      descripcion: orden.descripcion_producto,
      estado_garantia: orden.estado_garantia,
      alerta_propiedad: orden.alerta_propiedad,
      fecha_registro: orden.fecha_registro_producto
    },
    modelo: {
      id_modelo: orden.id_modelo,
      codigo_comercial: orden.codigo_comercial,
      descripcion: orden.descripcion_modelo,
      familia: orden.familia_modelo,
      marca: orden.marca_modelo,
      certificado: orden.modelo_certificado
    },
    sucursal: {
      id_sucursal: orden.id_sucursal,
      nombre: orden.nombre_sucursal,
      ciudad: orden.ciudad_sucursal,
      region: orden.region_sucursal,
      direccion: orden.direccion_sucursal
    },
    cliente: {
      id_cliente: orden.id_cliente,
      nombre: orden.cliente_nombre,
      rut: orden.cliente_rut,
      email: orden.cliente_email,
      telefono: orden.cliente_telefono,
      direccion: orden.cliente_direccion
    },
    tecnico: orden.id_tecnico
      ? {
          id_tecnico: orden.id_tecnico,
          nombre: orden.tecnico_nombre,
          email: orden.tecnico_email
        }
      : null,
    repuestos,
    cotizacion,
    cotizaciones,
    garantia,
    evidencias,
    borrador_tecnico_finalizado: borradorTecnicoFinalizado
  };
}
router.get("/", verificarRol("ADMIN", "RECEPCIONISTA", "TECNICO"), async (req, res) => {
  const estado = clean(req.query?.estado).toUpperCase();
  const scope = clean(req.query?.scope).toLowerCase();

  if (estado.length > 30) {
    return res.status(400).json({ error: "estado no es valido" });
  }

  if (scope && !["disponibles", "mias"].includes(scope)) {
    return res.status(400).json({ error: "scope no es valido" });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res)) {
      return;
    }

    const conditions = [];
    const params = [];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    conditions.push(`o.id_sucursal = ${addParam(usuarioSucursal.id_sucursal)}`);

    if (estado) {
      conditions.push(`o.estado = ${addParam(estado)}`);
    }

    if (scope === "disponibles") {
      conditions.push("o.estado = 'INGRESADA'");
      conditions.push("o.id_responsable IS NULL");
    } else if (scope === "mias") {
      conditions.push(`o.id_responsable = ${addParam(req.usuario.id_usuario)}`);
    } else if (req.usuario.rol === "TECNICO") {
      const idUsuarioParam = addParam(req.usuario.id_usuario);
      conditions.push(`((o.estado = 'INGRESADA' AND o.id_responsable IS NULL) OR o.id_responsable = ${idUsuarioParam})`);
    }

    const result = await db.query(
      `${ORDEN_SELECT}
      WHERE ${conditions.join(" AND ")}
      ORDER BY o.fecha_creacion DESC, o.id_orden DESC`,
      params
    );

    return res.json({ ordenes: result.rows });
  } catch (error) {
    console.error("Error listando ordenes de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const tipoAtencion = normalizeTipoAtencion(req.body?.tipo_atencion || req.body?.tipo_orden);
  const descripcionProblema = clean(req.body?.descripcion_problema || req.body?.diagnostico);
  const accesoriosRecibidos = clean(req.body?.accesorios_recibidos) || null;
  const observacionesRecepcion = clean(req.body?.observaciones_recepcion) || null;
  const client = await db.pool.connect();

  if (!TIPOS_ATENCION.includes(tipoAtencion)) {
    return res.status(400).json({ error: "tipo_atencion no es valido" });
  }

  try {
    await client.query("BEGIN");

    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    if (usuarioSucursal.estado_sucursal !== "ACTIVA") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "La sucursal del usuario esta INACTIVA y no puede crear ordenes" });
    }

    let clienteId = Number(req.body?.id_cliente) || null;
    const clienteNuevo = req.body?.cliente_nuevo || null;

    if (!clienteId && clienteNuevo) {
      const nombreCliente = clean(clienteNuevo.nombre);

      if (!nombreCliente) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "cliente_nuevo.nombre es obligatorio" });
      }

      const clienteResult = await client.query(
        `INSERT INTO clientes (id_sucursal, nombre, rut, telefono, email, direccion, estado)
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')
        RETURNING id_cliente`,
        [
          usuarioSucursal.id_sucursal,
          nombreCliente,
          clean(clienteNuevo.rut) || null,
          clean(clienteNuevo.telefono) || null,
          clean(clienteNuevo.email).toLowerCase() || null,
          clean(clienteNuevo.direccion) || null
        ]
      );
      clienteId = clienteResult.rows[0].id_cliente;
    }

    if (clienteId) {
      const clienteCheck = await client.query(
        `SELECT id_cliente
        FROM clientes
        WHERE id_cliente = $1
          AND id_sucursal = $2
        LIMIT 1`,
        [clienteId, usuarioSucursal.id_sucursal]
      );

      if (clienteCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Cliente no encontrado para la sucursal" });
      }
    }

    let productoId = Number(req.body?.id_producto) || null;
    const productoNuevo = req.body?.producto_nuevo || null;
    const numeroSerie = clean(req.body?.numero_serie).toUpperCase();

    if (!productoId && productoNuevo) {
      if (!clienteId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Debe seleccionar o crear un cliente antes de crear una maquina" });
      }

      const serieNueva = clean(productoNuevo.numero_serie).toUpperCase();
      const marcaNueva = clean(productoNuevo.marca);
      const modeloNuevo = clean(productoNuevo.modelo);
      const idTipoMaquinaNuevo = Number(productoNuevo.id_tipo_maquina);

      if (!serieNueva || !marcaNueva || !modeloNuevo) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "producto_nuevo.numero_serie, marca y modelo son obligatorios" });
      }

      if (!Number.isInteger(idTipoMaquinaNuevo) || idTipoMaquinaNuevo <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "producto_nuevo.id_tipo_maquina es obligatorio" });
      }

      const tipoNuevoResult = await client.query(
        `SELECT id_tipo_maquina, nombre, valor_ingreso
        FROM tipos_maquina
        WHERE id_tipo_maquina = $1
          AND id_sucursal = $2
          AND estado = 'ACTIVO'
        LIMIT 1`,
        [idTipoMaquinaNuevo, usuarioSucursal.id_sucursal]
      );

      if (tipoNuevoResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Tipo de maquina no encontrado para la sucursal" });
      }

      const tipoNuevo = tipoNuevoResult.rows[0];
      const productoResult = await client.query(
        `INSERT INTO productos (
          id_cliente,
          id_sucursal,
          id_modelo,
          id_tipo_maquina,
          numero_serie,
          marca,
          modelo,
          tipo_maquina,
          descripcion,
          estado_garantia,
          alerta_propiedad
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'PENDIENTE'), $11)
        RETURNING id_producto`,
        [
          clienteId,
          usuarioSucursal.id_sucursal,
          productoNuevo.id_modelo ? Number(productoNuevo.id_modelo) : null,
          tipoNuevo.id_tipo_maquina,
          serieNueva,
          marcaNueva,
          modeloNuevo,
          tipoNuevo.nombre,
          clean(productoNuevo.descripcion) || null,
          clean(productoNuevo.estado_garantia).toUpperCase() || null,
          productoNuevo.alerta_propiedad === true || productoNuevo.alerta_propiedad === "true"
        ]
      );
      productoId = productoResult.rows[0].id_producto;
    }

    let productoResult;
    if (productoId) {
      productoResult = await client.query(
        `SELECT id_producto, id_cliente, id_sucursal, id_modelo, id_tipo_maquina, numero_serie, marca, modelo
        FROM productos
        WHERE id_producto = $1
          AND id_sucursal = $2
        LIMIT 1`,
        [productoId, usuarioSucursal.id_sucursal]
      );
    } else if (numeroSerie) {
      productoResult = await client.query(
        `SELECT id_producto, id_cliente, id_sucursal, id_modelo, id_tipo_maquina, numero_serie, marca, modelo
        FROM productos
        WHERE UPPER(numero_serie) = UPPER($1)
          AND id_sucursal = $2
        LIMIT 1`,
        [numeroSerie, usuarioSucursal.id_sucursal]
      );
    } else {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Debe seleccionar una maquina existente o crear una maquina nueva" });
    }

    if (productoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Producto no encontrado para la sucursal" });
    }

    const producto = productoResult.rows[0];
    clienteId = clienteId || producto.id_cliente;

    if (!clienteId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El producto no tiene cliente asociado" });
    }

    if (!producto.id_tipo_maquina) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "La maquina no tiene tipo de maquina asociado" });
    }

    const tipoResult = await client.query(
      `SELECT id_tipo_maquina, nombre, valor_ingreso
      FROM tipos_maquina
      WHERE id_tipo_maquina = $1
        AND id_sucursal = $2
        AND estado = 'ACTIVO'
      LIMIT 1`,
      [producto.id_tipo_maquina, usuarioSucursal.id_sucursal]
    );

    if (tipoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No existe valor de ingreso configurado para el tipo de maquina en la sucursal" });
    }

    const tipoMaquina = tipoResult.rows[0];
    const valorIngreso = Number(tipoMaquina.valor_ingreso || 0);

    const insertResult = await client.query(
      `INSERT INTO ordenes_servicio (
        id_sucursal,
        id_cliente,
        id_producto,
        id_tipo_maquina,
        id_tecnico,
        id_responsable,
        id_creado_por,
        fecha_toma,
        id_modelo,
        costo_ingreso_taller,
        valor_ingreso,
        valor_revision,
        tipo_atencion,
        tipo_orden,
        descripcion_problema,
        accesorios_recibidos,
        observaciones_recepcion,
        estado
      )
      VALUES ($1, $2, $3, $4, NULL, NULL, $5, NULL, $6, $7, $8, $8, $9, $9, $10, $11, $12, 'INGRESADA')
      RETURNING id_orden`,
      [
        usuarioSucursal.id_sucursal,
        clienteId,
        producto.id_producto,
        tipoMaquina.id_tipo_maquina,
        req.usuario.id_usuario,
        producto.id_modelo,
        usuarioSucursal.costo_ingreso_taller || 0,
        valorIngreso,
        tipoAtencion,
        descripcionProblema,
        accesoriosRecibidos,
        observacionesRecepcion
      ]
    );

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden,
        estado_anterior,
        estado_nuevo,
        id_usuario,
        accion
      )
      VALUES ($1, NULL, 'INGRESADA', $2, 'CREAR_ORDEN')`,
      [insertResult.rows[0].id_orden, req.usuario.id_usuario]
    );

    await client.query("COMMIT");

    const orden = await getOrdenDetalle(insertResult.rows[0].id_orden);
    return res.status(201).json({ orden });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(400).json({ error: "El numero de serie ya existe" });
    }

    console.error("Error creando orden de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.post("/:id/tomar", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);

  if (!Number.isInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ error: "id de orden no es valido" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    if (usuarioSucursal.estado_sucursal !== "ACTIVA") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "La sucursal del usuario esta INACTIVA" });
    }

    const updateResult = await client.query(
      `UPDATE ordenes_servicio
      SET id_responsable = $1,
          id_tecnico = $1,
          fecha_toma = CURRENT_TIMESTAMP,
          estado = 'EN_REVISION',
          version = version + 1
      WHERE id_orden = $2
        AND id_sucursal = $3
        AND estado = 'INGRESADA'
        AND id_responsable IS NULL
      RETURNING id_orden`,
      [req.usuario.id_usuario, idOrden, usuarioSucursal.id_sucursal]
    );

    if (updateResult.rows.length === 0) {
      const existsResult = await client.query(
        `SELECT id_orden
        FROM ordenes_servicio
        WHERE id_orden = $1
          AND id_sucursal = $2
        LIMIT 1`,
        [idOrden, usuarioSucursal.id_sucursal]
      );

      await client.query("ROLLBACK");

      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      return res.status(409).json({ error: "La orden ya fue tomada o no esta disponible" });
    }

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden,
        estado_anterior,
        estado_nuevo,
        id_usuario,
        accion
      )
      VALUES ($1, 'INGRESADA', 'EN_REVISION', $2, 'TOMAR_ORDEN')`,
      [idOrden, req.usuario.id_usuario]
    );

    await client.query("COMMIT");

    const orden = await getOrdenDetalle(idOrden);
    return res.json({ orden });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error tomando orden de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.get("/:id/detalle", verificarRol("ADMIN", "RECEPCIONISTA", "TECNICO", "CLIENTE"), async (req, res) => {
  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario, true, true);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const detalle = await buildOrdenDetalle(access.orden);

    if (req.usuario.rol === "RECEPCIONISTA" && !detalle.borrador_tecnico_finalizado) {
      detalle.repuestos = [];
      detalle.cotizacion = null;
      detalle.cotizaciones = [];
    }

    return res.json({ detalle });
  } catch (error) {
    console.error("Error obteniendo detalle de orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/estado", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const estado = clean(req.body?.estado).toUpperCase();

  if (!estado) {
    return res.status(400).json({ error: "estado es obligatorio" });
  }

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await db.query(
      `UPDATE ordenes_servicio
      SET estado = $1
      WHERE id_orden = $2
        AND id_sucursal = $3
      RETURNING id_orden`,
      [estado, access.orden.id_orden, access.orden.id_sucursal]
    );

    const orden = await getOrdenDetalle(result.rows[0].id_orden);
    return res.json({ orden });
  } catch (error) {
    console.error("Error actualizando estado de orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/diagnostico", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const camposPermitidos = new Set(["diagnostico", "informe_tecnico", "observaciones_tecnicas", "mano_obra"]);
  const camposInvalidos = Object.keys(req.body || {}).filter((campo) => !camposPermitidos.has(campo));
  const diagnostico = clean(req.body?.diagnostico);
  const informeTecnico = clean(req.body?.informe_tecnico || req.body?.observaciones_tecnicas);
  const manoObra = parseMoney(req.body?.mano_obra, 0);

  if (!Number.isInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ error: "id de orden no es valido" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite modificar diagnostico, informe_tecnico, observaciones_tecnicas y mano_obra" });
  }

  if (!diagnostico) {
    return res.status(400).json({ error: "diagnostico es obligatorio" });
  }

  if (manoObra === null) {
    return res.status(400).json({ error: "mano_obra debe ser numero mayor o igual a 0" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    const ordenResult = await client.query(
      `SELECT id_orden, estado, id_responsable
      FROM ordenes_servicio
      WHERE id_orden = $1
        AND id_sucursal = $2
      FOR UPDATE`,
      [idOrden, usuarioSucursal.id_sucursal]
    );

    if (ordenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const ordenActual = ordenResult.rows[0];

    if (ordenActual.estado !== "EN_REVISION") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La orden debe estar EN_REVISION para registrar diagnostico" });
    }

    if (
      req.usuario.rol === "TECNICO" &&
      Number(ordenActual.id_responsable) !== Number(req.usuario.id_usuario)
    ) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada para el tecnico" });
    }

    const borradorFinalizadoResult = await client.query(
      `SELECT EXISTS (
        SELECT 1
        FROM historial_estados_orden
        WHERE id_orden = $1
          AND accion = 'FINALIZAR_BORRADOR_TECNICO'
      ) AS finalizado`,
      [idOrden]
    );

    if (borradorFinalizadoResult.rows[0]?.finalizado) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El borrador tecnico ya fue finalizado" });
    }
    await client.query(
      `UPDATE ordenes_servicio
      SET diagnostico = $1,
          informe_tecnico = $2,
          mano_obra = $3,
          version = version + 1
      WHERE id_orden = $4
        AND id_sucursal = $5`,
      [diagnostico, informeTecnico, manoObra, idOrden, usuarioSucursal.id_sucursal]
    );

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden,
        estado_anterior,
        estado_nuevo,
        id_usuario,
        accion,
        observacion
      )
      VALUES ($1, 'EN_REVISION', 'EN_REVISION', $2, 'REGISTRAR_DIAGNOSTICO', $3)`,
      [idOrden, req.usuario.id_usuario, informeTecnico || null]
    );

    await client.query("COMMIT");
    const orden = await getOrdenDetalle(idOrden);
    return res.json({ orden });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error registrando diagnostico tecnico:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.put("/:id/decision-garantia", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const camposPermitidos = new Set(["decision", "observacion"]);
  const camposInvalidos = Object.keys(req.body || {}).filter((campo) => !camposPermitidos.has(campo));
  const decision = clean(req.body?.decision).toUpperCase();
  const observacion = clean(req.body?.observacion);

  if (!Number.isInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ error: "id de orden no es valido" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite enviar decision y observacion" });
  }

  if (!["APROBADA", "RECHAZADA"].includes(decision)) {
    return res.status(400).json({ error: "decision debe ser APROBADA o RECHAZADA" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    const ordenResult = await client.query(
      `SELECT
        id_orden,
        id_producto,
        id_sucursal,
        id_responsable,
        tipo_orden,
        tipo_atencion,
        diagnostico,
        garantia_aprobada_por_admin,
        estado
      FROM ordenes_servicio
      WHERE id_orden = $1
        AND id_sucursal = $2
      FOR UPDATE`,
      [idOrden, usuarioSucursal.id_sucursal]
    );

    if (ordenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const ordenActual = ordenResult.rows[0];

    if (
      req.usuario.rol === "TECNICO" &&
      Number(ordenActual.id_responsable) !== Number(req.usuario.id_usuario)
    ) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada para el tecnico" });
    }

    if (ordenActual.estado !== "EN_REVISION") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La orden debe estar EN_REVISION para decidir garantia" });
    }

    const tipoOrden = normalizeTipoAtencion(ordenActual.tipo_orden || ordenActual.tipo_atencion);

    if (tipoOrden !== "REVISION_GARANTIA") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "La decision de garantia solo aplica a REVISION_GARANTIA" });
    }

    if (!clean(ordenActual.diagnostico)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Debe registrar el diagnostico antes de decidir la garantia" });
    }

    const garantiasResult = await client.query(
      `SELECT id_garantia, estado
      FROM garantias
      WHERE id_orden = $1
      ORDER BY fecha_solicitud DESC, id_garantia DESC
      FOR UPDATE`,
      [idOrden]
    );

    const decisionPrevia = garantiasResult.rows.some((garantia) =>
      ["APROBADA", "RECHAZADA"].includes(garantia.estado)
    );

    if (ordenActual.garantia_aprobada_por_admin !== null || decisionPrevia) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La garantia ya tiene una decision final" });
    }

    const garantiaAprobada = decision === "APROBADA";
    const estadoResultante = garantiaAprobada ? "EN_REPARACION" : "EN_REVISION";
    const accion = garantiaAprobada ? "GARANTIA_APROBADA" : "GARANTIA_RECHAZADA";

    await client.query(
      `UPDATE ordenes_servicio
      SET garantia_aprobada_por_admin = $1,
          observacion_admin = $2,
          estado = $3,
          version = version + 1
      WHERE id_orden = $4
        AND id_sucursal = $5`,
      [garantiaAprobada, observacion || null, estadoResultante, idOrden, usuarioSucursal.id_sucursal]
    );

    let idGarantia;

    if (garantiasResult.rows.length > 0) {
      const garantiaUpdate = await client.query(
        `UPDATE garantias
        SET estado = $1,
            id_tecnico = $2,
            observacion_admin = $3,
            fecha_revision = CURRENT_TIMESTAMP
        WHERE id_orden = $4
          AND estado NOT IN ('APROBADA', 'RECHAZADA')
        RETURNING id_garantia`,
        [decision, req.usuario.id_usuario, observacion || null, idOrden]
      );
      idGarantia = garantiaUpdate.rows[0]?.id_garantia;
    } else {
      const garantiaInsert = await client.query(
        `INSERT INTO garantias (
          id_orden,
          id_producto,
          id_sucursal,
          id_tecnico,
          estado,
          observacion_admin,
          fecha_revision
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING id_garantia`,
        [
          idOrden,
          ordenActual.id_producto,
          ordenActual.id_sucursal,
          req.usuario.id_usuario,
          decision,
          observacion || null
        ]
      );
      idGarantia = garantiaInsert.rows[0].id_garantia;
    }

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden,
        estado_anterior,
        estado_nuevo,
        id_usuario,
        accion,
        observacion
      )
      VALUES ($1, 'EN_REVISION', $2, $3, $4, $5)`,
      [idOrden, estadoResultante, req.usuario.id_usuario, accion, observacion || null]
    );

    await client.query("COMMIT");
    const [orden, garantia] = await Promise.all([
      getOrdenDetalle(idOrden),
      getGarantiaDetalle(idGarantia)
    ]);
    return res.json({ orden, garantia });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error registrando decision final de garantia:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});
async function getOrdenTrabajoEditable(client, idOrden, usuario) {
  const usuarioSucursal = await getUsuarioSucursal(usuario.id_usuario, client);

  if (!usuarioSucursal?.id_sucursal) {
    return { status: 400, error: "Usuario no tiene sucursal asignada" };
  }

  const ordenResult = await client.query(
    `SELECT
      id_orden,
      id_sucursal,
      id_responsable,
      estado,
      tipo_orden,
      tipo_atencion,
      diagnostico,
      mano_obra,
      valor_ingreso,
      garantia_aprobada_por_admin,
      version
    FROM ordenes_servicio
    WHERE id_orden = $1
      AND id_sucursal = $2
    FOR UPDATE`,
    [idOrden, usuarioSucursal.id_sucursal]
  );

  if (ordenResult.rows.length === 0) {
    return { status: 404, error: "Orden no encontrada" };
  }

  const orden = ordenResult.rows[0];

  if (!["EN_REVISION", "EN_REPARACION"].includes(orden.estado)) {
    return { status: 409, error: "La orden debe estar EN_REVISION o EN_REPARACION" };
  }

  if (usuario.rol === "TECNICO" && Number(orden.id_responsable) !== Number(usuario.id_usuario)) {
    return { status: 404, error: "Orden no encontrada para el tecnico" };
  }

  const cotizacionResult = await client.query(
    `SELECT id_cotizacion, estado, version, cerrada, pdf_estado
    FROM cotizaciones
    WHERE id_orden = $1
    ORDER BY version DESC
    LIMIT 1
    FOR UPDATE`,
    [idOrden]
  );
  const cotizacion = cotizacionResult.rows[0] || null;

  const cicloResult = await client.query(
    `SELECT accion
    FROM historial_estados_orden
    WHERE id_orden = $1
      AND accion IN ('FINALIZAR_BORRADOR_TECNICO', 'REABRIR_COTIZACION')
    ORDER BY fecha_creacion DESC, id_historial DESC
    LIMIT 1`,
    [idOrden]
  );
  const ultimaAccionCiclo = cicloResult.rows[0]?.accion || null;
  const cicloReabierto = ultimaAccionCiclo === "REABRIR_COTIZACION";

  if (
    cotizacion &&
    !cicloReabierto &&
    (cotizacion.estado !== "BORRADOR" || cotizacion.cerrada || cotizacion.pdf_estado !== "NO_GENERADO")
  ) {
    return { status: 409, error: "La cotizacion ya no permite modificar el trabajo tecnico" };
  }

  if (ultimaAccionCiclo === "FINALIZAR_BORRADOR_TECNICO") {
    return { status: 409, error: "El borrador tecnico ya fue finalizado" };
  }

  return { orden, cotizacion, usuarioSucursal, cicloReabierto };
}

router.get("/:id/repuestos", verificarRol("ADMIN", "RECEPCIONISTA", "TECNICO"), async (req, res) => {
  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    if (req.usuario.rol === "RECEPCIONISTA" && !(await getBorradorTecnicoFinalizado(access.orden.id_orden))) {
      return res.status(409).json({ error: "El borrador tecnico aun no esta finalizado" });
    }

    const repuestos = await getRepuestos(access.orden.id_orden);
    return res.json({ repuestos });
  } catch (error) {
    console.error("Error listando repuestos de orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/:id/repuestos", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const idRepuesto = Number(req.body?.id_repuesto);
  const cantidad = parsePositiveInteger(req.body?.cantidad, null);
  const observacion = clean(req.body?.observacion) || null;
  const camposPermitidos = new Set(["id_repuesto", "cantidad", "observacion"]);
  const camposInvalidos = Object.keys(req.body || {}).filter((campo) => !camposPermitidos.has(campo));

  if (!Number.isInteger(idOrden) || idOrden <= 0 || !Number.isInteger(idRepuesto) || idRepuesto <= 0) {
    return res.status(400).json({ error: "id de orden e id_repuesto deben ser validos" });
  }

  if (cantidad === null) {
    return res.status(400).json({ error: "cantidad debe ser un numero entero mayor o igual a 1" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite enviar id_repuesto, cantidad y observacion" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const access = await getOrdenTrabajoEditable(client, idOrden, req.usuario);

    if (access.error) {
      await client.query("ROLLBACK");
      return res.status(access.status).json({ error: access.error });
    }

    const repuestoResult = await client.query(
      `SELECT id_repuesto, nombre, precio, stock
      FROM repuestos
      WHERE id_repuesto = $1
        AND id_sucursal = $2
        AND estado = 'ACTIVO'
      FOR UPDATE`,
      [idRepuesto, access.orden.id_sucursal]
    );

    if (repuestoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Repuesto activo no encontrado para la sucursal" });
    }

    const duplicadoResult = await client.query(
      `SELECT id_detalle
      FROM repuestos_usados
      WHERE id_orden = $1
        AND id_repuesto = $2
      LIMIT 1`,
      [idOrden, idRepuesto]
    );

    if (duplicadoResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El repuesto ya esta agregado; modifica su cantidad" });
    }

    const repuesto = repuestoResult.rows[0];
    const stockDisponible = Number(repuesto.stock || 0);

    if (cantidad > stockDisponible) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Stock insuficiente para la cantidad solicitada", stock_disponible: stockDisponible });
    }

    const precioUnitario = Number(repuesto.precio || 0);
    const subtotal = cantidad * precioUnitario;
    const tipoOrden = normalizeTipoAtencion(access.orden.tipo_orden || access.orden.tipo_atencion);
    const cubiertoGarantia = tipoOrden === "REVISION_GARANTIA" && access.orden.garantia_aprobada_por_admin === true;
    const insertResult = await client.query(
      `INSERT INTO repuestos_usados (
        id_orden,
        id_repuesto,
        nombre_repuesto,
        cantidad,
        precio_unitario,
        subtotal,
        cubierto_garantia,
        observacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_detalle, id_detalle AS id_repuesto_usado, id_orden, id_repuesto, nombre_repuesto, cantidad, precio_unitario, subtotal, cubierto_garantia, observacion, fecha_registro`,
      [idOrden, idRepuesto, repuesto.nombre, cantidad, precioUnitario, subtotal, cubiertoGarantia, observacion]
    );

    await client.query("COMMIT");
    return res.status(201).json({ repuesto: { ...insertResult.rows[0], stock_disponible: stockDisponible } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error agregando repuesto a orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.put("/:id/repuestos/:idDetalle", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const idDetalle = Number(req.params.idDetalle);
  const cantidad = parsePositiveInteger(req.body?.cantidad, null);
  const observacion = req.body?.observacion === undefined ? null : clean(req.body.observacion);
  const camposPermitidos = new Set(["cantidad", "observacion"]);
  const camposInvalidos = Object.keys(req.body || {}).filter((campo) => !camposPermitidos.has(campo));

  if (!Number.isInteger(idOrden) || idOrden <= 0 || !Number.isInteger(idDetalle) || idDetalle <= 0) {
    return res.status(400).json({ error: "Los identificadores deben ser validos" });
  }

  if (cantidad === null) {
    return res.status(400).json({ error: "cantidad debe ser un numero entero mayor o igual a 1" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite modificar cantidad y observacion" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const access = await getOrdenTrabajoEditable(client, idOrden, req.usuario);

    if (access.error) {
      await client.query("ROLLBACK");
      return res.status(access.status).json({ error: access.error });
    }

    const detalleResult = await client.query(
      `SELECT ru.id_detalle, ru.id_repuesto, ru.precio_unitario, ru.observacion, r.nombre, r.stock
      FROM repuestos_usados ru
      INNER JOIN repuestos r ON r.id_repuesto = ru.id_repuesto
      WHERE ru.id_detalle = $1
        AND ru.id_orden = $2
        AND r.id_sucursal = $3
        AND r.estado = 'ACTIVO'
      FOR UPDATE OF ru, r`,
      [idDetalle, idOrden, access.orden.id_sucursal]
    );

    if (detalleResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Detalle de repuesto de catalogo no encontrado" });
    }

    const detalle = detalleResult.rows[0];
    const otrasCantidadesResult = await client.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS cantidad
      FROM repuestos_usados
      WHERE id_orden = $1
        AND id_repuesto = $2
        AND id_detalle <> $3`,
      [idOrden, detalle.id_repuesto, idDetalle]
    );
    const cantidadTotal = cantidad + Number(otrasCantidadesResult.rows[0]?.cantidad || 0);
    const stockDisponible = Number(detalle.stock || 0);

    if (cantidadTotal > stockDisponible) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Stock insuficiente para la cantidad solicitada", stock_disponible: stockDisponible });
    }

    const precioUnitario = Number(detalle.precio_unitario || 0);
    const subtotal = cantidad * precioUnitario;
    const updateResult = await client.query(
      `UPDATE repuestos_usados
      SET cantidad = $1,
          subtotal = $2,
          observacion = COALESCE($3, observacion)
      WHERE id_detalle = $4
        AND id_orden = $5
      RETURNING id_detalle, id_detalle AS id_repuesto_usado, id_orden, id_repuesto, nombre_repuesto, cantidad, precio_unitario, subtotal, cubierto_garantia, observacion, fecha_registro`,
      [cantidad, subtotal, observacion, idDetalle, idOrden]
    );

    await client.query("COMMIT");
    return res.json({ repuesto: { ...updateResult.rows[0], stock_disponible: stockDisponible } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error actualizando repuesto usado:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.delete("/:id/repuestos/:idDetalle", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const idDetalle = Number(req.params.idDetalle);

  if (!Number.isInteger(idOrden) || idOrden <= 0 || !Number.isInteger(idDetalle) || idDetalle <= 0) {
    return res.status(400).json({ error: "Los identificadores deben ser validos" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const access = await getOrdenTrabajoEditable(client, idOrden, req.usuario);

    if (access.error) {
      await client.query("ROLLBACK");
      return res.status(access.status).json({ error: access.error });
    }

    const deleteResult = await client.query(
      `DELETE FROM repuestos_usados
      WHERE id_detalle = $1
        AND id_orden = $2
        AND id_repuesto IS NOT NULL
      RETURNING id_detalle`,
      [idDetalle, idOrden]
    );

    if (deleteResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Detalle de repuesto de catalogo no encontrado" });
    }

    await client.query("COMMIT");
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error retirando repuesto usado:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.put("/:id/mano-obra", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const manoObra = parseMoney(req.body?.mano_obra, null);
  const camposInvalidos = Object.keys(req.body || {}).filter((campo) => campo !== "mano_obra");

  if (!Number.isInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ error: "id de orden no es valido" });
  }

  if (manoObra === null) {
    return res.status(400).json({ error: "mano_obra debe ser un numero mayor o igual a 0" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite modificar mano_obra" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const access = await getOrdenTrabajoEditable(client, idOrden, req.usuario);

    if (access.error) {
      await client.query("ROLLBACK");
      return res.status(access.status).json({ error: access.error });
    }

    const updateResult = await client.query(
      `UPDATE ordenes_servicio
      SET mano_obra = $1,
          version = version + 1
      WHERE id_orden = $2
      RETURNING id_orden, mano_obra, version`,
      [manoObra, idOrden]
    );

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden,
        estado_anterior,
        estado_nuevo,
        id_usuario,
        accion,
        observacion
      )
      VALUES ($1, $2, $2, $3, 'ACTUALIZAR_MANO_OBRA', $4)`,
      [idOrden, access.orden.estado, req.usuario.id_usuario, `Mano de obra estimada: ${manoObra}`]
    );

    await client.query("COMMIT");
    return res.json({ orden: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error actualizando mano de obra:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.get("/:id/cotizacion", verificarRol("ADMIN", "RECEPCIONISTA", "TECNICO", "CLIENTE"), async (req, res) => {
  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario, false, true);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    if (
      req.usuario.rol === "TECNICO" &&
      Number(access.orden.id_responsable) !== Number(req.usuario.id_usuario)
    ) {
      return res.status(404).json({ error: "Orden no encontrada para el tecnico" });
    }

    const [cotizacion, versiones, borradorFinalizado] = await Promise.all([
      getCotizacion(access.orden.id_orden),
      getCotizacionesResumen(access.orden.id_orden),
      getBorradorTecnicoFinalizado(access.orden.id_orden)
    ]);

    if (req.usuario.rol === "RECEPCIONISTA" && !borradorFinalizado && !cotizacion?.cerrada) {
      return res.status(409).json({ error: "El borrador tecnico aun no esta finalizado" });
    }

    return res.json({ cotizacion, versiones });
  } catch (error) {
    console.error("Error obteniendo cotizacion:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/cotizaciones/:version/descuento", verificarRol("ADMIN"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const version = Number(req.params.version);
  const camposPermitidos = new Set(["tipo_descuento", "valor_descuento", "motivo_descuento"]);
  const camposInvalidos = Object.keys(req.body || {}).filter((campo) => !camposPermitidos.has(campo));
  const tipoDescuento = req.body?.tipo_descuento === null || clean(req.body?.tipo_descuento) === ""
    ? null
    : clean(req.body.tipo_descuento).toUpperCase();
  const valorDescuento = parseNonNegativeDecimal(req.body?.valor_descuento);
  const motivoDescuento = tipoDescuento ? clean(req.body?.motivo_descuento) : null;

  if (!Number.isInteger(idOrden) || idOrden <= 0 || !Number.isInteger(version) || version <= 0) {
    return res.status(400).json({ error: "id de orden y version deben ser validos" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite modificar tipo_descuento, valor_descuento y motivo_descuento" });
  }

  if (![null, "PORCENTAJE", "MONTO_FIJO"].includes(tipoDescuento)) {
    return res.status(400).json({ error: "tipo_descuento no es valido" });
  }

  if (valorDescuento === null) {
    return res.status(400).json({ error: "valor_descuento debe ser un numero mayor o igual a 0" });
  }

  if (tipoDescuento === null && valorDescuento !== 0) {
    return res.status(400).json({ error: "Sin descuento, valor_descuento debe ser 0" });
  }

  if (tipoDescuento === "PORCENTAJE" && valorDescuento > 100) {
    return res.status(400).json({ error: "El porcentaje debe estar entre 0 y 100" });
  }

  if (tipoDescuento && !motivoDescuento) {
    return res.status(400).json({ error: "motivo_descuento es obligatorio al aplicar un descuento" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    const ordenResult = await client.query(
      `SELECT id_orden, estado
      FROM ordenes_servicio
      WHERE id_orden = $1
        AND id_sucursal = $2
      FOR UPDATE`,
      [idOrden, usuarioSucursal.id_sucursal]
    );

    if (ordenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const cotizacionResult = await client.query(
      `SELECT id_cotizacion, subtotal_original, estado, cerrada, pdf_estado,
        (SELECT MAX(version) FROM cotizaciones WHERE id_orden = $1) AS ultima_version
      FROM cotizaciones
      WHERE id_orden = $1
        AND version = $2
      FOR UPDATE`,
      [idOrden, version]
    );

    if (cotizacionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cotizacion no encontrada para la version indicada" });
    }

    const cotizacionActual = cotizacionResult.rows[0];

    if (Number(cotizacionActual.ultima_version) !== version) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Solo se puede modificar la version mas reciente" });
    }

    if (cotizacionActual.estado !== "BORRADOR" || cotizacionActual.cerrada) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La version de cotizacion no permite descuentos" });
    }

    if (cotizacionActual.pdf_estado !== "NO_GENERADO") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "No se puede descontar una cotizacion con PDF generado o en proceso" });
    }

    const subtotalOriginal = Number(cotizacionActual.subtotal_original || 0);
    const montoDescuento = tipoDescuento === "PORCENTAJE"
      ? Math.round((subtotalOriginal * valorDescuento / 100 + Number.EPSILON) * 100) / 100
      : valorDescuento;

    if (montoDescuento > subtotalOriginal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El descuento no puede superar el subtotal original" });
    }

    const totalFinal = Math.round((subtotalOriginal - montoDescuento + Number.EPSILON) * 100) / 100;
    const updateResult = await client.query(
      `UPDATE cotizaciones
      SET tipo_descuento = $1,
          valor_descuento = $2,
          motivo_descuento = $3,
          id_descuento_aplicado_por = $4,
          fecha_descuento = CURRENT_TIMESTAMP,
          total_final = $5,
          total = $6,
          fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_cotizacion = $7
      RETURNING
        id_cotizacion, id_orden, version, total_repuestos, valor_ingreso,
        mano_obra, total_general, total, estado, observacion,
        subtotal_original, tipo_descuento, valor_descuento, motivo_descuento,
        id_descuento_aplicado_por, fecha_descuento, total_final, cerrada,
        fecha_cierre, id_cerrada_por, pdf_estado, pdf_nombre_archivo,
        pdf_blob_name, pdf_url, pdf_hash, pdf_mime_type, pdf_size_bytes,
        fecha_pdf, fecha_creacion, fecha_actualizacion, fecha_respuesta`,
      [tipoDescuento, valorDescuento, motivoDescuento, req.usuario.id_usuario, totalFinal, Math.round(totalFinal), cotizacionActual.id_cotizacion]
    );

    await client.query(
      `UPDATE ordenes_servicio
      SET version = version + 1
      WHERE id_orden = $1`,
      [idOrden]
    );

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden, estado_anterior, estado_nuevo, id_usuario, accion, observacion
      )
      VALUES ($1, $2, $2, $3, 'APLICAR_DESCUENTO_COTIZACION', $4)`,
      [
        idOrden,
        ordenResult.rows[0].estado,
        req.usuario.id_usuario,
        `Version ${version}; tipo ${tipoDescuento || "SIN_DESCUENTO"}; valor ${valorDescuento}; total final ${totalFinal}`
      ]
    );

    await client.query("COMMIT");
    return res.json({ cotizacion: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error aplicando descuento a cotizacion:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.post("/:id/cotizaciones/:version/generar-pdf", verificarRol("ADMIN"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const version = Number(req.params.version);

  if (!Number.isInteger(idOrden) || idOrden <= 0 || !Number.isInteger(version) || version <= 0) {
    return res.status(400).json({ error: "id de orden y version deben ser validos" });
  }

  if (Object.keys(req.body || {}).length > 0) {
    return res.status(400).json({ error: "Esta accion no acepta campos en el body" });
  }

  const client = await db.pool.connect();
  let uploadedBlobName = null;

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    const documentData = await getQuotationDocumentData(
      client,
      idOrden,
      version,
      usuarioSucursal.id_sucursal,
      true
    );

    if (!documentData) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    if (!documentData.cotizacion) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cotizacion no encontrada para la version indicada" });
    }

    const { orden, cotizacion, repuestos } = documentData;

    if (Number(cotizacion.ultima_version) !== version) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Solo se puede generar el PDF de la version mas reciente" });
    }

    if (cotizacion.estado !== "BORRADOR" || cotizacion.cerrada) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La cotizacion no esta disponible para generar PDF" });
    }

    if (cotizacion.pdf_estado !== "NO_GENERADO") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El PDF de esta version ya fue generado o esta en proceso" });
    }

    const tipoOrden = normalizeTipoAtencion(orden.tipo_orden || orden.tipo_atencion);
    const garantiaRechazada = tipoOrden === "REVISION_GARANTIA" && orden.garantia_aprobada_por_admin === false;

    if (tipoOrden !== "REPARACION" && !garantiaRechazada) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Este tipo de orden no utiliza una cotizacion normal" });
    }

    const generatedAt = new Date();
    const pdfBuffer = await generateQuotationPdf({
      fecha_generacion: generatedAt,
      orden: {
        id_orden: orden.id_orden,
        descripcion_problema: orden.descripcion_problema,
        diagnostico: orden.diagnostico,
        observaciones_recepcion: orden.observaciones_recepcion
      },
      cliente: {
        nombre: orden.cliente_nombre,
        rut: orden.cliente_rut,
        telefono: orden.cliente_telefono,
        email: orden.cliente_email,
        direccion: orden.cliente_direccion
      },
      maquina: {
        tipo: orden.tipo_maquina,
        marca: orden.marca,
        modelo: orden.modelo,
        numero_serie: orden.numero_serie
      },
      cotizacion,
      repuestos,
      responsable: orden.responsable_nombre
    });
    const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const pdfFileName = `cotizacion-v${version}.pdf`;
    const blobName = `cotizaciones/orden-${idOrden}/${pdfFileName}`;
    const uploaded = await uploadPrivateBuffer(blobName, pdfBuffer, "application/pdf", {
      ordenId: String(idOrden),
      version: String(version),
      sha256: pdfHash
    });
    uploadedBlobName = uploaded.blobName;

    const updateResult = await client.query(
      `UPDATE cotizaciones
      SET pdf_estado = 'GENERADO',
          pdf_nombre_archivo = $1,
          pdf_blob_name = $2,
          pdf_url = $3,
          pdf_hash = $4,
          pdf_mime_type = 'application/pdf',
          pdf_size_bytes = $5,
          fecha_pdf = $6,
          cerrada = TRUE,
          fecha_cierre = $6,
          id_cerrada_por = $7,
          fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_orden = $8
        AND version = $9
        AND estado = 'BORRADOR'
        AND cerrada = FALSE
        AND pdf_estado = 'NO_GENERADO'
      RETURNING id_cotizacion, id_orden, version, estado, subtotal_original,
        valor_descuento, total_final, cerrada, fecha_cierre, id_cerrada_por,
        pdf_estado, pdf_nombre_archivo, pdf_blob_name, pdf_url, pdf_hash,
        pdf_mime_type, pdf_size_bytes, fecha_pdf`,
      [pdfFileName, uploaded.blobName, uploaded.url, pdfHash, pdfBuffer.length, generatedAt, req.usuario.id_usuario, idOrden, version]
    );

    if (updateResult.rows.length === 0) {
      throw Object.assign(new Error("La cotizacion cambio mientras se generaba el PDF"), { status: 409 });
    }

    const orderUpdateResult = await client.query(
      `UPDATE ordenes_servicio
      SET estado = 'ESPERANDO_APROBACION',
          version = version + 1
      WHERE id_orden = $1
        AND estado = $2
      RETURNING id_orden`,
      [idOrden, orden.estado]
    );

    if (orderUpdateResult.rows.length === 0) {
      throw Object.assign(new Error("La orden cambio mientras se generaba el PDF"), { status: 409 });
    }

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden, estado_anterior, estado_nuevo, id_usuario, accion, observacion
      )
      VALUES ($1, $2, 'ESPERANDO_APROBACION', $3, 'GENERAR_PDF_COTIZACION', $4)`,
      [idOrden, orden.estado, req.usuario.id_usuario, `Version ${version}; blob ${uploaded.blobName}; sha256 ${pdfHash}`]
    );

    await client.query("COMMIT");
    return res.json({ cotizacion: updateResult.rows[0] });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error revirtiendo generacion de PDF:", rollbackError.message);
    }

    if (uploadedBlobName) {
      try {
        await deletePrivateBlob(uploadedBlobName);
      } catch (compensationError) {
        console.error("No se pudo eliminar el blob tras rollback:", compensationError.message);
      }
    }

    if (error.code === "AZURE_STORAGE_NOT_CONFIGURED") {
      return res.status(503).json({ error: "Azure Blob Storage no esta configurado; la cotizacion permanece abierta" });
    }

    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }

    console.error("Error generando PDF de cotizacion:", error.message);
    return res.status(500).json({ error: "No se pudo generar y almacenar el PDF de cotizacion" });
  } finally {
    client.release();
  }
});

router.post("/:id/cotizaciones/:version/respuesta", verificarRol("ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const version = Number(req.params.version);
  const camposPermitidos = new Set(["respuesta", "observacion"]);
  const camposInvalidos = Object.keys(req.body || {}).filter((campo) => !camposPermitidos.has(campo));
  const respuesta = clean(req.body?.respuesta).toUpperCase();
  const observacion = clean(req.body?.observacion) || null;
  const transiciones = {
    APROBADA: {
      estado: "EN_REPARACION",
      accion: "RESPUESTA_COTIZACION_APROBADA"
    },
    SOLICITA_NUEVA_COTIZACION: {
      estado: "REQUIERE_NUEVA_COTIZACION",
      accion: "SOLICITAR_NUEVA_COTIZACION"
    },
    RECHAZADA: {
      estado: "RETIRO_SIN_REPARAR",
      accion: "RESPUESTA_COTIZACION_RECHAZADA"
    }
  };

  if (!Number.isInteger(idOrden) || idOrden <= 0 || !Number.isInteger(version) || version <= 0) {
    return res.status(400).json({ error: "id de orden y version deben ser validos" });
  }

  if (camposInvalidos.length > 0) {
    return res.status(400).json({ error: "Solo se permite registrar respuesta y observacion" });
  }

  if (!Object.hasOwn(transiciones, respuesta)) {
    return res.status(400).json({ error: "respuesta no es valida" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    const ordenResult = await client.query(
      `SELECT id_orden, estado
      FROM ordenes_servicio
      WHERE id_orden = $1
        AND id_sucursal = $2
      FOR UPDATE`,
      [idOrden, usuarioSucursal.id_sucursal]
    );

    if (ordenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const orden = ordenResult.rows[0];

    if (orden.estado !== "ESPERANDO_APROBACION") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La orden debe estar ESPERANDO_APROBACION para registrar una respuesta" });
    }

    const cotizacionResult = await client.query(
      `SELECT
        c.id_cotizacion,
        c.id_orden,
        c.version,
        c.cerrada,
        c.pdf_estado,
        (SELECT MAX(version) FROM cotizaciones WHERE id_orden = $1) AS ultima_version
      FROM cotizaciones c
      WHERE c.id_orden = $1
        AND c.version = $2
      FOR UPDATE`,
      [idOrden, version]
    );

    if (cotizacionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cotizacion no encontrada para la version indicada" });
    }

    const cotizacion = cotizacionResult.rows[0];

    if (Number(cotizacion.ultima_version) !== version) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Solo se puede responder la version mas reciente" });
    }

    if (!cotizacion.cerrada) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La cotizacion debe estar cerrada antes de registrar una respuesta" });
    }

    if (cotizacion.pdf_estado !== "GENERADO") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La cotizacion debe tener un PDF generado" });
    }

    const respuestaExistente = await client.query(
      `SELECT id_respuesta
      FROM respuestas_cotizacion
      WHERE id_cotizacion = $1
      FOR UPDATE`,
      [cotizacion.id_cotizacion]
    );

    if (respuestaExistente.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Esta version de cotizacion ya tiene una respuesta registrada" });
    }

    const respuestaResult = await client.query(
      `INSERT INTO respuestas_cotizacion (
        id_cotizacion,
        id_orden,
        version_cotizacion,
        respuesta,
        observacion,
        id_registrada_por
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_respuesta, id_cotizacion, id_orden, version_cotizacion,
        respuesta, observacion, id_registrada_por, fecha_respuesta`,
      [
        cotizacion.id_cotizacion,
        cotizacion.id_orden,
        cotizacion.version,
        respuesta,
        observacion,
        req.usuario.id_usuario
      ]
    );

    const transicion = transiciones[respuesta];
    const ordenUpdateResult = await client.query(
      `UPDATE ordenes_servicio
      SET estado = $1,
          version = version + 1
      WHERE id_orden = $2
        AND estado = 'ESPERANDO_APROBACION'
      RETURNING id_orden, estado, version`,
      [transicion.estado, idOrden]
    );

    if (ordenUpdateResult.rows.length === 0) {
      throw Object.assign(new Error("La orden cambio mientras se registraba la respuesta"), { status: 409 });
    }

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden, estado_anterior, estado_nuevo, id_usuario, accion, observacion
      )
      VALUES ($1, 'ESPERANDO_APROBACION', $2, $3, $4, $5)`,
      [
        idOrden,
        transicion.estado,
        req.usuario.id_usuario,
        transicion.accion,
        observacion || `Respuesta ${respuesta} para cotizacion version ${version}`
      ]
    );

    const respuestaRegistrada = await client.query(
      `SELECT
        rc.id_respuesta,
        rc.id_cotizacion,
        rc.id_orden,
        rc.version_cotizacion,
        rc.respuesta,
        rc.observacion,
        rc.id_registrada_por,
        rc.fecha_respuesta,
        u.nombre AS registrada_por_nombre
      FROM respuestas_cotizacion rc
      INNER JOIN usuarios u ON u.id_usuario = rc.id_registrada_por
      WHERE rc.id_respuesta = $1`,
      [respuestaResult.rows[0].id_respuesta]
    );

    await client.query("COMMIT");
    return res.json({
      respuesta: respuestaRegistrada.rows[0],
      orden: ordenUpdateResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({ error: "Esta version de cotizacion ya tiene una respuesta registrada" });
    }

    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }

    console.error("Error registrando respuesta de cotizacion:", error.message);
    return res.status(500).json({ error: "No se pudo registrar la respuesta de la cotizacion" });
  } finally {
    client.release();
  }
});
router.get("/:id/cotizaciones/:version/pdf", verificarRol("ADMIN", "RECEPCIONISTA", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);
  const version = Number(req.params.version);

  if (!Number.isInteger(idOrden) || idOrden <= 0 || !Number.isInteger(version) || version <= 0) {
    return res.status(400).json({ error: "id de orden y version deben ser validos" });
  }

  try {
    const access = await getOrdenParaUsuario(idOrden, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    if (
      req.usuario.rol === "TECNICO" &&
      Number(access.orden.id_responsable) !== Number(req.usuario.id_usuario)
    ) {
      return res.status(404).json({ error: "Orden no encontrada para el tecnico" });
    }

    const result = await db.query(
      `SELECT cerrada, pdf_estado, pdf_nombre_archivo, pdf_blob_name, pdf_mime_type
      FROM cotizaciones
      WHERE id_orden = $1
        AND version = $2`,
      [idOrden, version]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cotizacion no encontrada para la version indicada" });
    }

    const cotizacion = result.rows[0];

    if (!cotizacion.cerrada || cotizacion.pdf_estado !== "GENERADO" || !cotizacion.pdf_blob_name) {
      return res.status(409).json({ error: "El PDF de esta cotizacion aun no esta disponible" });
    }

    const pdfBuffer = await downloadPrivateBuffer(cotizacion.pdf_blob_name);
    const disposition = clean(req.query?.inline).toLowerCase() === "true" ? "inline" : "attachment";
    const fileName = (cotizacion.pdf_nombre_archivo || `cotizacion-v${version}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "-");
    res.set({
      "Content-Type": cotizacion.pdf_mime_type || "application/pdf",
      "Content-Length": String(pdfBuffer.length),
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "private, no-store"
    });
    return res.send(pdfBuffer);
  } catch (error) {
    if (error.code === "AZURE_STORAGE_NOT_CONFIGURED") {
      return res.status(503).json({ error: "Azure Blob Storage no esta configurado" });
    }

    if (error.statusCode === 404 || error.code === "BlobNotFound") {
      return res.status(404).json({ error: "El archivo PDF no existe en Azure Blob Storage" });
    }

    console.error("Error descargando PDF de cotizacion:", error.message);
    return res.status(500).json({ error: "No se pudo descargar el PDF de cotizacion" });
  }
});
router.post("/:id/reabrir-cotizacion", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);

  if (!Number.isInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ error: "id de orden no es valido" });
  }

  if (Object.keys(req.body || {}).length > 0) {
    return res.status(400).json({ error: "Esta accion no acepta campos en el body" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario no tiene sucursal asignada" });
    }

    const ordenResult = await client.query(
      `SELECT id_orden, estado, id_responsable, version
      FROM ordenes_servicio
      WHERE id_orden = $1
        AND id_sucursal = $2
      FOR UPDATE`,
      [idOrden, usuarioSucursal.id_sucursal]
    );

    if (ordenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const orden = ordenResult.rows[0];

    if (
      req.usuario.rol === "TECNICO" &&
      Number(orden.id_responsable) !== Number(req.usuario.id_usuario)
    ) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Orden no encontrada para el tecnico" });
    }

    if (orden.estado !== "REQUIERE_NUEVA_COTIZACION") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La orden no requiere una nueva cotizacion" });
    }

    const cotizacionResult = await client.query(
      `SELECT c.id_cotizacion, c.version, c.cerrada, c.pdf_estado, rc.respuesta
      FROM cotizaciones c
      LEFT JOIN respuestas_cotizacion rc ON rc.id_cotizacion = c.id_cotizacion
      WHERE c.id_orden = $1
      ORDER BY c.version DESC
      LIMIT 1
      FOR UPDATE OF c`,
      [idOrden]
    );
    const cotizacion = cotizacionResult.rows[0] || null;

    if (!cotizacion?.cerrada) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La ultima cotizacion debe estar cerrada" });
    }

    if (cotizacion.respuesta !== "SOLICITA_NUEVA_COTIZACION") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La ultima cotizacion no solicita una nueva propuesta" });
    }

    const updateResult = await client.query(
      `UPDATE ordenes_servicio
      SET estado = 'EN_REVISION',
          version = version + 1
      WHERE id_orden = $1
        AND estado = 'REQUIERE_NUEVA_COTIZACION'
      RETURNING id_orden, estado, id_responsable, version`,
      [idOrden]
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La orden ya fue reabierta o cambio de estado" });
    }

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden, estado_anterior, estado_nuevo, id_usuario, accion, observacion
      )
      VALUES ($1, 'REQUIERE_NUEVA_COTIZACION', 'EN_REVISION', $2, 'REABRIR_COTIZACION', $3)`,
      [idOrden, req.usuario.id_usuario, `Reapertura desde cotizacion version ${cotizacion.version}`]
    );

    await client.query("COMMIT");
    return res.json({
      orden: updateResult.rows[0],
      cotizacion_anterior: {
        version: cotizacion.version,
        cerrada: cotizacion.cerrada,
        pdf_estado: cotizacion.pdf_estado,
        respuesta: cotizacion.respuesta
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error reabriendo cotizacion:", error.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});
router.post("/:id/finalizar-borrador", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);

  if (!Number.isInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ error: "id de orden no es valido" });
  }

  if (Object.keys(req.body || {}).length > 0) {
    return res.status(400).json({ error: "Esta accion no acepta campos en el body" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const access = await getOrdenTrabajoEditable(client, idOrden, req.usuario);

    if (access.error) {
      await client.query("ROLLBACK");
      return res.status(access.status).json({ error: access.error });
    }

    if (!clean(access.orden.diagnostico)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Debe registrar el diagnostico antes de finalizar el borrador" });
    }

    const tipoOrden = normalizeTipoAtencion(access.orden.tipo_orden || access.orden.tipo_atencion);
    const garantiaAprobada = tipoOrden === "REVISION_GARANTIA" && access.orden.garantia_aprobada_por_admin === true;
    const garantiaRechazada = tipoOrden === "REVISION_GARANTIA" && access.orden.garantia_aprobada_por_admin === false;

    if (tipoOrden === "REVISION_GARANTIA" && !garantiaAprobada && !garantiaRechazada) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Debe registrar la decision final de garantia antes de finalizar el borrador" });
    }

    const stockInsuficienteResult = await client.query(
      `SELECT r.id_repuesto, r.nombre, r.stock, SUM(ru.cantidad)::INTEGER AS cantidad
      FROM repuestos_usados ru
      INNER JOIN repuestos r ON r.id_repuesto = ru.id_repuesto
      WHERE ru.id_orden = $1
      GROUP BY r.id_repuesto, r.nombre, r.stock
      HAVING SUM(ru.cantidad) > r.stock
      LIMIT 1`,
      [idOrden]
    );

    if (stockInsuficienteResult.rows.length > 0) {
      await client.query("ROLLBACK");
      const faltante = stockInsuficienteResult.rows[0];
      return res.status(409).json({
        error: `Stock insuficiente para ${faltante.nombre}`,
        id_repuesto: faltante.id_repuesto,
        stock_disponible: Number(faltante.stock),
        cantidad: Number(faltante.cantidad)
      });
    }

    const totalResult = await client.query(
      `SELECT COALESCE(SUM(subtotal), 0) AS total_repuestos
      FROM repuestos_usados
      WHERE id_orden = $1`,
      [idOrden]
    );
    const totalRepuestos = Number(totalResult.rows[0]?.total_repuestos || 0);
    const manoObra = Number(access.orden.mano_obra || 0);
    const valorIngresoOrden = Number(access.orden.valor_ingreso || 0);
    const requiereCotizacion = tipoOrden === "REPARACION" || garantiaRechazada;
    const valorIngresoAplicado = tipoOrden === "REPARACION" ? valorIngresoOrden : 0;
    const totalTrabajo = totalRepuestos + manoObra + (requiereCotizacion ? valorIngresoAplicado : valorIngresoOrden);
    const totalCliente = garantiaAprobada ? 0 : (requiereCotizacion ? totalRepuestos + manoObra + valorIngresoAplicado : null);
    let cotizacion = null;

    if (!requiereCotizacion && access.cotizacion) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La orden tiene una cotizacion incompatible con su tipo o garantia" });
    }

    if (requiereCotizacion) {
      cotizacion = await createCotizacionVersion(
        client,
        idOrden,
        totalRepuestos,
        valorIngresoAplicado,
        manoObra
      );
    }

    await client.query(
      `UPDATE ordenes_servicio
      SET version = version + 1
      WHERE id_orden = $1`,
      [idOrden]
    );

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden, estado_anterior, estado_nuevo, id_usuario, accion, observacion
      )
      VALUES ($1, $2, $2, $3, 'FINALIZAR_BORRADOR_TECNICO', $4)`,
      [
        idOrden,
        access.orden.estado,
        req.usuario.id_usuario,
        `Tipo ${tipoOrden}; version ${cotizacion?.version || "SIN_COTIZACION"}; total repuestos ${totalRepuestos}; mano de obra ${manoObra}; total cliente ${totalCliente ?? 0}`
      ]
    );

    await client.query("COMMIT");
    return res.json({
      cotizacion,
      resumen: {
        tipo_orden: tipoOrden,
        requiere_cotizacion: requiereCotizacion,
        version: cotizacion?.version || null,
        total_repuestos: totalRepuestos,
        mano_obra: manoObra,
        valor_ingreso: requiereCotizacion ? valorIngresoAplicado : valorIngresoOrden,
        total_preliminar: totalTrabajo,
        total_cliente: totalCliente
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ error: "La version de cotizacion ya fue creada" });
    }
    console.error("Error finalizando borrador tecnico:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.post("/:id/finalizar-reparacion", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idOrden = Number(req.params.id);

  if (!Number.isInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ error: "id de orden no es valido" });
  }

  if (Object.keys(req.body || {}).length > 0) {
    return res.status(400).json({ error: "Esta accion no acepta campos en el body" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      throw Object.assign(new Error("Usuario no tiene sucursal asignada"), { status: 400 });
    }

    const ordenResult = await client.query(
      `SELECT
        id_orden,
        id_sucursal,
        id_responsable,
        tipo_orden,
        tipo_atencion,
        diagnostico,
        garantia_aprobada_por_admin,
        estado,
        version
      FROM ordenes_servicio
      WHERE id_orden = $1
        AND id_sucursal = $2
      FOR UPDATE`,
      [idOrden, usuarioSucursal.id_sucursal]
    );

    if (ordenResult.rows.length === 0) {
      throw Object.assign(new Error("Orden no encontrada"), { status: 404 });
    }

    const orden = ordenResult.rows[0];

    if (
      req.usuario.rol === "TECNICO" &&
      Number(orden.id_responsable) !== Number(req.usuario.id_usuario)
    ) {
      throw Object.assign(new Error("Orden no encontrada para el tecnico"), { status: 404 });
    }

    const tipoOrden = normalizeTipoAtencion(orden.tipo_orden || orden.tipo_atencion);

    if (tipoOrden === "PUESTA_EN_MARCHA") {
      throw Object.assign(new Error("PUESTA_EN_MARCHA no se finaliza como reparacion"), { status: 409 });
    }

    const finalizacionResult = await client.query(
      `SELECT id_historial
      FROM historial_estados_orden
      WHERE id_orden = $1
        AND accion = 'FINALIZAR_REPARACION'
      ORDER BY id_historial DESC
      LIMIT 1
      FOR UPDATE`,
      [idOrden]
    );

    if (orden.estado === "LISTA_PARA_ENTREGA" || finalizacionResult.rows.length > 0) {
      throw Object.assign(new Error("La reparacion ya fue finalizada"), { status: 409 });
    }

    if (orden.estado !== "EN_REPARACION") {
      throw Object.assign(new Error("La orden debe estar EN_REPARACION para finalizar"), { status: 409 });
    }

    if (!clean(orden.diagnostico)) {
      throw Object.assign(new Error("Debe existir un diagnostico antes de finalizar la reparacion"), { status: 409 });
    }

    const garantiaAprobada = tipoOrden === "REVISION_GARANTIA" && orden.garantia_aprobada_por_admin === true;
    const garantiaRechazada = tipoOrden === "REVISION_GARANTIA" && orden.garantia_aprobada_por_admin === false;

    if (tipoOrden === "REVISION_GARANTIA" && !garantiaAprobada && !garantiaRechazada) {
      throw Object.assign(new Error("La orden de garantia no tiene una decision final"), { status: 409 });
    }

    if (!["REPARACION", "REVISION_GARANTIA", "MANTENCION"].includes(tipoOrden)) {
      throw Object.assign(new Error("El tipo de orden no admite finalizacion de reparacion"), { status: 409 });
    }

    const requiereCotizacionAprobada = tipoOrden === "REPARACION" || garantiaRechazada;

    if (requiereCotizacionAprobada) {
      const cotizacionResult = await client.query(
        `SELECT
          c.id_cotizacion,
          c.version,
          c.cerrada,
          c.pdf_estado,
          rc.respuesta
        FROM cotizaciones c
        LEFT JOIN respuestas_cotizacion rc ON rc.id_cotizacion = c.id_cotizacion
        WHERE c.id_orden = $1
        ORDER BY c.version DESC
        LIMIT 1
        FOR UPDATE OF c`,
        [idOrden]
      );
      const cotizacion = cotizacionResult.rows[0] || null;

      if (!cotizacion) {
        throw Object.assign(new Error("La reparacion requiere una cotizacion aprobada"), { status: 409 });
      }

      if (!cotizacion.cerrada) {
        throw Object.assign(new Error("La cotizacion debe estar cerrada"), { status: 409 });
      }

      if (cotizacion.pdf_estado !== "GENERADO") {
        throw Object.assign(new Error("La cotizacion debe tener un PDF generado"), { status: 409 });
      }

      if (cotizacion.respuesta !== "APROBADA") {
        throw Object.assign(new Error("La cotizacion debe tener respuesta APROBADA"), { status: 409 });
      }
    }

    const detallesResult = await client.query(
      `SELECT id_detalle, id_orden, id_repuesto, cantidad
      FROM repuestos_usados
      WHERE id_orden = $1
      ORDER BY id_repuesto NULLS LAST, id_detalle
      FOR UPDATE`,
      [idOrden]
    );
    const detalles = detallesResult.rows;

    for (const detalle of detalles) {
      if (Number(detalle.id_orden) !== idOrden) {
        throw Object.assign(new Error("Existe un detalle que no pertenece a la orden"), { status: 409 });
      }

      if (!Number.isInteger(Number(detalle.id_repuesto)) || Number(detalle.id_repuesto) <= 0) {
        throw Object.assign(new Error("Todos los detalles deben tener un repuesto de catalogo valido"), { status: 409 });
      }

      if (!Number.isInteger(Number(detalle.cantidad)) || Number(detalle.cantidad) <= 0) {
        throw Object.assign(new Error("Todos los detalles deben tener una cantidad positiva"), { status: 409 });
      }
    }

    const clavesIdempotencia = detalles.map(
      (detalle) => `consumo-reparacion-orden-${idOrden}-detalle-${detalle.id_detalle}`
    );
    const consumosExistentes = await client.query(
      `SELECT id_movimiento, id_detalle_repuesto, clave_idempotencia
      FROM movimientos_inventario
      WHERE (id_orden = $1 AND tipo_movimiento = 'CONSUMO_REPARACION')
        OR clave_idempotencia = ANY($2::VARCHAR[])
      FOR UPDATE`,
      [idOrden, clavesIdempotencia]
    );

    if (consumosExistentes.rows.length > 0) {
      throw Object.assign(new Error("El consumo de repuestos ya fue registrado para esta reparacion"), { status: 409 });
    }

    const idsRepuestos = [...new Set(detalles.map((detalle) => Number(detalle.id_repuesto)))];
    let repuestos = [];

    if (idsRepuestos.length > 0) {
      const repuestosResult = await client.query(
        `SELECT id_repuesto, id_sucursal, nombre, stock
        FROM repuestos
        WHERE id_repuesto = ANY($1::INTEGER[])
          AND id_sucursal = $2
        ORDER BY id_repuesto
        FOR UPDATE`,
        [idsRepuestos, usuarioSucursal.id_sucursal]
      );
      repuestos = repuestosResult.rows;

      if (repuestos.length !== idsRepuestos.length) {
        throw Object.assign(new Error("Uno o mas repuestos no existen en el catalogo de la sucursal"), { status: 409 });
      }
    }

    const repuestosPorId = new Map(
      repuestos.map((repuesto) => [Number(repuesto.id_repuesto), {
        ...repuesto,
        stock: Number(repuesto.stock)
      }])
    );
    const cantidadesPorRepuesto = new Map();

    for (const detalle of detalles) {
      const idRepuesto = Number(detalle.id_repuesto);
      cantidadesPorRepuesto.set(
        idRepuesto,
        (cantidadesPorRepuesto.get(idRepuesto) || 0) + Number(detalle.cantidad)
      );
    }

    for (const [idRepuesto, cantidadTotal] of cantidadesPorRepuesto) {
      const repuesto = repuestosPorId.get(idRepuesto);

      if (!repuesto || repuesto.stock < cantidadTotal) {
        throw Object.assign(new Error(`Stock insuficiente para ${repuesto?.nombre || `repuesto ${idRepuesto}`}`), {
          status: 409,
          details: {
            id_repuesto: idRepuesto,
            stock_disponible: repuesto?.stock ?? 0,
            cantidad_requerida: cantidadTotal
          }
        });
      }
    }

    const movimientos = [];

    for (const detalle of detalles) {
      const idRepuesto = Number(detalle.id_repuesto);
      const cantidad = Number(detalle.cantidad);
      const repuesto = repuestosPorId.get(idRepuesto);
      const stockAnterior = repuesto.stock;
      const stockNuevo = stockAnterior - cantidad;
      const claveIdempotencia = `consumo-reparacion-orden-${idOrden}-detalle-${detalle.id_detalle}`;

      const stockResult = await client.query(
        `UPDATE repuestos
        SET stock = $1
        WHERE id_repuesto = $2
          AND id_sucursal = $3
          AND stock = $4
        RETURNING id_repuesto, nombre, stock`,
        [stockNuevo, idRepuesto, usuarioSucursal.id_sucursal, stockAnterior]
      );

      if (stockResult.rows.length === 0) {
        throw Object.assign(new Error("El stock cambio mientras se finalizaba la reparacion"), { status: 409 });
      }

      const movimientoResult = await client.query(
        `INSERT INTO movimientos_inventario (
          id_repuesto,
          id_orden,
          id_detalle_repuesto,
          tipo_movimiento,
          cantidad,
          stock_anterior,
          stock_nuevo,
          motivo,
          id_usuario,
          clave_idempotencia
        )
        VALUES ($1, $2, $3, 'CONSUMO_REPARACION', $4, $5, $6, $7, $8, $9)
        RETURNING id_movimiento, id_repuesto, id_orden, id_detalle_repuesto,
          tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
          motivo, id_usuario, fecha_creacion, clave_idempotencia`,
        [
          idRepuesto,
          idOrden,
          detalle.id_detalle,
          cantidad,
          stockAnterior,
          stockNuevo,
          `Consumo definitivo al finalizar la reparacion de la orden ${idOrden}`,
          req.usuario.id_usuario,
          claveIdempotencia
        ]
      );

      movimientos.push({
        ...movimientoResult.rows[0],
        nombre_repuesto: repuesto.nombre
      });
      repuesto.stock = stockNuevo;
    }

    const ordenUpdateResult = await client.query(
      `UPDATE ordenes_servicio
      SET estado = 'LISTA_PARA_ENTREGA',
          fecha_lista_entrega = CURRENT_TIMESTAMP,
          version = version + 1
      WHERE id_orden = $1
        AND estado = 'EN_REPARACION'
      RETURNING id_orden, estado, fecha_lista_entrega, version, id_responsable`,
      [idOrden]
    );

    if (ordenUpdateResult.rows.length === 0) {
      throw Object.assign(new Error("La orden cambio mientras se finalizaba la reparacion"), { status: 409 });
    }

    const totalUnidades = detalles.reduce((total, detalle) => total + Number(detalle.cantidad), 0);
    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden, estado_anterior, estado_nuevo, id_usuario, accion, observacion
      )
      VALUES ($1, 'EN_REPARACION', 'LISTA_PARA_ENTREGA', $2, 'FINALIZAR_REPARACION', $3)`,
      [
        idOrden,
        req.usuario.id_usuario,
        movimientos.length > 0
          ? `Consumo definitivo: ${movimientos.length} detalles, ${totalUnidades} unidades`
          : "Reparacion finalizada sin consumo de repuestos"
      ]
    );

    await client.query("COMMIT");
    return res.json({
      orden: ordenUpdateResult.rows[0],
      movimientos,
      total_cliente: garantiaAprobada ? 0 : null
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505" && error.constraint === "ux_movimientos_inventario_clave_idempotencia") {
      return res.status(409).json({ error: "El consumo de repuestos ya fue registrado para esta reparacion" });
    }

    if (error.status) {
      return res.status(error.status).json({ error: error.message, ...(error.details || {}) });
    }

    console.error("Error finalizando reparacion:", {
      message: error.message,
      code: error.code
    });
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.get("/:id/evidencias", verificarRol("ADMIN", "TECNICO", "CLIENTE"), async (req, res) => {
  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario, true, true);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const evidencias = await getEvidencias(access.orden.id_orden);
    return res.json({ evidencias });
  } catch (error) {
    console.error("Error obteniendo evidencias:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/:id/evidencias", verificarRol("ADMIN", "TECNICO"), uploadEvidenciaMiddleware, async (req, res) => {
  const tipo = clean(req.body?.tipo).toUpperCase() || inferTipoEvidencia(req.file?.mimetype);
  const nombreArchivo = clean(req.body?.nombre_archivo);
  const referenciaUrl = clean(req.body?.referencia_url || req.body?.url_archivo);
  const descripcion = clean(req.body?.descripcion);

  if (!TIPOS_EVIDENCIA.includes(tipo)) {
    return res.status(400).json({ error: "tipo de evidencia no es valido" });
  }

  if (!req.file && !nombreArchivo && !referenciaUrl && !descripcion) {
    return res.status(400).json({ error: "nombre_archivo, referencia_url o descripcion es obligatorio" });
  }

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    let evidenciaData = {
      nombre_archivo: nombreArchivo || "Referencia sin archivo",
      url_archivo: referenciaUrl || null,
      referencia_url: referenciaUrl || null,
      descripcion
    };

    if (req.file) {
      const uploaded = await uploadEvidenceFile(req.file, access.orden.id_orden);
      evidenciaData = {
        nombre_archivo: uploaded.nombre_archivo,
        url_archivo: uploaded.url_archivo,
        referencia_url: uploaded.url_archivo,
        descripcion,
        mimetype: uploaded.mimetype,
        size: uploaded.size
      };
    }

    const result = await db.query(
      `INSERT INTO evidencias_orden (id_orden, tipo, nombre_archivo, referencia_url, url_archivo, descripcion)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_evidencia, id_orden, tipo, nombre_archivo, referencia_url, url_archivo, descripcion, fecha_creacion, fecha_subida`,
      [
        access.orden.id_orden,
        tipo,
        evidenciaData.nombre_archivo,
        evidenciaData.referencia_url,
        evidenciaData.url_archivo,
        evidenciaData.descripcion
      ]
    );

    return res.status(201).json({
      evidencia: {
        ...result.rows[0],
        mimetype: evidenciaData.mimetype || null,
        size: evidenciaData.size || null
      }
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("Error registrando evidencia:", {
      message: error.message,
      code: error.code,
      status
    });
    return res.status(status).json({ error: error.message || "Error interno del servidor" });
  }
});
router.post("/:id/solicitar-garantia", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const motivoRaw = req.body?.motivo_solicitud ?? req.body?.observacion ?? "";
  const observacion = clean(motivoRaw) || "Solicitud de garantia levantada desde orden de servicio";

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const duplicateResult = await db.query(
      `SELECT id_garantia
      FROM garantias
      WHERE id_orden = $1
        AND estado IN ('PENDIENTE', 'EN_REVISION')
      LIMIT 1`,
      [access.orden.id_orden]
    );

    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({ error: "Ya existe una solicitud de garantia activa para esta orden" });
    }

    const idTecnico = access.orden.id_tecnico || (req.usuario.rol === "TECNICO" ? req.usuario.id_usuario : null);
    const result = await db.query(
      `INSERT INTO garantias (id_orden, id_producto, id_sucursal, id_tecnico, estado, observacion)
      VALUES ($1, $2, $3, $4, 'PENDIENTE', $5)
      RETURNING id_garantia`,
      [access.orden.id_orden, access.orden.id_producto, access.orden.id_sucursal, idTecnico, observacion]
    );

    const garantia = await getGarantiaDetalle(result.rows[0].id_garantia);
    return res.status(201).json({ garantia });
  } catch (error) {
    console.error("Error solicitando garantia desde orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;