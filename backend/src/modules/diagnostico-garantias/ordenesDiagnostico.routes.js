const express = require("express");
const db = require("../../db");
const verificarToken = require("../../middlewares/verificarToken");
const verificarRol = require("../../middlewares/verificarRol");
const { clean, normalizeTipoAtencion, parseMoney } = require("../../shared/utils/orderValidation");
const { getUsuarioSucursal } = require("../../shared/services/usuarioContext.service");
const {
  getOrdenDetalle,
  getGarantiaDetalle,
  getOrdenTrabajoEditable
} = require("../../shared/repositories/ordenAccess.repository");

const router = express.Router();

router.use(verificarToken);

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

module.exports = router;
