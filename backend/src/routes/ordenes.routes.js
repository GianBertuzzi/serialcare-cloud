const express = require("express");
const multer = require("multer");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");
const { uploadEvidenceFile } = require("../services/azureBlob.service");

const router = express.Router();

const TIPOS_ATENCION = ["GARANTIA", "REPARACION", "MANTENCION", "MANTENIMIENTO", "PUESTA_EN_MARCHA"];
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
LEFT JOIN usuarios u ON u.id_usuario = o.id_tecnico`;

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
  return tipo === "MANTENIMIENTO" ? "MANTENCION" : tipo;
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
    res.status(400).json({ error: "Usuario ADMIN/TECNICO no tiene sucursal asignada" });
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
    return { status: 400, error: "Usuario ADMIN/TECNICO no tiene sucursal asignada" };
  }

  if (Number(orden.id_sucursal) !== Number(usuarioSucursal.id_sucursal)) {
    return { status: 404, error: "Orden no encontrada para la sucursal del usuario" };
  }

  return { orden, usuarioSucursal };
}

async function refreshCotizacion(idOrden, client = db, estado = null, observacion = null) {
  const totalResult = await client.query(
    `SELECT COALESCE(SUM(subtotal), 0) AS total_repuestos
    FROM repuestos_usados
    WHERE id_orden = $1`,
    [idOrden]
  );

  const ordenResult = await client.query(
    `SELECT valor_ingreso, mano_obra
    FROM ordenes_servicio
    WHERE id_orden = $1
    LIMIT 1`,
    [idOrden]
  );

  if (ordenResult.rows.length === 0) {
    return null;
  }

  const totalRepuestos = Number(totalResult.rows[0]?.total_repuestos || 0);
  const valorIngreso = Number(ordenResult.rows[0]?.valor_ingreso || 0);
  const manoObra = Number(ordenResult.rows[0]?.mano_obra || 0);
  const totalGeneral = totalRepuestos + valorIngreso + manoObra;

  const result = await client.query(
    `INSERT INTO cotizaciones (
      id_orden,
      total_repuestos,
      valor_ingreso,
      mano_obra,
      total_general,
      total,
      estado,
      observacion
    )
    VALUES ($1, $2, $3, $4, $5, $5, COALESCE($6, 'BORRADOR'), $7)
    ON CONFLICT (id_orden) DO UPDATE
    SET total_repuestos = EXCLUDED.total_repuestos,
        valor_ingreso = EXCLUDED.valor_ingreso,
        mano_obra = EXCLUDED.mano_obra,
        total_general = EXCLUDED.total_general,
        total = EXCLUDED.total,
        estado = COALESCE($6, cotizaciones.estado),
        observacion = COALESCE($7, cotizaciones.observacion),
        fecha_actualizacion = CURRENT_TIMESTAMP
    RETURNING
      id_cotizacion,
      id_orden,
      total_repuestos,
      valor_ingreso,
      mano_obra,
      total_general,
      total,
      estado,
      observacion,
      fecha_creacion,
      fecha_actualizacion,
      fecha_respuesta`,
    [idOrden, totalRepuestos, valorIngreso, manoObra, totalGeneral, estado, observacion]
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
      id_cotizacion,
      id_orden,
      total_repuestos,
      valor_ingreso,
      mano_obra,
      total_general,
      total,
      estado,
      observacion,
      fecha_creacion,
      fecha_actualizacion,
      fecha_respuesta
    FROM cotizaciones
    WHERE id_orden = $1
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
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
  const [repuestos, cotizacion, garantia, evidencias] = await Promise.all([
    getRepuestos(orden.id_orden),
    getCotizacion(orden.id_orden),
    getGarantiaPorOrden(orden.id_orden),
    getEvidencias(orden.id_orden)
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
      telefono: orden.cliente_telefono
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
    garantia,
    evidencias
  };
}
router.get("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const isMarca = req.usuario.rol === "MARCA";

  try {
    const usuarioSucursal = isMarca ? null : await getUsuarioSucursal(req.usuario.id_usuario);

    if (!isMarca && !requireSucursal(usuarioSucursal, res)) {
      return;
    }

    const params = isMarca ? [] : [usuarioSucursal.id_sucursal];

    const result = await db.query(
      `${ORDEN_SELECT}
      ${isMarca ? "" : "WHERE o.id_sucursal = $1"}
      ORDER BY o.fecha_creacion DESC, o.id_orden DESC`,
      params
    );

    return res.json({ ordenes: result.rows });
  } catch (error) {
    console.error("Error listando ordenes de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const tipoAtencion = normalizeTipoAtencion(req.body?.tipo_atencion || req.body?.tipo_orden);
  const descripcionProblema = clean(req.body?.descripcion_problema || req.body?.diagnostico);
  const idTecnico = req.usuario.rol === "TECNICO" ? Number(req.usuario.id_usuario) : (req.body?.id_tecnico ? Number(req.body.id_tecnico) : null);
  const client = await db.pool.connect();

  if (!TIPOS_ATENCION.includes(tipoAtencion)) {
    return res.status(400).json({ error: "tipo_atencion no es valido" });
  }

  try {
    await client.query("BEGIN");

    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario, client);

    if (!usuarioSucursal?.id_sucursal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Usuario ADMIN/TECNICO no tiene sucursal asignada" });
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

    if (idTecnico) {
      const tecnicoCheck = await client.query(
        `SELECT u.id_usuario
        FROM usuarios u
        INNER JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = $1
          AND u.id_sucursal = $2
          AND r.nombre_rol = 'TECNICO'
        LIMIT 1`,
        [idTecnico, usuarioSucursal.id_sucursal]
      );

      if (tecnicoCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Tecnico no encontrado para la sucursal" });
      }
    }

    const insertResult = await client.query(
      `INSERT INTO ordenes_servicio (
        id_sucursal,
        id_cliente,
        id_producto,
        id_tipo_maquina,
        id_tecnico,
        id_modelo,
        costo_ingreso_taller,
        valor_ingreso,
        valor_revision,
        tipo_atencion,
        tipo_orden,
        descripcion_problema,
        diagnostico,
        estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $9, $10, $11, 'PENDIENTE')
      RETURNING id_orden`,
      [
        usuarioSucursal.id_sucursal,
        clienteId,
        producto.id_producto,
        tipoMaquina.id_tipo_maquina,
        idTecnico,
        producto.id_modelo,
        usuarioSucursal.costo_ingreso_taller || 0,
        valorIngreso,
        tipoAtencion,
        descripcionProblema,
        descripcionProblema
      ]
    );

    await refreshCotizacion(insertResult.rows[0].id_orden, client);
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

router.get("/:id/detalle", verificarRol("ADMIN", "TECNICO", "CLIENTE"), async (req, res) => {
  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario, true, true);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const detalle = await buildOrdenDetalle(access.orden);
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

router.put("/:id/informe-tecnico", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const diagnostico = clean(req.body?.diagnostico);
  const informeTecnico = clean(req.body?.informe_tecnico);
  const manoObra = parseMoney(req.body?.mano_obra, 0);

  if (manoObra === null) {
    return res.status(400).json({ error: "mano_obra debe ser numero mayor o igual a 0" });
  }

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    await db.query(
      `UPDATE ordenes_servicio
      SET diagnostico = COALESCE(NULLIF($1, ''), diagnostico),
          informe_tecnico = COALESCE(NULLIF($2, ''), informe_tecnico),
          mano_obra = $3
      WHERE id_orden = $4
        AND id_sucursal = $5`,
      [diagnostico, informeTecnico, manoObra, access.orden.id_orden, access.orden.id_sucursal]
    );

    await refreshCotizacion(access.orden.id_orden);
    const orden = await getOrdenDetalle(access.orden.id_orden);
    return res.json({ orden });
  } catch (error) {
    console.error("Error guardando informe tecnico:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/decision-garantia", verificarRol("ADMIN"), async (req, res) => {
  const garantiaAprobada = req.body?.garantia_aprobada_por_admin === true || req.body?.garantia_aprobada_por_admin === "true";
  const observacionAdmin = clean(req.body?.observacion_admin || req.body?.observacion);

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    await db.query(
      `UPDATE ordenes_servicio
      SET garantia_aprobada_por_admin = $1,
          observacion_admin = $2
      WHERE id_orden = $3
        AND id_sucursal = $4`,
      [garantiaAprobada, observacionAdmin, access.orden.id_orden, access.orden.id_sucursal]
    );

    const garantiaExistente = await getGarantiaPorOrden(access.orden.id_orden);
    const estadoGarantia = garantiaAprobada ? "APROBADA" : "RECHAZADA";

    if (garantiaExistente) {
      await db.query(
        `UPDATE garantias
        SET estado = $1,
            observacion_admin = $2,
            observacion_marca = $2,
            fecha_revision = CURRENT_TIMESTAMP
        WHERE id_garantia = $3`,
        [estadoGarantia, observacionAdmin, garantiaExistente.id_garantia]
      );
    } else {
      await db.query(
        `INSERT INTO garantias (id_orden, id_producto, id_sucursal, id_tecnico, estado, observacion, observacion_admin, observacion_marca, fecha_revision)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, CURRENT_TIMESTAMP)`,
        [
          access.orden.id_orden,
          access.orden.id_producto,
          access.orden.id_sucursal,
          access.orden.id_tecnico,
          estadoGarantia,
          "Decision interna creada por admin de sucursal",
          observacionAdmin
        ]
      );
    }

    const orden = await getOrdenDetalle(access.orden.id_orden);
    return res.json({ orden });
  } catch (error) {
    console.error("Error guardando decision de garantia:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});
router.get("/:id/repuestos", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario, true);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const repuestos = await getRepuestos(access.orden.id_orden);
    return res.json({ repuestos });
  } catch (error) {
    console.error("Error listando repuestos de orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/:id/repuestos", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const idRepuesto = req.body?.id_repuesto ? Number(req.body.id_repuesto) : null;
  const cantidadValue = parsePositiveInteger(req.body?.cantidad, 1);
  const precioBody = parseMoney(req.body?.precio_unitario, 0);
  const cubiertoGarantiaValue = req.body?.cubierto_garantia === true || req.body?.cubierto_garantia === "true";
  const observacionValue = clean(req.body?.observacion);

  if (cantidadValue === null) {
    return res.status(400).json({ error: "cantidad debe ser un numero entero mayor o igual a 1" });
  }

  if (precioBody === null) {
    return res.status(400).json({ error: "precio_unitario debe ser un numero mayor o igual a 0" });
  }

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    let nombreRepuesto = clean(req.body?.nombre_repuesto);
    let precioUnitario = precioBody;

    if (idRepuesto) {
      const repuestoResult = await db.query(
        `SELECT id_repuesto, nombre, precio
        FROM repuestos
        WHERE id_repuesto = $1
          AND id_sucursal = $2
          AND estado = 'ACTIVO'
        LIMIT 1`,
        [idRepuesto, access.orden.id_sucursal]
      );

      if (repuestoResult.rows.length === 0) {
        return res.status(404).json({ error: "Repuesto no encontrado para la sucursal" });
      }

      nombreRepuesto = repuestoResult.rows[0].nombre;
      precioUnitario = req.usuario.rol === "ADMIN" && req.body?.precio_unitario !== undefined
        ? precioBody
        : Number(repuestoResult.rows[0].precio || 0);
    }

    if (!nombreRepuesto) {
      return res.status(400).json({ error: "nombre_repuesto o id_repuesto es obligatorio" });
    }

    const subtotal = cantidadValue * precioUnitario;
    const result = await db.query(
      `INSERT INTO repuestos_usados (id_orden, id_repuesto, nombre_repuesto, cantidad, precio_unitario, subtotal, cubierto_garantia, observacion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_detalle, id_detalle AS id_repuesto_usado, id_orden, id_repuesto, nombre_repuesto, cantidad, precio_unitario, subtotal, cubierto_garantia, observacion, fecha_registro`,
      [access.orden.id_orden, idRepuesto, nombreRepuesto, cantidadValue, precioUnitario, subtotal, cubiertoGarantiaValue, observacionValue]
    );

    await refreshCotizacion(access.orden.id_orden);
    return res.status(201).json({ repuesto: result.rows[0] });
  } catch (error) {
    console.error("Error agregando repuesto a orden:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put("/:id/repuestos/:idDetalle", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const cantidadValue = parsePositiveInteger(req.body?.cantidad, 1);
  const observacionValue = clean(req.body?.observacion);
  const cubiertoGarantiaValue = req.body?.cubierto_garantia === true || req.body?.cubierto_garantia === "true";
  const precioBody = parseMoney(req.body?.precio_unitario, 0);

  if (cantidadValue === null || precioBody === null) {
    return res.status(400).json({ error: "cantidad y precio_unitario deben ser validos" });
  }

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const existing = await db.query(
      `SELECT ru.id_detalle, ru.id_repuesto, COALESCE(r.precio, ru.precio_unitario) AS precio_catalogo
      FROM repuestos_usados ru
      LEFT JOIN repuestos r ON r.id_repuesto = ru.id_repuesto
      WHERE ru.id_detalle = $1
        AND ru.id_orden = $2
      LIMIT 1`,
      [req.params.idDetalle, access.orden.id_orden]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Detalle de repuesto no encontrado" });
    }

    const precioUnitario = req.usuario.rol === "ADMIN" ? precioBody : Number(existing.rows[0].precio_catalogo || 0);
    const subtotal = cantidadValue * precioUnitario;

    const result = await db.query(
      `UPDATE repuestos_usados
      SET cantidad = $1,
          precio_unitario = $2,
          subtotal = $3,
          cubierto_garantia = $4,
          observacion = $5
      WHERE id_detalle = $6
        AND id_orden = $7
      RETURNING id_detalle, id_detalle AS id_repuesto_usado, id_orden, id_repuesto, nombre_repuesto, cantidad, precio_unitario, subtotal, cubierto_garantia, observacion, fecha_registro`,
      [cantidadValue, precioUnitario, subtotal, cubiertoGarantiaValue, observacionValue, req.params.idDetalle, access.orden.id_orden]
    );

    await refreshCotizacion(access.orden.id_orden);
    return res.json({ repuesto: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando repuesto usado:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/:id/cotizacion", verificarRol("ADMIN", "TECNICO", "CLIENTE"), async (req, res) => {
  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario, true, true);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    let cotizacion = await getCotizacion(access.orden.id_orden);
    if (!cotizacion) {
      cotizacion = await refreshCotizacion(access.orden.id_orden);
    }

    return res.json({ cotizacion });
  } catch (error) {
    console.error("Error obteniendo cotizacion:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/:id/cotizacion", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const manoObra = parseMoney(req.body?.mano_obra, 0);
  const observacion = clean(req.body?.observacion);
  const estado = clean(req.body?.estado).toUpperCase() || "BORRADOR";

  if (manoObra === null) {
    return res.status(400).json({ error: "mano_obra debe ser un numero mayor o igual a 0" });
  }

  if (!["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA"].includes(estado)) {
    return res.status(400).json({ error: "estado de cotizacion no es valido" });
  }

  try {
    const access = await getOrdenParaUsuario(req.params.id, req.usuario);

    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    await db.query(
      `UPDATE ordenes_servicio
      SET mano_obra = $1
      WHERE id_orden = $2
        AND id_sucursal = $3`,
      [manoObra, access.orden.id_orden, access.orden.id_sucursal]
    );

    const cotizacion = await refreshCotizacion(access.orden.id_orden, db, estado, observacion);
    return res.json({ cotizacion });
  } catch (error) {
    console.error("Error guardando cotizacion:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
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