import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "./StatusBadge.jsx";
import api from "../services/api";
import { formatCurrency, formatDate } from "../utils/format.js";

const initialRepuestoForm = { id_repuesto: "", nombre_repuesto: "", cantidad: "1", precio_unitario: "0", cubierto_garantia: "false", observacion: "" };
const initialEvidenciaForm = { tipo: "IMAGEN", nombre_archivo: "", url_archivo: "", descripcion: "" };
const initialGarantiaForm = { observacion: "" };
const initialDecisionForm = { garantia_aprobada_por_admin: "true", observacion_admin: "" };

function DetailItem({ label, children }) {
  return <div className="detail-box"><span>{label}</span><strong>{children || "Sin dato"}</strong></div>;
}

function OrdenDetalleModal({ orden, readOnly = false, onClose, onUpdated }) {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [activeTab, setActiveTab] = useState("resumen");
  const [detalle, setDetalle] = useState(null);
  const [catalogoRepuestos, setCatalogoRepuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState("");
  const [repuestoForm, setRepuestoForm] = useState(initialRepuestoForm);
  const [informeForm, setInformeForm] = useState({ diagnostico: "", informe_tecnico: "", mano_obra: "0" });
  const [cotizacionForm, setCotizacionForm] = useState({ mano_obra: "0", estado: "BORRADOR", observacion: "" });
  const [evidenciaForm, setEvidenciaForm] = useState(initialEvidenciaForm);
  const [garantiaForm, setGarantiaForm] = useState(initialGarantiaForm);
  const [decisionForm, setDecisionForm] = useState(initialDecisionForm);

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
      setCotizacionForm({
        mano_obra: String(nextDetalle?.cotizacion?.mano_obra ?? nextDetalle?.orden?.mano_obra ?? 0),
        estado: nextDetalle?.cotizacion?.estado || "BORRADOR",
        observacion: nextDetalle?.cotizacion?.observacion || ""
      });
      setDecisionForm({
        garantia_aprobada_por_admin: nextDetalle?.orden?.garantia_aprobada_por_admin === false ? "false" : "true",
        observacion_admin: nextDetalle?.orden?.observacion_admin || nextDetalle?.garantia?.observacion_admin || ""
      });
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo cargar el detalle de la orden.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogoRepuestos() {
    if (readOnly) return;
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
    setGarantiaForm(initialGarantiaForm);
    loadDetalle();
    loadCatalogoRepuestos();
  }, [idOrden]);

  const totalRepuestos = useMemo(() => (detalle?.repuestos || []).reduce((total, repuesto) => total + Number(repuesto.subtotal ?? Number(repuesto.cantidad || 0) * Number(repuesto.precio_unitario || 0)), 0), [detalle]);
  const activeGarantia = detalle?.garantia && ["PENDIENTE", "EN_REVISION"].includes(detalle.garantia.estado);
  const canRequestGarantia = !readOnly && !activeGarantia;

  async function afterMutation(message) {
    setSuccess(message);
    await loadDetalle();
    onUpdated?.(message);
  }

  function handleRepuestoChange(event) {
    const { name, value } = event.target;
    if (name === "id_repuesto") {
      const selected = catalogoRepuestos.find((repuesto) => String(repuesto.id_repuesto) === String(value));
      setRepuestoForm((current) => ({ ...current, id_repuesto: value, nombre_repuesto: selected?.nombre || "", precio_unitario: String(selected?.precio ?? current.precio_unitario) }));
      return;
    }
    setRepuestoForm((current) => ({ ...current, [name]: value }));
  }

  async function handleAddRepuesto(event) {
    event.preventDefault();
    setSaving("repuesto");
    setError("");
    setSuccess("");
    try {
      await api.post(`/ordenes/${idOrden}/repuestos`, {
        id_repuesto: repuestoForm.id_repuesto ? Number(repuestoForm.id_repuesto) : null,
        nombre_repuesto: repuestoForm.nombre_repuesto.trim(),
        cantidad: Number(repuestoForm.cantidad || 1),
        precio_unitario: Number(repuestoForm.precio_unitario || 0),
        cubierto_garantia: repuestoForm.cubierto_garantia === "true",
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

  async function handleSaveInforme(event) {
    event.preventDefault();
    setSaving("informe");
    setError("");
    setSuccess("");
    try {
      await api.put(`/ordenes/${idOrden}/informe-tecnico`, {
        diagnostico: informeForm.diagnostico.trim(),
        informe_tecnico: informeForm.informe_tecnico.trim(),
        mano_obra: Number(informeForm.mano_obra || 0)
      });
      await afterMutation("Informe tecnico guardado correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo guardar el informe tecnico.");
    } finally {
      setSaving("");
    }
  }

  async function handleSaveCotizacion(event) {
    event.preventDefault();
    setSaving("cotizacion");
    setError("");
    setSuccess("");
    try {
      await api.post(`/ordenes/${idOrden}/cotizacion`, {
        mano_obra: Number(cotizacionForm.mano_obra || 0),
        estado: cotizacionForm.estado,
        observacion: cotizacionForm.observacion.trim()
      });
      await afterMutation("Cotizacion guardada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo guardar la cotizacion.");
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
      await api.post(`/ordenes/${idOrden}/evidencias`, {
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

  async function handleSolicitarGarantia(event) {
    event.preventDefault();
    setSaving("garantia");
    setError("");
    setSuccess("");
    try {
      await api.post(`/ordenes/${idOrden}/solicitar-garantia`, { motivo_solicitud: garantiaForm.observacion.trim() });
      setGarantiaForm(initialGarantiaForm);
      await afterMutation("Solicitud de garantia creada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo solicitar garantia.");
    } finally {
      setSaving("");
    }
  }

  async function handleDecisionGarantia(event) {
    event.preventDefault();
    setSaving("decision");
    setError("");
    setSuccess("");
    try {
      await api.put(`/ordenes/${idOrden}/decision-garantia`, {
        garantia_aprobada_por_admin: decisionForm.garantia_aprobada_por_admin === "true",
        observacion_admin: decisionForm.observacion_admin.trim()
      });
      await afterMutation("Decision de garantia guardada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo guardar la decision de garantia.");
    } finally {
      setSaving("");
    }
  }

  if (!orden) return null;

  const tabs = [
    ["resumen", "Resumen"],
    ["producto", "Cliente / Producto"],
    ["diagnostico", "Diagnostico"],
    ["repuestos", "Repuestos usados"],
    ["cotizacion", "Cotizacion"],
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
                  <DetailItem label="Tipo atencion">{detalle.orden.tipo_atencion || detalle.orden.tipo_orden}</DetailItem>
                  <DetailItem label="Tipo de maquina">{detalle.orden.tipo_maquina}</DetailItem>
                  <DetailItem label="Sucursal">{detalle.sucursal?.nombre}</DetailItem>
                  <DetailItem label="Fecha creacion">{formatDate(detalle.orden.fecha_creacion)}</DetailItem>
                  <DetailItem label="Valor ingreso">{formatCurrency(detalle.orden.valor_ingreso || detalle.orden.valor_revision)}</DetailItem>
                </div> : null}

                {activeTab === "producto" ? <div className="row g-3">
                  <div className="col-md-6"><div className="detail-card"><h3 className="h6">Cliente</h3><div className="detail-grid single"><DetailItem label="Nombre">{detalle.cliente?.nombre}</DetailItem><DetailItem label="RUT">{detalle.cliente?.rut}</DetailItem><DetailItem label="Email">{detalle.cliente?.email}</DetailItem><DetailItem label="Telefono">{detalle.cliente?.telefono}</DetailItem></div></div></div>
                  <div className="col-md-6"><div className="detail-card"><h3 className="h6">Producto</h3><div className="detail-grid single"><DetailItem label="Serie">{detalle.producto.numero_serie}</DetailItem><DetailItem label="Marca">{detalle.producto.marca}</DetailItem><DetailItem label="Modelo">{detalle.producto.modelo}</DetailItem><DetailItem label="Tipo">{detalle.producto.tipo_maquina}</DetailItem><DetailItem label="Garantia"><StatusBadge value={detalle.producto.estado_garantia} /></DetailItem><DetailItem label="Alerta propiedad">{detalle.producto.alerta_propiedad ? "Si" : "No"}</DetailItem></div></div></div>
                </div> : null}

                {activeTab === "diagnostico" ? <div className="detail-card">
                  <h3 className="h6">Diagnostico e informe tecnico</h3>
                  <p><strong>Problema reportado:</strong> {detalle.orden.descripcion_problema || "Sin descripcion"}</p>
                  {!readOnly ? <form className="row g-3" onSubmit={handleSaveInforme}>
                    <div className="col-md-6"><label className="form-label">Diagnostico</label><textarea className="form-control" value={informeForm.diagnostico} onChange={(event) => setInformeForm((current) => ({ ...current, diagnostico: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Informe tecnico / reparacion</label><textarea className="form-control" value={informeForm.informe_tecnico} onChange={(event) => setInformeForm((current) => ({ ...current, informe_tecnico: event.target.value }))} /></div>
                    <div className="col-md-3"><label className="form-label">Mano de obra</label><input className="form-control" type="number" min="0" value={informeForm.mano_obra} onChange={(event) => setInformeForm((current) => ({ ...current, mano_obra: event.target.value }))} /></div>
                    <div className="col-12"><button className="btn btn-primary" disabled={saving === "informe"}>{saving === "informe" ? "Guardando..." : "Guardar informe"}</button></div>
                  </form> : <p>{detalle.orden.informe_tecnico || detalle.orden.diagnostico || "Sin informe registrado."}</p>}
                </div> : null}

                {activeTab === "repuestos" ? <div className="detail-card">
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><h3 className="h6 mb-0">Repuestos usados</h3><strong>Total repuestos: {formatCurrency(totalRepuestos)}</strong></div>
                  {detalle.repuestos.length > 0 ? <div className="table-responsive"><table className="table table-sm align-middle serial-table"><thead><tr><th>Repuesto</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th><th>Cubre garantia</th><th>Observacion</th></tr></thead><tbody>{detalle.repuestos.map((repuesto) => <tr key={repuesto.id_repuesto_usado}><td>{repuesto.nombre_repuesto}</td><td>{repuesto.cantidad}</td><td>{formatCurrency(repuesto.precio_unitario)}</td><td>{formatCurrency(repuesto.subtotal)}</td><td>{repuesto.cubierto_garantia ? "Si" : "No"}</td><td>{repuesto.observacion || "Sin observacion"}</td></tr>)}</tbody></table></div> : <p className="empty-state">No hay repuestos registrados.</p>}
                  {!readOnly ? <form className="row g-3 mt-2" onSubmit={handleAddRepuesto}>
                    <div className="col-md-4"><label className="form-label">Repuesto catalogo</label><select className="form-select" name="id_repuesto" value={repuestoForm.id_repuesto} onChange={handleRepuestoChange}><option value="">Manual / sin catalogo</option>{catalogoRepuestos.map((repuesto) => <option key={repuesto.id_repuesto} value={repuesto.id_repuesto}>{repuesto.nombre} - {formatCurrency(repuesto.precio)}</option>)}</select></div>
                    <div className="col-md-3"><label className="form-label">Nombre repuesto</label><input className="form-control" name="nombre_repuesto" value={repuestoForm.nombre_repuesto} onChange={handleRepuestoChange} required /></div>
                    <div className="col-md-2"><label className="form-label">Cantidad</label><input className="form-control" name="cantidad" type="number" min="1" value={repuestoForm.cantidad} onChange={handleRepuestoChange} required /></div>
                    <div className="col-md-3"><label className="form-label">Precio unitario</label><input className="form-control" name="precio_unitario" type="number" min="0" value={repuestoForm.precio_unitario} onChange={handleRepuestoChange} disabled={Boolean(repuestoForm.id_repuesto) && !isAdmin} /></div>
                    <div className="col-md-3"><label className="form-label">Cubierto garantia</label><select className="form-select" name="cubierto_garantia" value={repuestoForm.cubierto_garantia} onChange={handleRepuestoChange}><option value="false">No</option><option value="true">Si</option></select></div>
                    <div className="col-md-9"><label className="form-label">Observacion</label><input className="form-control" name="observacion" value={repuestoForm.observacion} onChange={handleRepuestoChange} /></div>
                    <div className="col-12"><button className="btn btn-primary" disabled={saving === "repuesto"}>{saving === "repuesto" ? "Guardando..." : "Agregar repuesto"}</button></div>
                  </form> : null}
                </div> : null}

                {activeTab === "cotizacion" ? <div className="detail-card">
                  <div className="detail-grid mb-3"><DetailItem label="Valor ingreso">{formatCurrency(detalle.cotizacion?.valor_ingreso ?? detalle.orden.valor_ingreso)}</DetailItem><DetailItem label="Total repuestos">{formatCurrency(detalle.cotizacion?.total_repuestos ?? totalRepuestos)}</DetailItem><DetailItem label="Mano de obra">{formatCurrency(detalle.cotizacion?.mano_obra ?? detalle.orden.mano_obra)}</DetailItem><DetailItem label="Total general">{formatCurrency(detalle.cotizacion?.total_general ?? detalle.cotizacion?.total ?? totalRepuestos)}</DetailItem><DetailItem label="Estado"><StatusBadge value={detalle.cotizacion?.estado || "BORRADOR"} /></DetailItem></div>
                  {!readOnly ? <form className="row g-3" onSubmit={handleSaveCotizacion}><div className="col-md-3"><label className="form-label">Mano de obra</label><input className="form-control" type="number" min="0" value={cotizacionForm.mano_obra} onChange={(event) => setCotizacionForm((current) => ({ ...current, mano_obra: event.target.value }))} /></div><div className="col-md-3"><label className="form-label">Estado</label><select className="form-select" value={cotizacionForm.estado} onChange={(event) => setCotizacionForm((current) => ({ ...current, estado: event.target.value }))}><option>BORRADOR</option><option>ENVIADA</option><option>APROBADA</option><option>RECHAZADA</option></select></div><div className="col-md-6"><label className="form-label">Observacion</label><input className="form-control" value={cotizacionForm.observacion} onChange={(event) => setCotizacionForm((current) => ({ ...current, observacion: event.target.value }))} /></div><div className="col-12"><button className="btn btn-primary" disabled={saving === "cotizacion"}>{saving === "cotizacion" ? "Guardando..." : "Guardar cotizacion"}</button></div></form> : null}
                </div> : null}

                {activeTab === "garantia" ? <div className="detail-card">
                  {detalle.garantia ? <div className="detail-grid mb-3"><DetailItem label="Estado"><StatusBadge value={detalle.garantia.estado} /></DetailItem><DetailItem label="Solicitud">{formatDate(detalle.garantia.fecha_solicitud)}</DetailItem><DetailItem label="Revision admin">{formatDate(detalle.garantia.fecha_revision)}</DetailItem><DetailItem label="Observacion tecnica">{detalle.garantia.observacion}</DetailItem><DetailItem label="Decision admin">{detalle.garantia.observacion_admin || detalle.orden.observacion_admin || "Sin decision"}</DetailItem></div> : <p className="empty-state">No hay solicitud de garantia para esta orden.</p>}
                  {!readOnly && isAdmin ? <form className="row g-3" onSubmit={handleDecisionGarantia}><div className="col-md-4"><label className="form-label">Decision final</label><select className="form-select" value={decisionForm.garantia_aprobada_por_admin} onChange={(event) => setDecisionForm((current) => ({ ...current, garantia_aprobada_por_admin: event.target.value }))}><option value="true">Aceptar como garantia</option><option value="false">Marcar como reparacion comun</option></select></div><div className="col-md-8"><label className="form-label">Observacion admin</label><input className="form-control" value={decisionForm.observacion_admin} onChange={(event) => setDecisionForm((current) => ({ ...current, observacion_admin: event.target.value }))} /></div><div className="col-12"><button className="btn btn-primary" disabled={saving === "decision"}>{saving === "decision" ? "Guardando..." : "Guardar decision"}</button></div></form> : null}
                  {canRequestGarantia && !isAdmin ? <form className="mt-3" onSubmit={handleSolicitarGarantia}><label className="form-label">Motivo u observacion</label><textarea className="form-control" value={garantiaForm.observacion} onChange={(event) => setGarantiaForm({ observacion: event.target.value })} required /><button className="btn btn-primary mt-3" disabled={saving === "garantia"}>{saving === "garantia" ? "Solicitando..." : "Solicitar garantia"}</button></form> : null}
                </div> : null}

                {activeTab === "evidencias" ? <div className="detail-card">
                  {detalle.evidencias.length > 0 ? <div className="table-responsive"><table className="table table-sm align-middle serial-table"><thead><tr><th>Tipo</th><th>Archivo</th><th>Referencia</th><th>Descripcion</th><th>Fecha</th></tr></thead><tbody>{detalle.evidencias.map((evidencia) => <tr key={evidencia.id_evidencia}><td>{evidencia.tipo}</td><td>{evidencia.nombre_archivo}</td><td>{evidencia.url_archivo || evidencia.referencia_url || "Sin referencia"}</td><td>{evidencia.descripcion || "Sin descripcion"}</td><td className="date-cell">{formatDate(evidencia.fecha_subida || evidencia.fecha_creacion)}</td></tr>)}</tbody></table></div> : <p className="empty-state">No hay evidencias registradas.</p>}
                  {!readOnly ? <form className="row g-3 mt-2" onSubmit={handleAddEvidencia}><div className="col-md-3"><label className="form-label">Tipo</label><select className="form-select" value={evidenciaForm.tipo} onChange={(event) => setEvidenciaForm((current) => ({ ...current, tipo: event.target.value }))}><option>IMAGEN</option><option>PDF</option><option>LINK</option><option>TEXTO</option></select></div><div className="col-md-3"><label className="form-label">Nombre archivo</label><input className="form-control" value={evidenciaForm.nombre_archivo} onChange={(event) => setEvidenciaForm((current) => ({ ...current, nombre_archivo: event.target.value }))} /></div><div className="col-md-3"><label className="form-label">URL o referencia</label><input className="form-control" value={evidenciaForm.url_archivo} onChange={(event) => setEvidenciaForm((current) => ({ ...current, url_archivo: event.target.value }))} /></div><div className="col-md-3"><label className="form-label">Descripcion</label><input className="form-control" value={evidenciaForm.descripcion} onChange={(event) => setEvidenciaForm((current) => ({ ...current, descripcion: event.target.value }))} /></div><div className="col-12"><button className="btn btn-primary" disabled={saving === "evidencia"}>{saving === "evidencia" ? "Guardando..." : "Agregar evidencia"}</button></div></form> : null}
                </div> : null}
              </> : null}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

export default OrdenDetalleModal;