import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatDate } from "../../utils/format.js";

const initialForm = { nombre: "", email: "", password: "Tecnico123" };

function AdminTecnicos() {
  const [tecnicos, setTecnicos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTecnicos() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/tecnicos");
      setTecnicos(response.data.tecnicos || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar los tecnicos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTecnicos(); }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.nombre.trim() || !form.email.trim() || form.password.length < 6) {
      setError("Nombre, email y password de minimo 6 caracteres son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/tecnicos", form);
      setForm(initialForm);
      setFormOpen(false);
      setSuccess("Tecnico creado correctamente.");
      await loadTecnicos();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo crear el tecnico.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "nombre", label: "Nombre", searchValue: (t) => t.nombre, render: (t) => <strong>{t.nombre}</strong> },
    { key: "email", label: "Email", searchValue: (t) => t.email },
    { key: "estado", label: "Estado", searchValue: (t) => t.estado, render: (t) => <StatusBadge value={t.estado} /> },
    { key: "fecha", label: "Fecha creacion", searchValue: (t) => formatDate(t.fecha_creacion), sortValue: (t) => t.fecha_creacion, render: (t) => formatDate(t.fecha_creacion) }
  ];

  return (
    <AppLayout title="Tecnicos" eyebrow="ADMIN">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {formOpen ? <section className="card surface-card border-0 shadow-sm mb-3"><div className="card-body"><form className="row g-3" onSubmit={handleSubmit}>
        <div className="col-md-4"><label className="form-label">Nombre</label><input className="form-control" name="nombre" value={form.nombre} onChange={handleChange} required /></div>
        <div className="col-md-4"><label className="form-label">Email</label><input className="form-control" type="email" name="email" value={form.email} onChange={handleChange} required /></div>
        <div className="col-md-4"><label className="form-label">Password temporal</label><input className="form-control" name="password" value={form.password} onChange={handleChange} minLength="6" required /></div>
        <div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Agregar tecnico"}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(initialForm); setFormOpen(false); }}>Cancelar</button></div>
      </form></div></section> : null}
      <DataTable title="Tecnicos" eyebrow="Equipo sucursal" rows={tecnicos} columns={columns} getRowKey={(t) => t.id_usuario} searchPlaceholder="Buscar por nombre, email o estado" emptyMessage="No hay tecnicos." loading={loading} error={error} toolbarAction={{ label: formOpen ? "Cancelar" : "+ Agregar tecnico", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }} />
    </AppLayout>
  );
}

export default AdminTecnicos;