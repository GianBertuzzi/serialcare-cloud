import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatDate } from "../../utils/format.js";

const initialForm = { nombre: "", ciudad: "", region: "", direccion: "", admin_nombre: "", admin_email: "", admin_password: "Admin123" };

function MarcaSucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadSucursales() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/sucursales");
      setSucursales(response.data.sucursales || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar las sucursales.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSucursales(); }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    if (!form.nombre.trim()) return "Nombre sucursal es obligatorio.";
    if (!form.ciudad.trim()) return "Ciudad es obligatoria.";
    if (!form.region.trim()) return "Region es obligatoria.";
    if (!form.admin_nombre.trim()) return "Nombre admin es obligatorio.";
    if (!form.admin_email.trim()) return "Correo admin es obligatorio.";
    if (!form.admin_password || form.admin_password.length < 6) return "Password temporal debe tener minimo 6 caracteres.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/sucursales", form);
      setForm(initialForm);
      setFormOpen(false);
      setSuccess("Sucursal y cuenta admin creadas correctamente.");
      await loadSucursales();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo crear la sucursal.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSucursal(sucursal) {
    const nextAction = sucursal.estado === "ACTIVA" ? "desactivar" : "activar";
    setActionId(sucursal.id_sucursal);
    setError("");
    setSuccess("");
    try {
      await api.put(`/sucursales/${sucursal.id_sucursal}/${nextAction}`);
      setSuccess(`Sucursal ${nextAction === "activar" ? "activada" : "desactivada"} correctamente.`);
      await loadSucursales();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo actualizar la sucursal.");
    } finally {
      setActionId(null);
    }
  }

  const columns = [
    { key: "nombre", label: "Nombre", searchValue: (s) => s.nombre, render: (s) => <strong>{s.nombre}</strong> },
    { key: "ciudad", label: "Ciudad", searchValue: (s) => s.ciudad || "" },
    { key: "region", label: "Region", searchValue: (s) => s.region || "" },
    { key: "direccion", label: "Direccion", searchValue: (s) => s.direccion || "", render: (s) => s.direccion || "Sin direccion" },
    { key: "admin", label: "Admin inicial", searchValue: (s) => `${s.admin_nombre || ""} ${s.admin_email || ""}`, render: (s) => <>{s.admin_nombre || "Sin admin"}<span className="table-subtext">{s.admin_email || "Sin email"}</span></> },
    { key: "estado", label: "Estado", searchValue: (s) => s.estado, render: (s) => <StatusBadge value={s.estado} /> },
    { key: "fecha", label: "Fecha", searchValue: (s) => formatDate(s.fecha_creacion), sortValue: (s) => s.fecha_creacion, render: (s) => formatDate(s.fecha_creacion) },
    { key: "acciones", label: "Acciones", searchable: false, sortable: false, render: (s) => <button className={s.estado === "ACTIVA" ? "btn btn-outline-danger btn-sm" : "btn btn-outline-success btn-sm"} disabled={actionId === s.id_sucursal} onClick={() => toggleSucursal(s)}>{s.estado === "ACTIVA" ? "Desactivar" : "Activar"}</button> }
  ];

  return (
    <AppLayout title="Sucursales autorizadas" eyebrow="MARCA">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {formOpen ? <section className="card surface-card border-0 shadow-sm mb-3"><div className="card-body"><form className="row g-3" onSubmit={handleSubmit}>
        <div className="col-12"><p className="form-section-heading">Datos de sucursal</p></div>
        <div className="col-md-3"><label className="form-label">Nombre sucursal</label><input className="form-control" name="nombre" value={form.nombre} onChange={handleChange} required /></div>
        <div className="col-md-3"><label className="form-label">Ciudad</label><input className="form-control" name="ciudad" value={form.ciudad} onChange={handleChange} required /></div>
        <div className="col-md-3"><label className="form-label">Region</label><input className="form-control" name="region" value={form.region} onChange={handleChange} required /></div>
        <div className="col-md-3"><label className="form-label">Direccion</label><input className="form-control" name="direccion" value={form.direccion} onChange={handleChange} /></div>
        <div className="col-12"><p className="form-section-heading">Admin inicial</p></div>
        <div className="col-md-4"><label className="form-label">Nombre admin</label><input className="form-control" name="admin_nombre" value={form.admin_nombre} onChange={handleChange} required /></div>
        <div className="col-md-4"><label className="form-label">Correo admin</label><input className="form-control" type="email" name="admin_email" value={form.admin_email} onChange={handleChange} required /></div>
        <div className="col-md-4"><label className="form-label">Password temporal</label><input className="form-control" name="admin_password" value={form.admin_password} onChange={handleChange} minLength="6" required /></div>
        <div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Crear sucursal"}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(initialForm); setFormOpen(false); setError(""); }}>Cancelar</button></div>
      </form></div></section> : null}
      <DataTable title="Sucursales autorizadas" eyebrow="Red SerialCare" rows={sucursales} columns={columns} getRowKey={(s) => s.id_sucursal} searchPlaceholder="Buscar por nombre, ciudad, region, direccion o admin" emptyMessage="No hay sucursales." loading={loading} error="" toolbarAction={{ label: formOpen ? "Cancelar" : "+ Agregar sucursal", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }} />
    </AppLayout>
  );
}

export default MarcaSucursales;