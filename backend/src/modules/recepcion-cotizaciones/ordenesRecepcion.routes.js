const crypto = require("crypto");
const express = require("express");
const db = require("../../db");
const verificarToken = require("../../middlewares/verificarToken");
const verificarRol = require("../../middlewares/verificarRol");
const {
  uploadPrivateBuffer,
  downloadPrivateBuffer,
  deletePrivateBlob,
  getEvidenceBlobName
} = require("../../services/azureBlob.service");
const { generateQuotationPdf } = require("../../services/quotationPdf.service");
const { clean, normalizeTipoAtencion, parseNonNegativeDecimal } = require("../../shared/utils/orderValidation");
const { getUsuarioSucursal, requireSucursal } = require("../../shared/services/usuarioContext.service");
const {
  ORDEN_SELECT,
  getOrdenDetalle,
  getOrdenParaUsuario,
  getRepuestos,
  getCotizacion,
  getBorradorTecnicoFinalizado,
  getEvidencias,
  getGarantiaPorOrden
} = require("../../shared/repositories/ordenAccess.repository");

const router = express.Router();
const TIPOS_ATENCION = ["REVISION_GARANTIA", "REPARACION", "MANTENCION", "PUESTA_EN_MARCHA"];

router.use(verificarToken);

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
    evidencias: evidencias.map((evidencia) => ({
      ...evidencia,
      archivo_gestionado: Boolean(
        getEvidenceBlobName(evidencia.referencia_url)
        || getEvidenceBlobName(evidencia.url_archivo)
      )
    })),
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
    const cotizacionEmitida = {
      ...cotizacion,
      estado: "ENVIADA"
    };
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
      cotizacion: cotizacionEmitida,
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
      SET estado = 'ENVIADA',
          pdf_estado = 'GENERADO',
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

router.post("/:id/entregar", verificarRol("ADMIN", "RECEPCIONISTA"), async (req, res) => {
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
      `SELECT id_orden, estado, fecha_entrega
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

    if (orden.estado === "ENTREGADA" || orden.fecha_entrega) {
      throw Object.assign(new Error("La orden ya fue entregada"), { status: 409 });
    }

    if (!["LISTA_PARA_ENTREGA", "RETIRO_SIN_REPARAR"].includes(orden.estado)) {
      throw Object.assign(
        new Error("La orden debe estar LISTA_PARA_ENTREGA o RETIRO_SIN_REPARAR para entregar"),
        { status: 409 }
      );
    }

    const entregaResult = await client.query(
      `UPDATE ordenes_servicio
      SET estado = 'ENTREGADA',
          fecha_entrega = CURRENT_TIMESTAMP,
          version = version + 1
      WHERE id_orden = $1
        AND estado = $2
        AND fecha_entrega IS NULL
      RETURNING id_orden, estado, fecha_entrega, version`,
      [idOrden, orden.estado]
    );

    if (entregaResult.rows.length === 0) {
      throw Object.assign(new Error("La orden ya no esta disponible para entrega"), { status: 409 });
    }

    await client.query(
      `INSERT INTO historial_estados_orden (
        id_orden, estado_anterior, estado_nuevo, id_usuario, accion
      )
      VALUES ($1, $2, 'ENTREGADA', $3, 'ENTREGAR_ORDEN')`,
      [idOrden, orden.estado, req.usuario.id_usuario]
    );

    await client.query("COMMIT");
    return res.json({
      mensaje: "Entrega registrada correctamente",
      orden: entregaResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("Error entregando orden:", {
      message: error.message,
      code: error.code
    });
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

module.exports = router;
