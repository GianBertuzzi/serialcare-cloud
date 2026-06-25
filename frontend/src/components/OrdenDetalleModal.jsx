import { useEffect, useMemo, useState } from "react";
import StatusBadge from "./StatusBadge.jsx";
import api from "../services/api";

const initialRepuestoForm = {
  nombre_repuesto: "",
  cantidad: "1",
  precio_unitario: "0",
  cubierto_garantia: "false",
  observacion: ""
};

const initialEvidenciaForm = {
  tipo: "IMAGEN",
  nombre_archivo: "",
  url_archivo: "",
  descripcion: ""
};

const initialGarantiaForm = {
  observacion: ""
};

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha invalida";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function DetailItem({ label, children }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{children || "Sin dato"}</strong>
    </div>
  );
}

function OrdenDetalleModal({ orden, readOnly = false, onClose, onUpdated }) {
  const [activeTab, setActiveTab] = useState("resumen");
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [repuestoForm, setRepuestoForm] = useState(initialRepuestoForm);
  const [cotizacionForm, setCotizacionForm] = useState({ mano_obra: "0", estado: "BORRADOR", observacion: "" });
  const [evidenciaForm, setEvidenciaForm] = useState(initialEvidenciaForm);
  const [garantiaForm, setGarantiaForm] = useState(initialGarantiaForm);
  const [saving, setSaving] = useState("");

  const idOrden = orden?.id_orden;

  async function loadDetalle() {
    if (!idOrden) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/ordenes/${idOrden}/detalle`);
      const nextDetalle = response.data.detalle || null;
      setDetalle(nextDetalle);
      setCotizacionForm({
        mano_obra: String(nextDetalle?.cotizacion?.mano_obra ?? 0),
        estado: nextDetalle?.cotizacion?.estado || "BORRADOR",
        observacion: nextDetalle?.cotizacion?.observacion || ""
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo cargar el detalle de la orden."
      );
    } finally {
      setLoading(false);
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
  }, [idOrden]);

  const totalRepuestos = useMemo(() => {
    return (detalle?.repuestos || []).reduce(
      (total, repuesto) =>
        total + Number(repuesto.cantidad || 0) * Number(repuesto.precio_unitario || 0),
      0
    );
  }, [detalle]);

  const activeGarantia = detalle?.garantia && ["PENDIENTE", "EN_REVISION"].includes(detalle.garantia.estado);
  const canRequestGarantia = !readOnly && !activeGarantia;

  function handleRepuestoChange(event) {
    const { name, value } = event.target;
    setRepuestoForm((current) => ({ ...current, [name]: value }));
  }

  function handleCotizacionChange(event) {
    const { name, value } = event.target;
    setCotizacionForm((current) => ({ ...current, [name]: value }));
  }

  function handleEvidenciaChange(event) {
    const { name, value } = event.target;
    setEvidenciaForm((current) => ({ ...current, [name]: value }));
  }

  function handleGarantiaChange(event) {
    const { name, value } = event.target;
    setGarantiaForm((current) => ({ ...current, [name]: value }));
  }

  async function afterMutation(message) {
    setSuccess(message);
    await loadDetalle();
    onUpdated?.(message);
  }

  async function handleAddRepuesto(event) {
    event.preventDefault();
    setSaving("repuesto");
    setError("");
    setSuccess("");

    try {
      await api.post(`/ordenes/${idOrden}/repuestos`, {
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
        url_archivo: evidenciaForm.url_archivo.trim(),
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
      await api.post(`/ordenes/${idOrden}/solicitar-garantia`, {
        motivo_solicitud: garantiaForm.observacion.trim()
      });
      setGarantiaForm(initialGarantiaForm);
      await afterMutation("Solicitud de garantia creada correctamente.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo solicitar garantia.");
    } finally {
      setSaving("");
    }
  }

  if (!orden) {
    return null;
  }

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
                <span className="table-subtext">
                  {orden.numero_serie || "Sin serie"} - {[orden.marca, orden.modelo].filter(Boolean).join(" ")}
                </span>
              </div>
              <button className="btn-close" type="button" aria-label="Cerrar" onClick={onClose} />
            </div>

            <div className="modal-body">
              {loading ? <p className="text-secondary">Cargando detalle...</p> : null}
              {error ? <p className="alert alert-danger">{error}</p> : null}
              {success ? <p className="alert alert-success">{success}</p> : null}

              {detalle ? (
                <>
                  <ul className="nav nav-tabs order-tabs mb-3">
                    {tabs.map(([key, label]) => (
                      <li className="nav-item" key={key}>
                        <button
                          className={`nav-link ${activeTab === key ? "active" : ""}`}
                          type="button"
                          onClick={() => setActiveTab(key)}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {activeTab === "resumen" ? (
                    <div className="detail-grid">
                      <DetailItem label="Estado"><StatusBadge value={detalle.orden.estado} /></DetailItem>
                      <DetailItem label="Tipo">{detalle.orden.tipo_orden}</DetailItem>
                      <DetailItem label="Sucursal">{detalle.sucursal?.nombre}</DetailItem>
                      <DetailItem label="Fecha creacion">{formatDate(detalle.orden.fecha_creacion)}</DetailItem>
                      <DetailItem label="Valor revision">{formatCurrency(detalle.orden.valor_revision)}</DetailItem>
                      <DetailItem label="Costo ingreso">{formatCurrency(detalle.orden.costo_ingreso_taller)}</DetailItem>
                    </div>
                  ) : null}

                  {activeTab === "producto" ? (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="detail-card">
                          <h3 className="h6">Producto</h3>
                          <div className="detail-grid single">
                            <DetailItem label="Numero de serie">{detalle.producto.numero_serie}</DetailItem>
                            <DetailItem label="Marca">{detalle.producto.marca}</DetailItem>
                            <DetailItem label="Modelo">{detalle.producto.modelo}</DetailItem>
                            <DetailItem label="Estado garantia"><StatusBadge value={detalle.producto.estado_garantia} /></DetailItem>
                            <DetailItem label="Alerta propiedad">{detalle.producto.alerta_propiedad ? "Si" : "No"}</DetailItem>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="detail-card">
                          <h3 className="h6">Cliente / Modelo</h3>
                          <div className="detail-grid single">
                            <DetailItem label="Cliente">{detalle.cliente?.nombre || "Sin cliente"}</DetailItem>
                            <DetailItem label="Email cliente">{detalle.cliente?.email || "Sin email"}</DetailItem>
                            <DetailItem label="Codigo modelo">{detalle.modelo?.codigo_comercial || "Sin codigo"}</DetailItem>
                            <DetailItem label="Descripcion modelo">{detalle.modelo?.descripcion || "Sin descripcion"}</DetailItem>
                            <DetailItem label="Familia">{detalle.modelo?.familia || "Sin familia"}</DetailItem>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "diagnostico" ? (
                    <div className="detail-card">
                      <h3 className="h6">Diagnostico tecnico</h3>
                      <p className="mb-0">{detalle.orden.diagnostico || "Sin diagnostico registrado."}</p>
                    </div>
                  ) : null}

                  {activeTab === "repuestos" ? (
                    <div className="detail-card">
                      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                        <h3 className="h6 mb-0">Repuestos usados</h3>
                        <strong>Total repuestos: {formatCurrency(totalRepuestos)}</strong>
                      </div>
                      {detalle.repuestos.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle serial-table">
                            <thead>
                              <tr>
                                <th>Repuesto</th>
                                <th>Cantidad</th>
                                <th>Precio unitario</th>
                                <th>Total</th>
                                <th>Cubre garantia</th>
                                <th>Observacion</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalle.repuestos.map((repuesto) => (
                                <tr key={repuesto.id_repuesto_usado}>
                                  <td>{repuesto.nombre_repuesto}</td>
                                  <td>{repuesto.cantidad}</td>
                                  <td>{formatCurrency(repuesto.precio_unitario)}</td>
                                  <td>{formatCurrency(Number(repuesto.cantidad || 0) * Number(repuesto.precio_unitario || 0))}</td>
                                  <td>{repuesto.cubierto_garantia ? "Si" : "No"}</td>
                                  <td>{repuesto.observacion || "Sin observacion"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="empty-state">No hay repuestos registrados.</p>
                      )}

                      {!readOnly ? (
                        <form className="row g-3 mt-2" onSubmit={handleAddRepuesto}>
                          <div className="col-md-4">
                            <label className="form-label">Nombre repuesto</label>
                            <input className="form-control" name="nombre_repuesto" value={repuestoForm.nombre_repuesto} onChange={handleRepuestoChange} required />
                          </div>
                          <div className="col-md-2">
                            <label className="form-label">Cantidad</label>
                            <input className="form-control" name="cantidad" type="number" min="1" value={repuestoForm.cantidad} onChange={handleRepuestoChange} required />
                          </div>
                          <div className="col-md-2">
                            <label className="form-label">Precio unitario</label>
                            <input className="form-control" name="precio_unitario" type="number" min="0" value={repuestoForm.precio_unitario} onChange={handleRepuestoChange} />
                          </div>
                          <div className="col-md-2">
                            <label className="form-label">Cubierto</label>
                            <select className="form-select" name="cubierto_garantia" value={repuestoForm.cubierto_garantia} onChange={handleRepuestoChange}>
                              <option value="false">No</option>
                              <option value="true">Si</option>
                            </select>
                          </div>
                          <div className="col-md-12">
                            <label className="form-label">Observacion</label>
                            <input className="form-control" name="observacion" value={repuestoForm.observacion} onChange={handleRepuestoChange} />
                          </div>
                          <div className="col-12">
                            <button className="btn btn-primary" type="submit" disabled={saving === "repuesto"}>
                              {saving === "repuesto" ? "Guardando..." : "Agregar repuesto"}
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTab === "cotizacion" ? (
                    <div className="detail-card">
                      <div className="detail-grid mb-3">
                        <DetailItem label="Total repuestos">{formatCurrency(detalle.cotizacion?.total_repuestos ?? totalRepuestos)}</DetailItem>
                        <DetailItem label="Mano de obra">{formatCurrency(detalle.cotizacion?.mano_obra ?? 0)}</DetailItem>
                        <DetailItem label="Total general">{formatCurrency(detalle.cotizacion?.total ?? totalRepuestos)}</DetailItem>
                        <DetailItem label="Estado"><StatusBadge value={detalle.cotizacion?.estado || "BORRADOR"} /></DetailItem>
                      </div>
                      {detalle.cotizacion?.observacion ? <p>{detalle.cotizacion.observacion}</p> : null}

                      {!readOnly ? (
                        <form className="row g-3" onSubmit={handleSaveCotizacion}>
                          <div className="col-md-3">
                            <label className="form-label">Mano de obra</label>
                            <input className="form-control" name="mano_obra" type="number" min="0" value={cotizacionForm.mano_obra} onChange={handleCotizacionChange} />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Estado</label>
                            <select className="form-select" name="estado" value={cotizacionForm.estado} onChange={handleCotizacionChange}>
                              <option value="BORRADOR">BORRADOR</option>
                              <option value="ENVIADA">ENVIADA</option>
                              <option value="APROBADA">APROBADA</option>
                              <option value="RECHAZADA">RECHAZADA</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Observacion</label>
                            <input className="form-control" name="observacion" value={cotizacionForm.observacion} onChange={handleCotizacionChange} />
                          </div>
                          <div className="col-12">
                            <button className="btn btn-primary" type="submit" disabled={saving === "cotizacion"}>
                              {saving === "cotizacion" ? "Guardando..." : "Guardar cotizacion"}
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTab === "garantia" ? (
                    <div className="detail-card">
                      {detalle.garantia ? (
                        <div className="detail-grid mb-3">
                          <DetailItem label="Estado"><StatusBadge value={detalle.garantia.estado} /></DetailItem>
                          <DetailItem label="Solicitud">{formatDate(detalle.garantia.fecha_solicitud)}</DetailItem>
                          <DetailItem label="Revision marca">{formatDate(detalle.garantia.fecha_revision)}</DetailItem>
                          <DetailItem label="Observacion sucursal">{detalle.garantia.observacion}</DetailItem>
                          <DetailItem label="Respuesta marca">{detalle.garantia.observacion_marca || "Sin respuesta"}</DetailItem>
                        </div>
                      ) : (
                        <p className="empty-state">No hay solicitud de garantia para esta orden.</p>
                      )}

                      {canRequestGarantia ? (
                        <form onSubmit={handleSolicitarGarantia}>
                          <label className="form-label">Motivo u observacion</label>
                          <textarea className="form-control" name="observacion" value={garantiaForm.observacion} onChange={handleGarantiaChange} required />
                          <button className="btn btn-primary mt-3" type="submit" disabled={saving === "garantia"}>
                            {saving === "garantia" ? "Solicitando..." : "Solicitar garantia"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTab === "evidencias" ? (
                    <div className="detail-card">
                      {detalle.evidencias.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle serial-table">
                            <thead>
                              <tr>
                                <th>Tipo</th>
                                <th>Archivo</th>
                                <th>Referencia</th>
                                <th>Descripcion</th>
                                <th>Fecha</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalle.evidencias.map((evidencia) => (
                                <tr key={evidencia.id_evidencia}>
                                  <td>{evidencia.tipo}</td>
                                  <td>{evidencia.nombre_archivo}</td>
                                  <td>{evidencia.url_archivo || "Sin referencia"}</td>
                                  <td>{evidencia.descripcion || "Sin descripcion"}</td>
                                  <td>{formatDate(evidencia.fecha_subida)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="empty-state">No hay evidencias registradas.</p>
                      )}

                      {!readOnly ? (
                        <form className="row g-3 mt-2" onSubmit={handleAddEvidencia}>
                          <div className="col-md-3">
                            <label className="form-label">Tipo</label>
                            <select className="form-select" name="tipo" value={evidenciaForm.tipo} onChange={handleEvidenciaChange}>
                              <option value="IMAGEN">IMAGEN</option>
                              <option value="PDF">PDF</option>
                              <option value="DOCUMENTO">DOCUMENTO</option>
                            </select>
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Nombre archivo</label>
                            <input className="form-control" name="nombre_archivo" value={evidenciaForm.nombre_archivo} onChange={handleEvidenciaChange} required />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">URL o referencia</label>
                            <input className="form-control" name="url_archivo" value={evidenciaForm.url_archivo} onChange={handleEvidenciaChange} />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Descripcion</label>
                            <input className="form-control" name="descripcion" value={evidenciaForm.descripcion} onChange={handleEvidenciaChange} />
                          </div>
                          <div className="col-12">
                            <button className="btn btn-primary" type="submit" disabled={saving === "evidencia"}>
                              {saving === "evidencia" ? "Guardando..." : "Agregar evidencia"}
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

export default OrdenDetalleModal;