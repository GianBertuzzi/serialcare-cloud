import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatDate } from "../../utils/format.js";

const initialForm = { nombre: "", rut: "", telefono: "", email: "", direccion: "" };

function AdminClientes() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadClientes() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/clientes");
      setClientes(response.data.clientes || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClientes(); }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.nombre.trim()) {
      setError("Nombre del cliente es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/clientes", form);
      setForm(initialForm);
      setFormOpen(false);
      setSuccess("Cliente creado correctamente.");
      await loadClientes();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "nombre", label: "Nombre", searchValue: (cliente) => cliente.nombre, render: (cliente) => <strong>{cliente.nombre}</strong> },
    { key: "rut", label: "RUT", searchValue: (cliente) => cliente.rut || "", render: (cliente) => cliente.rut || "Sin RUT" },
    { key: "telefono", label: "Telefono", searchValue: (cliente) => cliente.telefono || "", render: (cliente) => cliente.telefono || "Sin telefono" },
    { key: "email", label: "Email", searchValue: (cliente) => cliente.email || "", render: (cliente) => cliente.email || "Sin email" },
    { key: "cantidad_maquinas", label: "Maquinas", searchValue: (cliente) => cliente.cantidad_maquinas, sortValue: (cliente) => Number(cliente.cantidad_maquinas || 0) },
    { key: "estado", label: "Estado", searchValue: (cliente) => cliente.estado, render: (cliente) => <StatusBadge value={cliente.estado} /> },
    { key: "fecha_creacion", label: "Fecha", searchValue: (cliente) => formatDate(cliente.fecha_creacion), sortValue: (cliente) => cliente.fecha_creacion, render: (cliente) => formatDate(cliente.fecha_creacion) }
  ];

  return (
    <AppLayout title="Clientes" eyebrow="ADMIN">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {formOpen ? (
        <section className="card surface-card border-0 shadow-sm mb-3">
          <div className="card-body">
            <form className="row g-3" onSubmit={handleSubmit}>
              <div className="col-md-4"><label className="form-label">Nombre</label><input className="form-control" name="nombre" value={form.nombre} onChange={handleChange} required /></div>
              <div className="col-md-2"><label className="form-label">RUT</label><input className="form-control" name="rut" value={form.rut} onChange={handleChange} /></div>
              <div className="col-md-3"><label className="form-label">Telefono</label><input className="form-control" name="telefono" value={form.telefono} onChange={handleChange} /></div>
              <div className="col-md-3"><label className="form-label">Email</label><input className="form-control" name="email" value={form.email} onChange={handleChange} /></div>
              <div className="col-12"><label className="form-label">Direccion</label><input className="form-control" name="direccion" value={form.direccion} onChange={handleChange} /></div>
              <div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Agregar cliente"}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(initialForm); setFormOpen(false); }}>Cancelar</button></div>
            </form>
          </div>
        </section>
      ) : null}
      <DataTable title="Clientes" eyebrow="Operacion local" rows={clientes} columns={columns} getRowKey={(cliente) => cliente.id_cliente} searchPlaceholder="Buscar por nombre, RUT, telefono o email" emptyMessage="No hay clientes registrados." loading={loading} error={error} toolbarAction={{ label: formOpen ? "Cancelar" : "+ Agregar cliente", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }} />
    </AppLayout>
  );
}

export default AdminClientes;