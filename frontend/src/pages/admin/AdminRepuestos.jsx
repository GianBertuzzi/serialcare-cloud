import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/format.js";

const initialForm = { codigo: "", nombre: "", marca: "", precio: "0", stock: "0" };

function AdminRepuestos() {
  const [repuestos, setRepuestos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadRepuestos() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/repuestos");
      setRepuestos(response.data.repuestos || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar los repuestos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRepuestos(); }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.nombre.trim()) {
      setError("Nombre de repuesto es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/repuestos", { ...form, precio: Number(form.precio || 0), stock: Number(form.stock || 0) });
      setForm(initialForm);
      setFormOpen(false);
      setSuccess("Repuesto creado correctamente.");
      await loadRepuestos();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo crear el repuesto.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "codigo", label: "Codigo", searchValue: (r) => r.codigo || "", render: (r) => r.codigo || "Sin codigo" },
    { key: "nombre", label: "Nombre", searchValue: (r) => r.nombre, render: (r) => <strong>{r.nombre}</strong> },
    { key: "marca", label: "Marca", searchValue: (r) => r.marca || "", render: (r) => r.marca || "Sin marca" },
    { key: "precio", label: "Precio", searchValue: (r) => r.precio, sortValue: (r) => Number(r.precio || 0), render: (r) => formatCurrency(r.precio) },
    { key: "stock", label: "Stock", searchValue: (r) => r.stock, sortValue: (r) => Number(r.stock || 0) },
    { key: "estado", label: "Estado", searchValue: (r) => r.estado, render: (r) => <StatusBadge value={r.estado} /> },
    { key: "fecha", label: "Fecha", searchValue: (r) => formatDate(r.fecha_creacion), sortValue: (r) => r.fecha_creacion, render: (r) => formatDate(r.fecha_creacion) }
  ];

  return (
    <AppLayout title="Repuestos" eyebrow="ADMIN">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {formOpen ? <section className="card surface-card border-0 shadow-sm mb-3"><div className="card-body"><form className="row g-3" onSubmit={handleSubmit}>
        <div className="col-md-2"><label className="form-label">Codigo</label><input className="form-control" name="codigo" value={form.codigo} onChange={handleChange} /></div>
        <div className="col-md-4"><label className="form-label">Nombre</label><input className="form-control" name="nombre" value={form.nombre} onChange={handleChange} required /></div>
        <div className="col-md-2"><label className="form-label">Marca</label><input className="form-control" name="marca" value={form.marca} onChange={handleChange} /></div>
        <div className="col-md-2"><label className="form-label">Precio</label><input className="form-control" type="number" min="0" name="precio" value={form.precio} onChange={handleChange} /></div>
        <div className="col-md-2"><label className="form-label">Stock</label><input className="form-control" type="number" min="0" name="stock" value={form.stock} onChange={handleChange} /></div>
        <div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Agregar repuesto"}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(initialForm); setFormOpen(false); }}>Cancelar</button></div>
      </form></div></section> : null}
      <DataTable title="Repuestos" eyebrow="Catalogo local" rows={repuestos} columns={columns} getRowKey={(r) => r.id_repuesto} searchPlaceholder="Buscar por codigo, nombre o marca" emptyMessage="No hay repuestos." loading={loading} error={error} toolbarAction={{ label: formOpen ? "Cancelar" : "+ Agregar repuesto", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }} />
    </AppLayout>
  );
}

export default AdminRepuestos;