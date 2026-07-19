const db = require("../../db");
const { getUsuarioSucursal } = require("../services/usuarioContext.service");

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

module.exports = {
  ORDEN_SELECT,
  getOrdenDetalle,
  getGarantiaDetalle,
  getOrdenParaUsuario,
  getRepuestos,
  getCotizacion,
  getBorradorTecnicoFinalizado,
  getEvidencias,
  getGarantiaPorOrden,
  getOrdenTrabajoEditable
};
