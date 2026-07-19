const express = require("express");
const multer = require("multer");
const db = require("../../db");
const verificarToken = require("../../middlewares/verificarToken");
const verificarRol = require("../../middlewares/verificarRol");
const { uploadEvidenceFile } = require("../../services/azureBlob.service");
const { clean, normalizeTipoAtencion, parsePositiveInteger } = require("../../shared/utils/orderValidation");
const {
  getOrdenParaUsuario,
  getRepuestos,
  getBorradorTecnicoFinalizado,
  getEvidencias,
  getOrdenTrabajoEditable
} = require("../../shared/repositories/ordenAccess.repository");

const router = express.Router();

router.use(verificarToken);

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

module.exports = router;
