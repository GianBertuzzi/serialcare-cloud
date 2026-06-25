import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/format.js";

const initialForm = { nombre: "", descripcion: "", valor_ingreso: "0", aplica_garantia: "true", estado: "ACTIVO" };

function AdminModelosPrecios() {
  const [tipos, setTipos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTipos() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/tipos-maquina");
      setTipos(response.data.tipos_maquina || response.data.tipos || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar los tipos de maquina.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTipos(); }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleEditingChange(event) {
    const { name, value } = event.target;
    setEditing((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.nombre.trim()) {
      setError("Nombre del tipo de maquina es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/tipos-maquina", { ...form, valor_ingreso: Number(form.valor_ingreso || 0), aplica_garantia: form.aplica_garantia === "true" });
      setForm(initialForm);
      setFormOpen(false);
      setSuccess("Tipo de maquina creado correctamente.");
      await loadTipos();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo crear el tipo de maquina.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(tipo) {
    setEditingId(tipo.id_tipo_maquina);
    setEditing({
      nombre: tipo.nombre || "",
      descripcion: tipo.descripcion || "",
      valor_ingreso: String(tipo.valor_ingreso || 0),
      aplica_garantia: tipo.aplica_garantia ? "true" : "false",
      estado: tipo.estado || "ACTIVO"
    });
  }

  async function saveEdit(tipo) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/tipos-maquina/${tipo.id_tipo_maquina}`, {
        nombre: editing.nombre.trim(),
        descripcion: editing.descripcion.trim(),
        valor_ingreso: Number(editing.valor_ingreso || 0),
        aplica_garantia: editing.aplica_garantia === "true",
        estado: editing.estado
      });
      setEditingId(null);
      setEditing(initialForm);
      setSuccess("Tipo de maquina actualizado.");
      await loadTipos();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo actualizar el tipo de maquina.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "nombre", label: "Nombre", searchValue: (t) => t.nombre, render: (t) => editingId === t.id_tipo_maquina ? <input className="form-control form-control-sm" name="nombre" value={editing.nombre} onChange={handleEditingChange} /> : <strong>{t.nombre}</strong> },
    { key: "descripcion", label: "Descripcion", searchValue: (t) => t.descripcion || "", render: (t) => editingId === t.id_tipo_maquina ? <input className="form-control form-control-sm" name="descripcion" value={editing.descripcion} onChange={handleEditingChange} /> : (t.descripcion || "Sin descripcion") },
    { key: "valor_ingreso", label: "Valor ingreso", searchValue: (t) => t.valor_ingreso, sortValue: (t) => Number(t.valor_ingreso || 0), render: (t) => editingId === t.id_tipo_maquina ? <input className="form-control form-control-sm price-input" name="valor_ingreso" type="number" min="0" value={editing.valor_ingreso} onChange={handleEditingChange} /> : formatCurrency(t.valor_ingreso) },
    { key: "aplica_garantia", label: "Aplica garantia", searchValue: (t) => t.aplica_garantia ? "Si" : "No", render: (t) => editingId === t.id_tipo_maquina ? <select className="form-select form-select-sm" name="aplica_garantia" value={editing.aplica_garantia} onChange={handleEditingChange}><option value="true">Si</option><option value="false">No</option></select> : <span className={t.aplica_garantia ? "yes-badge" : "no-badge"}>{t.aplica_garantia ? "Si" : "No"}</span> },
    { key: "estado", label: "Estado", searchValue: (t) => t.estado, render: (t) => editingId === t.id_tipo_maquina ? <select className="form-select form-select-sm" name="estado" value={editing.estado} onChange={handleEditingChange}><option value="ACTIVO">ACTIVO</option><option value="INACTIVO">INACTIVO</option></select> : <StatusBadge value={t.estado} /> },
    { key: "acciones", label: "Acciones", searchable: false, sortable: false, render: (t) => editingId === t.id_tipo_maquina ? <div className="table-actions"><button className="btn btn-success btn-sm" disabled={saving} onClick={() => saveEdit(t)}>Guardar</button><button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingId(null)}>Cancelar</button></div> : <button className="btn btn-outline-primary btn-sm" onClick={() => startEdit(t)}>Modificar</button> },
    { key: "fecha", label: "Fecha", searchValue: (t) => formatDate(t.fecha_creacion), sortValue: (t) => t.fecha_creacion, render: (t) => formatDate(t.fecha_creacion) }
  ];

  return (
    <AppLayout title="Tipos de maquina y valores de ingreso" eyebrow="ADMIN">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {formOpen ? <section className="card surface-card border-0 shadow-sm mb-3"><div className="card-body"><form className="row g-3" onSubmit={handleSubmit}>
        <div className="col-md-3"><label className="form-label">Nombre</label><input className="form-control" name="nombre" value={form.nombre} onChange={handleChange} required /></div>
        <div className="col-md-4"><label className="form-label">Descripcion</label><input className="form-control" name="descripcion" value={form.descripcion} onChange={handleChange} /></div>
        <div className="col-md-2"><label className="form-label">Valor ingreso</label><input className="form-control" type="number" min="0" name="valor_ingreso" value={form.valor_ingreso} onChange={handleChange} /></div>
        <div className="col-md-2"><label className="form-label">Aplica garantia</label><select className="form-select" name="aplica_garantia" value={form.aplica_garantia} onChange={handleChange}><option value="true">Si</option><option value="false">No</option></select></div>
        <div className="col-md-1"><label className="form-label">Estado</label><select className="form-select" name="estado" value={form.estado} onChange={handleChange}><option value="ACTIVO">ACTIVO</option><option value="INACTIVO">INACTIVO</option></select></div>
        <div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Agregar tipo de maquina"}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(initialForm); setFormOpen(false); }}>Cancelar</button></div>
      </form></div></section> : null}
      <DataTable title="Tipos de maquina y valores de ingreso" eyebrow="Valores operativos" rows={tipos} columns={columns} getRowKey={(t) => t.id_tipo_maquina} searchPlaceholder="Buscar por nombre, descripcion o estado" emptyMessage="No hay tipos de maquina configurados." loading={loading} error={error} toolbarAction={{ label: formOpen ? "Cancelar" : "+ Agregar tipo de maquina", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }} />
    </AppLayout>
  );
}

export default AdminModelosPrecios;