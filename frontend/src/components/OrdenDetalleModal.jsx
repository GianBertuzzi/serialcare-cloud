import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "./StatusBadge.jsx";
import api, { createEvidenciaManual, uploadEvidenciaOrden } from "../services/api";
import { formatCurrency, formatDate } from "../utils/format.js";

const initialRepuestoForm = { id_repuesto: "", cantidad: "1", observacion: "" };
const initialEvidenciaForm = { tipo: "IMAGEN", nombre_archivo: "", url_archivo: "", descripcion: "" };
const initialEvidenciaUploadForm = { tipo: "IMAGEN", descripcion: "", file: null };
const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const initialDecisionForm = { observacion: "" };
const initialDiscountForm = { tipo_descuento: "", valor_descuento: "0", motivo_descuento: "" };

function DetailItem({ label, children }) {
  return <div className="detail-box"><span>{label}</span><strong>{children || "Sin dato"}</strong></div>;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function normalizeTipoOrden(value) {
  const tipo = String(value || "").trim().toUpperCase();
  return tipo === "GARANTIA" ? "REVISION_GARANTIA" : tipo;
}

function OrdenDetalleModal({ orden, readOnly = false, workflowMode = false, onClose, onUpdated }) {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const isTecnico = user?.rol === "TECNICO";
  const isRecepcionista = user?.rol === "RECEPCIONISTA";
  const isReadOnly = readOnly || isRecepcionista;
  const [activeTab, setActiveTab] = useState("resumen");
  const [detalle, setDetalle] = useState(null);
  const [catalogoRepuestos, setCatalogoRepuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState("");
  const [repuestoForm, setRepuestoForm] = useState(initialRepuestoForm);
  const [informeForm, setInformeForm] = useState({ diagnostico: "", informe_tecnico: "", mano_obra: "0" });
  const [evidenciaForm, setEvidenciaForm] = useState(initialEvidenciaForm);
  const [evidenciaUploadForm, setEvidenciaUploadForm] = useState(initialEvidenciaUploadForm);
  const [decisionForm, setDecisionForm] = useState(initialDecisionForm);
  const [discountForm, setDiscountForm] = useState(initialDiscountForm);
  const [cantidadesRepuestos, setCantidadesRepuestos] = useState({});

  const idOrden = orden?.id_orden;

  async function loadDetalle() {
    if (!idOrden) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/ordenes/${idOrden}/detalle`);
      const nextDetalle = response.data.detalle || null;
      setDetalle(nextDetalle);
      setInformeForm({
        diagnostico: nextDetalle?.orden?.diagnostico || "",
        informe_tecnico: nextDetalle?.orden?.informe_tecnico || "",
        mano_obra: String(nextDetalle?.orden?.mano_obra ?? 0)
      });

      setDecisionForm({
        observacion: nextDetalle?.orden?.observacion_admin || nextDetalle?.garantia?.observacion_admin || ""
      });
      setDiscountForm({
        tipo_descuento: nextDetalle?.cotizacion?.tipo_descuento || "",
        valor_descuento: String(nextDetalle?.cotizacion?.valor_descuento ?? 0),
        motivo_descuento: nextDetalle?.cotizacion?.motivo_descuento || ""
      });
      setCantidadesRepuestos(Object.fromEntries((nextDetalle?.repuestos || []).map((repuesto) => [
        repuesto.id_repuesto_usado,
        String(repuesto.cantidad)
      ])));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo cargar el detalle de la orden.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogoRepuestos() {
    if (isReadOnly) return;
    try {
      const response = await api.get("/repuestos");
      setCatalogoRepuestos(response.data.repuestos || []);
    } catch {
      setCatalogoRepuestos([]);
    }
  }

  useEffect(() => {
    setActiveTab("resumen");
    setSuccess("");
    setError("");
    setRepuestoForm(initialRepuestoForm);
    setEvidenciaForm(initialEvidenciaForm);
    setEvidenciaUploadForm(initialEvidenciaUploadForm);
    loadDetalle();
    loadCatalogoRepuestos();
  }, [idOrden]);

  const totalRepuestos = useMemo(() => (detalle?.repuestos || []).reduce((total, repuesto) => total + Number(repuesto.subtotal ?? Number(repuesto.cantidad || 0) * Number(repuesto.precio_unitario || 0)), 0), [detalle]);
  const tipoOrden = normalizeTipoOrden(detalle?.orden?.tipo_orden || detalle?.orden?.tipo_atencion);
  const isGarantiaOrder = tipoOrden === "REVISION_GARANTIA";
  const hasDiagnostico = Boolean(detalle?.orden?.diagnostico?.trim());
  const hasFinalDecision = (detalle?.orden?.garantia_aprobada_por_admin !== null
    && detalle?.orden?.garantia_aprobada_por_admin !== undefined)
    || ["APROBADA", "RECHAZADA"].includes(detalle?.garantia?.estado);
  const ownsOrder = isAdmin || (isTecnico && Number(detalle?.orden?.id_responsable) === Number(user?.id_usuario));
  const canEditDiagnostico = workflowMode
    && !isReadOnly
    && (isAdmin || isTecnico)
    && detalle?.orden?.estado === "EN_REVISION"
    && ownsOrder;
  const canDecideGarantia = canEditDiagnostico && isGarantiaOrder && hasDiagnostico && !hasFinalDecision;
  const garantiaAprobada = isGarantiaOrder && detalle?.orden?.garantia_aprobada_por_admin === true;
  const garantiaRechazada = isGarantiaOrder && detalle?.orden?.garantia_aprobada_por_admin === false;
  const borradorFinalizado = detalle?.borrador_tecnico_finalizado === true;
  const canEditTrabajo = workflowMode
    && !isReadOnly
    && (isAdmin || isTecnico)
    && ["EN_REVISION", "EN_REPARACION"].includes(detalle?.orden?.estado)
    && ownsOrder
    && !borradorFinalizado
    && (!detalle?.cotizacion || detalle.cotizacion.estado === "BORRADOR");
  const requiereCotizacion = tipoOrden === "REPARACION" || garantiaRechazada;
  const valorIngreso = Number(detalle?.orden?.valor_ingreso || detalle?.orden?.valor_revision || 0);
  const valorIngresoAplicado = garantiaRechazada ? 0 : valorIngreso;
  const manoObra = Number(detalle?.orden?.mano_obra || 0);
  const totalPreliminar = totalRepuestos + manoObra + valorIngresoAplicado;
  const totalCliente = garantiaAprobada ? 0 : (requiereCotizacion ? totalPreliminar : null);
  const canFinalizarBorrador = canEditTrabajo && hasDiagnostico && (!isGarantiaOrder || hasFinalDecision);
  const repuestoSeleccionado = catalogoRepuestos.find((repuesto) => String(repuesto.id_repuesto) === String(repuestoForm.id_repuesto));
  const cotizacionActual = detalle?.cotizacion || null;
  const subtotalCotizacion = Number(cotizacionActual?.subtotal_original ?? totalPreliminar);
  const totalFinalCotizacion = Number(cotizacionActual?.total_final ?? subtotalCotizacion);
  const canEditDiscount = isAdmin
    && !isReadOnly
    && cotizacionActual?.estado === "BORRADOR"
    && cotizacionActual?.cerrada === false
    && cotizacionActual?.pdf_estado === "NO_GENERADO";
  const canGeneratePdf = canEditDiscount && requiereCotizacion && borradorFinalizado;
  const canAccessPdf = cotizacionActual?.cerrada === true
    && cotizacionActual?.pdf_estado === "GENERADO"
    && Boolean(cotizacionActual?.pdf_blob_name);

  async function afterMutation(message) {
    setSuccess(message);
    await loadDetalle();
    onUpdated?.(message);
  }

  function handleRepuestoChange(event) {
    const { name, value } = event.target;
    setRepuestoForm((current) => ({ ...current, [name]: value }));
  }

  async function handleAddRepuesto(event) {
    event.preventDefault();
    setSaving("repuesto");
    setError("");
    setSuccess("");
    try {
      await api.post(`/ordenes/${idOrden}/repuestos`, {
        id_repuesto: Number(repuestoForm.id_repuesto),
        cantidad: Number(repuestoForm.cantidad),
        observacion: repuestoForm.observacion.trim()
      });
      setRepuestoForm(initialRepuestoForm);
      await afterMutation("Repuesto agregado correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo agregar el repuesto.");
    } finally {
      setSaving("");
    }
  }

  async function handleUpdateRepuesto(repuesto) {
    setSaving(`repuesto-${repuesto.id_repuesto_usado}`);
    setError("");
    setSuccess("");
    try {
      await api.put(`/ordenes/${idOrden}/repuestos/${repuesto.id_repuesto_usado}`, {
        cantidad: Number(cantidadesRepuestos[repuesto.id_repuesto_usado])
      });
      await afterMutation("Cantidad actualizada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo actualizar el repuesto.");
    } finally {
      setSaving("");
    }
  }

  async function handleRemoveRepuesto(repuesto) {
    setSaving(`repuesto-${repuesto.id_repuesto_usado}`);
    setError("");
    setSuccess("");
    try {
      await api.delete(`/ordenes/${idOrden}/repuestos/${repuesto.id_repuesto_usado}`);
      await afterMutation("Repuesto retirado del borrador.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo retirar el repuesto.");
    } finally {
      setSaving("");
    }
  }
  async function handleSaveInforme(event) {
    event.preventDefault();
    setSaving("informe");
    setError("");
    setSuccess("");
    try {
      await api.put(`/ordenes/${idOrden}/diagnostico`, {
        diagnostico: informeForm.diagnostico.trim(),
        informe_tecnico: informeForm.informe_tecnico.trim(),
        mano_obra: Number(informeForm.mano_obra || 0)
      });
      await afterMutation("Diagnostico guardado correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo guardar el diagnostico.");
    } finally {
      setSaving("");
    }
  }

  async function handleSaveManoObra(event) {
    event.preventDefault();
    setSaving("mano-obra");
    setError("");
    setSuccess("");
    try {
      await api.put(`/ordenes/${idOrden}/mano-obra`, {
        mano_obra: Number(informeForm.mano_obra || 0)
      });
      await afterMutation("Mano de obra actualizada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo actualizar la mano de obra.");
    } finally {
      setSaving("");
    }
  }

  async function handleSaveDiscount(event) {
    event.preventDefault();
    setSaving("descuento");
    setError("");
    setSuccess("");
    const tipoDescuento = discountForm.tipo_descuento || null;
    try {
      await api.put(`/ordenes/${idOrden}/cotizaciones/${cotizacionActual.version}/descuento`, {
        tipo_descuento: tipoDescuento,
        valor_descuento: tipoDescuento ? Number(discountForm.valor_descuento) : 0,
        motivo_descuento: tipoDescuento ? discountForm.motivo_descuento.trim() : null
      });
      await afterMutation(tipoDescuento ? "Descuento actualizado correctamente." : "Descuento retirado correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo actualizar el descuento.");
    } finally {
      setSaving("");
    }
  }
  async function handleGeneratePdf() {
    if (!window.confirm("La version quedara cerrada e inmutable. ¿Deseas generar el PDF?")) return;

    setSaving("generar-pdf");
    setError("");
    setSuccess("");
    try {
      await api.post(`/ordenes/${idOrden}/cotizaciones/${cotizacionActual.version}/generar-pdf`);
      await afterMutation("PDF generado y cotizacion cerrada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo generar el PDF de cotizacion.");
    } finally {
      setSaving("");
    }
  }

  async function handlePdf(openInline) {
    const previewWindow = openInline ? window.open("", "_blank") : null;
    setSaving(openInline ? "ver-pdf" : "descargar-pdf");
    setError("");
    try {
      const response = await api.get(`/ordenes/${idOrden}/cotizaciones/${cotizacionActual.version}/pdf`, {
        params: openInline ? { inline: true } : undefined,
        responseType: "blob"
      });
      const objectUrl = URL.createObjectURL(response.data);

      if (openInline) {
        if (previewWindow) previewWindow.location.href = objectUrl;
        else window.open(objectUrl, "_blank");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = cotizacionActual.pdf_nombre_archivo || `cotizacion-v${cotizacionActual.version}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (requestError) {
      previewWindow?.close();
      setError(requestError.response?.data?.error || "No se pudo obtener el PDF de cotizacion.");
    } finally {
      setSaving("");
    }
  }
  async function handleFinalizarBorrador() {
    setSaving("finalizar-borrador");
    setError("");
    setSuccess("");
    try {
      await api.post(`/ordenes/${idOrden}/finalizar-borrador`);
      await afterMutation("Borrador tecnico finalizado correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo finalizar el borrador tecnico.");
    } finally {
      setSaving("");
    }
  }
  async function handleAddEvidencia(event) {
    event.preventDefault();
    setSaving("evidencia");
    setError("");
    setSuccess("");
    try {
      await createEvidenciaManual(idOrden, {
        tipo: evidenciaForm.tipo,
        nombre_archivo: evidenciaForm.nombre_archivo.trim(),
        referencia_url: evidenciaForm.url_archivo.trim(),
        descripcion: evidenciaForm.descripcion.trim()
      });
      setEvidenciaForm(initialEvidenciaForm);
      await afterMutation("Evidencia registrada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo registrar la evidencia.");
    } finally {
      setSaving("");
    }
  }

  async function handleUploadEvidencia(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!evidenciaUploadForm.file) {
      setError("Selecciona un archivo para subir.");
      return;
    }

    if (evidenciaUploadForm.file.size > MAX_EVIDENCE_FILE_SIZE) {
      setError("El archivo no puede superar 10 MB.");
      return;
    }

    if (!ALLOWED_EVIDENCE_FILE_TYPES.has(evidenciaUploadForm.file.type)) {
      setError("Tipo de archivo no permitido. Usa JPG, PNG, WEBP, PDF, TXT, DOC o DOCX.");
      return;
    }

    setSaving("evidencia-upload");
    try {
      const formData = new FormData();
      formData.append("file", evidenciaUploadForm.file);
      formData.append("tipo", evidenciaUploadForm.tipo);
      formData.append("descripcion", evidenciaUploadForm.descripcion.trim());

      await uploadEvidenciaOrden(idOrden, formData);
      setEvidenciaUploadForm(initialEvidenciaUploadForm);
      await afterMutation("Evidencia subida correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo subir la evidencia.");
    } finally {
      setSaving("");
    }
  }
  async function handleDecisionGarantia(decision) {
    setSaving("decision");
    setError("");
    setSuccess("");
    try {
      await api.put(`/ordenes/${idOrden}/decision-garantia`, {
        decision,
        observacion: decisionForm.observacion.trim()
      });
      await afterMutation(`Garantia ${decision.toLowerCase()} correctamente.`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo guardar la decision de garantia.");
    } finally {
      setSaving("");
    }
  }
  if (!orden) return null;

  const tabs = isRecepcionista
    ? [
        ["resumen", "Resumen"],
        ["producto", "Cliente / Maquina"],
        ...(borradorFinalizado ? [["repuestos", "Repuestos"], ["borrador", "Borrador tecnico"]] : [])
      ]
    : workflowMode
      ? [
          ["resumen", "Resumen"],
          ["producto", "Cliente / Maquina"],
          ["diagnostico", "Diagnostico"],
          ...(isGarantiaOrder ? [["garantia", "Garantia"]] : []),
          ["repuestos", "Repuestos"],
          ["borrador", "Borrador tecnico"]
        ]
      : [
          ["resumen", "Resumen"],
          ["producto", "Cliente / Producto"],
          ["diagnostico", "Diagnostico"],
          ["repuestos", "Repuestos usados"],
          ["borrador", "Borrador tecnico"],
          ["garantia", "Garantia"],
          ["evidencias", "Evidencias"]
        ];
  return (
    <>
      <div className="modal fade show d-block order-detail-modal" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header border-0">
              <div>
                <p className="eyebrow mb-1">Orden #{idOrden}</p>
                <h2 className="modal-title h5 mb-0">Especificaciones de orden</h2>
                <span className="table-subtext">{orden.numero_serie || "Sin serie"} - {[orden.marca, orden.modelo].filter(Boolean).join(" ")}</span>
              </div>
              <button className="btn-close" type="button" aria-label="Cerrar" onClick={onClose} />
            </div>

            <div className="modal-body">
              {loading ? <p className="text-secondary">Cargando detalle...</p> : null}
              {error ? <p className="alert alert-danger">{error}</p> : null}
              {success ? <p className="alert alert-success">{success}</p> : null}

              {detalle ? <>
                <ul className="nav nav-tabs order-tabs mb-3">
                  {tabs.map(([key, label]) => <li className="nav-item" key={key}><button className={`nav-link ${activeTab === key ? "active" : ""}`} type="button" onClick={() => setActiveTab(key)}>{label}</button></li>)}
                </ul>

                {activeTab === "resumen" ? <div className="detail-grid">
                  <DetailItem label="Estado"><StatusBadge value={detalle.orden.estado} /></DetailItem>
                  <DetailItem label={isRecepcionista ? "Tipo de orden" : "Tipo atencion"}>{detalle.orden.tipo_orden || detalle.orden.tipo_atencion}</DetailItem>
                  <DetailItem label="Tipo de maquina">{detalle.orden.tipo_maquina}</DetailItem>
                  <DetailItem label="Sucursal">{detalle.sucursal?.nombre}</DetailItem>
                  <DetailItem label="Fecha creacion">{formatDate(detalle.orden.fecha_creacion)}</DetailItem>
                  {isRecepcionista ? <>
                    <DetailItem label="Responsable">{detalle.orden.responsable_nombre || detalle.orden.tecnico_nombre || "Sin asignar"}</DetailItem>
                    <DetailItem label="Problema reportado">{detalle.orden.descripcion_problema}</DetailItem>
                    <DetailItem label="Accesorios recibidos">{detalle.orden.accesorios_recibidos}</DetailItem>
                    <DetailItem label="Observaciones de recepcion">{detalle.orden.observaciones_recepcion}</DetailItem>
                  </> : null}
                  <DetailItem label="Valor ingreso">{formatCurrency(detalle.orden.valor_ingreso || detalle.orden.valor_revision)}</DetailItem>
                </div> : null}

                {activeTab === "producto" ? <div className="row g-3">
                  <div className="col-md-6"><div className="detail-card"><h3 className="h6">Cliente</h3><div className="detail-grid single"><DetailItem label="Nombre">{detalle.cliente?.nombre}</DetailItem><DetailItem label="RUT">{detalle.cliente?.rut}</DetailItem><DetailItem label="Email">{detalle.cliente?.email}</DetailItem><DetailItem label="Telefono">{detalle.cliente?.telefono}</DetailItem></div></div></div>
                  <div className="col-md-6"><div className="detail-card"><h3 className="h6">{isRecepcionista ? "Maquina" : "Producto"}</h3><div className="detail-grid single"><DetailItem label="Serie">{detalle.producto.numero_serie}</DetailItem><DetailItem label="Marca">{detalle.producto.marca}</DetailItem><DetailItem label="Modelo">{detalle.producto.modelo}</DetailItem><DetailItem label="Tipo">{detalle.producto.tipo_maquina}</DetailItem>{!isRecepcionista ? <><DetailItem label="Garantia"><StatusBadge value={detalle.producto.estado_garantia} /></DetailItem><DetailItem label="Alerta propiedad">{detalle.producto.alerta_propiedad ? "Si" : "No"}</DetailItem></> : null}</div></div></div>
                </div> : null}

                {!isRecepcionista && activeTab === "diagnostico" ? <div className="detail-card">
                  <h3 className="h6">Diagnostico e informe tecnico</h3>
                  <p><strong>Problema reportado:</strong> {detalle.orden.descripcion_problema || "Sin descripcion"}</p>
                  {canEditDiagnostico ? <form className="row g-3" onSubmit={handleSaveInforme}>
                    <div className="col-md-6"><label className="form-label">Diagnostico</label><textarea className="form-control" value={informeForm.diagnostico} onChange={(event) => setInformeForm((current) => ({ ...current, diagnostico: event.target.value }))} required /></div>
                    <div className="col-md-6"><label className="form-label">Informe / observaciones tecnicas</label><textarea className="form-control" value={informeForm.informe_tecnico} onChange={(event) => setInformeForm((current) => ({ ...current, informe_tecnico: event.target.value }))} /></div>
                    <div className="col-md-3"><label className="form-label">Mano de obra estimada</label><input className="form-control" type="number" min="0" value={informeForm.mano_obra} onChange={(event) => setInformeForm((current) => ({ ...current, mano_obra: event.target.value }))} /></div>
                    <div className="col-12"><button className="btn btn-primary" disabled={saving === "informe"}>{saving === "informe" ? "Guardando..." : "Guardar diagnostico"}</button></div>
                  </form> : <div className="detail-grid">
                    <DetailItem label="Diagnostico">{detalle.orden.diagnostico}</DetailItem>
                    <DetailItem label="Informe tecnico">{detalle.orden.informe_tecnico}</DetailItem>
                    <DetailItem label="Mano de obra estimada">{formatCurrency(detalle.orden.mano_obra)}</DetailItem>
                  </div>}
                  {workflowMode && !canEditDiagnostico && !hasDiagnostico ? <p className="alert alert-info mt-3 mb-0">El diagnostico solo puede registrarse mientras la orden propia esta en revision.</p> : null}
                </div> : null}
                {activeTab === "repuestos" ? <div className="detail-card">
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><h3 className="h6 mb-0">Repuestos del borrador</h3><strong>Total repuestos: {formatCurrency(totalRepuestos)}</strong></div>
                  {detalle.repuestos.length > 0 ? <div className="table-responsive"><table className="table table-sm align-middle serial-table"><thead><tr><th>Repuesto</th><th>Stock</th><th>Cantidad</th><th>Precio aplicado</th><th>Subtotal</th><th>Acciones</th></tr></thead><tbody>{detalle.repuestos.map((repuesto) => <tr key={repuesto.id_repuesto_usado}><td>{repuesto.nombre_repuesto}<span className="table-subtext">{repuesto.codigo_repuesto || "Registro heredado"}</span></td><td>{repuesto.stock_disponible ?? "Sin catalogo"}</td><td>{canEditTrabajo && repuesto.id_repuesto ? <input className="form-control form-control-sm" type="number" min="1" max={repuesto.stock_disponible} value={cantidadesRepuestos[repuesto.id_repuesto_usado] ?? repuesto.cantidad} onChange={(event) => setCantidadesRepuestos((current) => ({ ...current, [repuesto.id_repuesto_usado]: event.target.value }))} /> : repuesto.cantidad}</td><td>{formatCurrency(repuesto.precio_unitario)}</td><td>{formatCurrency(repuesto.subtotal)}</td><td>{canEditTrabajo && repuesto.id_repuesto ? <div className="d-flex flex-wrap gap-2"><button className="btn btn-outline-primary btn-sm" type="button" disabled={saving === `repuesto-${repuesto.id_repuesto_usado}`} onClick={() => handleUpdateRepuesto(repuesto)}>Actualizar</button><button className="btn btn-outline-danger btn-sm" type="button" disabled={saving === `repuesto-${repuesto.id_repuesto_usado}`} onClick={() => handleRemoveRepuesto(repuesto)}>Retirar</button></div> : "Solo lectura"}</td></tr>)}</tbody></table></div> : <p className="empty-state">No hay repuestos registrados.</p>}
                  {canEditTrabajo ? <form className="row g-3 mt-2" onSubmit={handleAddRepuesto}>
                    <div className="col-md-6"><label className="form-label">Repuesto del catalogo</label><select className="form-select" name="id_repuesto" value={repuestoForm.id_repuesto} onChange={handleRepuestoChange} required><option value="">Selecciona un repuesto</option>{catalogoRepuestos.filter((repuesto) => repuesto.estado === "ACTIVO").map((repuesto) => <option key={repuesto.id_repuesto} value={repuesto.id_repuesto}>{repuesto.nombre} - stock {repuesto.stock} - {formatCurrency(repuesto.precio)}</option>)}</select></div>
                    <div className="col-md-2"><label className="form-label">Cantidad</label><input className="form-control" name="cantidad" type="number" min="1" max={repuestoSeleccionado?.stock} value={repuestoForm.cantidad} onChange={handleRepuestoChange} required /></div>
                    <div className="col-md-4"><label className="form-label">Precio y stock</label><div className="form-control bg-body-tertiary">{repuestoSeleccionado ? `${formatCurrency(repuestoSeleccionado.precio)} · ${repuestoSeleccionado.stock} disponibles` : "Selecciona del catalogo"}</div></div>
                    <div className="col-12"><label className="form-label">Observacion</label><input className="form-control" name="observacion" value={repuestoForm.observacion} onChange={handleRepuestoChange} /></div>
                    <div className="col-12"><button className="btn btn-primary" disabled={saving === "repuesto" || !repuestoForm.id_repuesto}>{saving === "repuesto" ? "Guardando..." : "Agregar repuesto"}</button></div>
                  </form> : null}
                  {borradorFinalizado ? <p className="alert alert-info mt-3 mb-0">El borrador tecnico esta finalizado y sus repuestos quedaron en solo lectura.</p> : null}
                </div> : null}
                {activeTab === "borrador" ? <div className="detail-card">
                  <h3 className="h6">Borrador tecnico</h3>
                  <div className="detail-grid mb-3">
                    <DetailItem label="Version actual">{cotizacionActual ? `Version ${cotizacionActual.version}` : "Sin cotizacion"}</DetailItem>
                    <DetailItem label="Subtotal original">{cotizacionActual ? formatCurrency(subtotalCotizacion) : "No aplica"}</DetailItem>
                    <DetailItem label="Descuento">{cotizacionActual?.tipo_descuento === "PORCENTAJE" ? `${cotizacionActual.valor_descuento}%` : cotizacionActual?.tipo_descuento === "MONTO_FIJO" ? formatCurrency(cotizacionActual.valor_descuento) : "Sin descuento"}</DetailItem>
                    <DetailItem label="Total final">{cotizacionActual ? formatCurrency(totalFinalCotizacion) : (totalCliente === null ? "No usa cotizacion normal" : formatCurrency(totalCliente))}</DetailItem>
                    <DetailItem label="Estado"><StatusBadge value={borradorFinalizado ? "FINALIZADO" : (cotizacionActual?.estado || "EN_EDICION")} /></DetailItem>
                    <DetailItem label="PDF"><StatusBadge value={cotizacionActual?.pdf_estado || "NO_GENERADO"} /></DetailItem>
                  </div>
                  {garantiaAprobada ? <p className="alert alert-success">Garantia aprobada: el total del cliente es $0 y no se creara una cotizacion pagada.</p> : null}
                  {isGarantiaOrder && !hasFinalDecision ? <p className="alert alert-warning">Debes registrar la decision de garantia antes de finalizar.</p> : null}
                  {["MANTENCION", "PUESTA_EN_MARCHA"].includes(tipoOrden) ? <p className="alert alert-info">Este tipo conserva el trabajo tecnico, pero no crea una cotizacion normal.</p> : null}
                  {canEditDiscount ? <form className="row g-3 mb-3" onSubmit={handleSaveDiscount}>
                    <div className="col-md-4"><label className="form-label">Tipo de descuento</label><select className="form-select" value={discountForm.tipo_descuento} onChange={(event) => setDiscountForm((current) => ({ ...current, tipo_descuento: event.target.value, valor_descuento: event.target.value ? current.valor_descuento : "0", motivo_descuento: event.target.value ? current.motivo_descuento : "" }))}><option value="">Sin descuento</option><option value="PORCENTAJE">Porcentaje</option><option value="MONTO_FIJO">Monto fijo</option></select></div>
                    <div className="col-md-3"><label className="form-label">Valor</label><input className="form-control" type="number" min="0" max={discountForm.tipo_descuento === "PORCENTAJE" ? "100" : undefined} step="0.01" disabled={!discountForm.tipo_descuento} value={discountForm.valor_descuento} onChange={(event) => setDiscountForm((current) => ({ ...current, valor_descuento: event.target.value }))} /></div>
                    <div className="col-md-5"><label className="form-label">Motivo</label><input className="form-control" disabled={!discountForm.tipo_descuento} required={Boolean(discountForm.tipo_descuento)} value={discountForm.motivo_descuento} onChange={(event) => setDiscountForm((current) => ({ ...current, motivo_descuento: event.target.value }))} /></div>
                    <div className="col-12"><button className="btn btn-outline-primary" disabled={saving === "descuento"}>{saving === "descuento" ? "Guardando..." : "Guardar descuento"}</button></div>
                  </form> : null}
                  {cotizacionActual ? <div className="border rounded-2 p-3 mb-3">
                    <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"><h4 className="h6 mb-0">Documento de cotizacion</h4><StatusBadge value={cotizacionActual.pdf_estado || "NO_GENERADO"} /></div>
                    <div className="small text-secondary mb-3">{cotizacionActual.pdf_nombre_archivo || "Archivo aun no generado"} · Version {cotizacionActual.version} · {cotizacionActual.fecha_pdf ? formatDate(cotizacionActual.fecha_pdf) : "Sin fecha de generacion"}</div>
                    <div className="d-flex flex-wrap gap-2">
                      {canGeneratePdf ? <button className="btn btn-primary" type="button" disabled={saving === "generar-pdf"} onClick={handleGeneratePdf}>{saving === "generar-pdf" ? "Generando..." : "Generar PDF y cerrar cotizacion"}</button> : null}
                      {canAccessPdf ? <><button className="btn btn-outline-primary" type="button" disabled={saving === "ver-pdf"} onClick={() => handlePdf(true)}>Ver PDF</button><button className="btn btn-outline-secondary" type="button" disabled={saving === "descargar-pdf"} onClick={() => handlePdf(false)}>Descargar PDF</button></> : null}
                    </div>
                  </div> : null}
                  {canEditTrabajo ? <form className="row g-3" onSubmit={handleSaveManoObra}><div className="col-md-4"><label className="form-label">Mano de obra estimada</label><input className="form-control" type="number" min="0" value={informeForm.mano_obra} onChange={(event) => setInformeForm((current) => ({ ...current, mano_obra: event.target.value }))} /></div><div className="col-md-8 d-flex align-items-end"><button className="btn btn-outline-primary" disabled={saving === "mano-obra"}>{saving === "mano-obra" ? "Guardando..." : "Guardar mano de obra"}</button></div></form> : null}
                  {canEditTrabajo ? <div className="mt-3"><button className="btn btn-primary" type="button" disabled={!canFinalizarBorrador || saving === "finalizar-borrador"} onClick={handleFinalizarBorrador}>{saving === "finalizar-borrador" ? "Finalizando..." : "Finalizar borrador tecnico"}</button>{!hasDiagnostico ? <span className="text-secondary ms-3">Primero registra el diagnostico.</span> : null}</div> : null}
                  {borradorFinalizado ? <p className="alert alert-info mt-3 mb-0">El trabajo tecnico fue finalizado y quedo preparado para la siguiente etapa.</p> : null}
                </div> : null}
                {!isRecepcionista && activeTab === "garantia" ? <div className="detail-card">
                  <h3 className="h6">Decision final de garantia</h3>
                  <div className="detail-grid mb-3">
                    <DetailItem label="Elegibilidad inicial"><StatusBadge value={detalle.producto?.estado_garantia || "SIN INFORMACION"} /></DetailItem>
                    <DetailItem label="Decision final"><StatusBadge value={detalle.garantia?.estado || (hasFinalDecision ? (detalle.orden.garantia_aprobada_por_admin ? "APROBADA" : "RECHAZADA") : "PENDIENTE")} /></DetailItem>
                    <DetailItem label="Fecha de decision">{formatDate(detalle.garantia?.fecha_revision)}</DetailItem>
                    <DetailItem label="Observacion">{detalle.garantia?.observacion_admin || detalle.orden.observacion_admin}</DetailItem>
                  </div>
                  {!hasDiagnostico ? <p className="alert alert-warning">Guarda el diagnostico antes de decidir la cobertura final.</p> : null}
                  {canDecideGarantia ? <div className="row g-3">
                    <div className="col-12"><label className="form-label">Observacion de la decision</label><textarea className="form-control" value={decisionForm.observacion} onChange={(event) => setDecisionForm({ observacion: event.target.value })} /></div>
                    <div className="col-12 d-flex flex-wrap gap-2">
                      <button className="btn btn-success" type="button" disabled={saving === "decision"} onClick={() => handleDecisionGarantia("APROBADA")}>Aprobar garantia</button>
                      <button className="btn btn-outline-danger" type="button" disabled={saving === "decision"} onClick={() => handleDecisionGarantia("RECHAZADA")}>Rechazar garantia</button>
                    </div>
                  </div> : null}
                  {hasFinalDecision ? <p className="alert alert-info mt-3 mb-0">La decision de garantia es final y no puede modificarse desde este flujo.</p> : null}
                </div> : null}
                {!isRecepcionista && activeTab === "evidencias" ? <div className="detail-card">
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                    <h3 className="h6 mb-0">Evidencias</h3>
                    <span className="table-count">{detalle.evidencias.length} registros</span>
                  </div>

                  {detalle.evidencias.length > 0 ? <div className="table-responsive"><table className="table table-sm align-middle serial-table"><thead><tr><th>Tipo</th><th>Archivo</th><th>Referencia</th><th>Descripcion</th><th>Fecha</th></tr></thead><tbody>{detalle.evidencias.map((evidencia) => {
                    const evidenciaUrl = evidencia.url_archivo || evidencia.referencia_url;
                    return <tr key={evidencia.id_evidencia}><td>{evidencia.tipo}</td><td>{evidencia.nombre_archivo}</td><td>{isHttpUrl(evidenciaUrl) ? <a className="btn btn-outline-primary btn-sm" href={evidenciaUrl} target="_blank" rel="noreferrer">Ver archivo</a> : (evidenciaUrl || "Sin referencia")}</td><td>{evidencia.descripcion || "Sin descripcion"}</td><td className="date-cell">{formatDate(evidencia.fecha_subida || evidencia.fecha_creacion)}</td></tr>;
                  })}</tbody></table></div> : <p className="empty-state">No hay evidencias registradas.</p>}

                  {!isReadOnly ? <div className="row g-3 mt-2">
                    <div className="col-lg-6">
                      <form className="evidence-form border rounded-2 p-3 h-100" onSubmit={handleUploadEvidencia}>
                        <h4 className="h6 mb-3">Subir archivo real</h4>
                        <div className="row g-3">
                          <div className="col-md-4"><label className="form-label">Tipo</label><select className="form-select" value={evidenciaUploadForm.tipo} onChange={(event) => setEvidenciaUploadForm((current) => ({ ...current, tipo: event.target.value }))}><option>IMAGEN</option><option>PDF</option><option>DOCUMENTO</option><option>TEXTO</option></select></div>
                          <div className="col-md-8"><label className="form-label">Archivo</label><input className="form-control" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setEvidenciaUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></div>
                          <div className="col-12"><label className="form-label">Descripcion</label><input className="form-control" value={evidenciaUploadForm.descripcion} onChange={(event) => setEvidenciaUploadForm((current) => ({ ...current, descripcion: event.target.value }))} /></div>
                          <div className="col-12"><button className="btn btn-primary" disabled={saving === "evidencia-upload"}>{saving === "evidencia-upload" ? "Subiendo..." : "Subir evidencia"}</button></div>
                        </div>
                      </form>
                    </div>
                    <div className="col-lg-6">
                      <form className="evidence-form border rounded-2 p-3 h-100" onSubmit={handleAddEvidencia}>
                        <h4 className="h6 mb-3">Registrar referencia manual</h4>
                        <div className="row g-3">
                          <div className="col-md-4"><label className="form-label">Tipo</label><select className="form-select" value={evidenciaForm.tipo} onChange={(event) => setEvidenciaForm((current) => ({ ...current, tipo: event.target.value }))}><option>IMAGEN</option><option>PDF</option><option>LINK</option><option>TEXTO</option><option>DOCUMENTO</option></select></div>
                          <div className="col-md-8"><label className="form-label">Nombre archivo</label><input className="form-control" value={evidenciaForm.nombre_archivo} onChange={(event) => setEvidenciaForm((current) => ({ ...current, nombre_archivo: event.target.value }))} /></div>
                          <div className="col-12"><label className="form-label">URL o referencia</label><input className="form-control" value={evidenciaForm.url_archivo} onChange={(event) => setEvidenciaForm((current) => ({ ...current, url_archivo: event.target.value }))} /></div>
                          <div className="col-12"><label className="form-label">Descripcion</label><input className="form-control" value={evidenciaForm.descripcion} onChange={(event) => setEvidenciaForm((current) => ({ ...current, descripcion: event.target.value }))} /></div>
                          <div className="col-12"><button className="btn btn-outline-primary" disabled={saving === "evidencia"}>{saving === "evidencia" ? "Guardando..." : "Registrar referencia"}</button></div>
                        </div>
                      </form>
                    </div>
                  </div> : null}
                </div> : null}              </> : null}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

export default OrdenDetalleModal;