import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/format.js";

const initialForm = { id_cliente: "", numero_serie: "", marca: "", modelo: "", id_tipo_maquina: "", descripcion: "", estado_garantia: "PENDIENTE", alerta_propiedad: "false" };

function AdminProductos() {
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tiposMaquina, setTiposMaquina] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [productosResponse, clientesResponse, tiposResponse] = await Promise.all([api.get("/productos"), api.get("/clientes"), api.get("/tipos-maquina")]);
      const nextTipos = tiposResponse.data.tipos_maquina || tiposResponse.data.tipos || [];
      setProductos(productosResponse.data.productos || []);
      setClientes(clientesResponse.data.clientes || []);
      setTiposMaquina(nextTipos);
      setForm((current) => ({ ...current, id_tipo_maquina: current.id_tipo_maquina || (nextTipos[0] ? String(nextTipos[0].id_tipo_maquina) : "") }));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar las maquinas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.id_cliente || !form.numero_serie.trim() || !form.marca.trim() || !form.modelo.trim() || !form.id_tipo_maquina) {
      setError("Cliente, serie, marca, modelo y tipo de maquina son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/productos", { ...form, id_cliente: Number(form.id_cliente), id_tipo_maquina: Number(form.id_tipo_maquina), alerta_propiedad: form.alerta_propiedad === "true" });
      setForm(initialForm);
      setFormOpen(false);
      setSuccess("Maquina creada correctamente.");
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo crear la maquina.");
    } finally {
      setSaving(false);
    }
  }

  const selectedTipo = tiposMaquina.find((tipo) => String(tipo.id_tipo_maquina) === String(form.id_tipo_maquina));

  const columns = [
    { key: "numero_serie", label: "Serie", searchValue: (producto) => producto.numero_serie, render: (producto) => <strong>{producto.numero_serie}</strong> },
    { key: "cliente", label: "Cliente", searchValue: (producto) => producto.cliente_nombre || "", render: (producto) => producto.cliente_nombre || "Sin cliente" },
    { key: "marca", label: "Marca", searchValue: (producto) => producto.marca || "" },
    { key: "modelo", label: "Modelo", searchValue: (producto) => producto.modelo || "" },
    { key: "tipo_maquina", label: "Tipo maquina", searchValue: (producto) => producto.tipo_maquina || "", render: (producto) => producto.tipo_maquina || "Sin tipo" },
    { key: "valor_ingreso", label: "Valor ingreso", searchValue: (producto) => producto.valor_ingreso, sortValue: (producto) => Number(producto.valor_ingreso || 0), render: (producto) => formatCurrency(producto.valor_ingreso) },
    { key: "garantia", label: "Garantia", searchValue: (producto) => producto.estado_garantia, render: (producto) => <StatusBadge value={producto.estado_garantia} /> },
    { key: "alerta", label: "Alerta", searchValue: (producto) => producto.alerta_propiedad ? "Si" : "No", render: (producto) => <span className={producto.alerta_propiedad ? "yes-badge" : "no-badge"}>{producto.alerta_propiedad ? "Si" : "No"}</span> },
    { key: "fecha", label: "Fecha", searchValue: (producto) => formatDate(producto.fecha_registro), sortValue: (producto) => producto.fecha_registro, render: (producto) => formatDate(producto.fecha_registro) }
  ];

  return (
    <AppLayout title="Maquinas / productos serializados" eyebrow="ADMIN">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {formOpen ? (
        <section className="card surface-card border-0 shadow-sm mb-3">
          <div className="card-body">
            <form className="row g-3" onSubmit={handleSubmit}>
              <div className="col-md-4"><label className="form-label">Cliente</label><select className="form-select" name="id_cliente" value={form.id_cliente} onChange={handleChange} required><option value="">Seleccionar</option>{clientes.map((cliente) => <option key={cliente.id_cliente} value={cliente.id_cliente}>{cliente.nombre}</option>)}</select></div>
              <div className="col-md-4"><label className="form-label">Numero de serie</label><input className="form-control" name="numero_serie" value={form.numero_serie} onChange={handleChange} required /></div>
              <div className="col-md-2"><label className="form-label">Marca</label><input className="form-control" name="marca" value={form.marca} onChange={handleChange} required /></div>
              <div className="col-md-2"><label className="form-label">Modelo</label><input className="form-control" name="modelo" value={form.modelo} onChange={handleChange} required /></div>
              <div className="col-md-4"><label className="form-label">Tipo de maquina</label><select className="form-select" name="id_tipo_maquina" value={form.id_tipo_maquina} onChange={handleChange} required><option value="">Seleccionar tipo</option>{tiposMaquina.map((tipo) => <option key={tipo.id_tipo_maquina} value={tipo.id_tipo_maquina}>{tipo.nombre} - {formatCurrency(tipo.valor_ingreso)}</option>)}</select></div>
              <div className="col-md-4"><label className="form-label">Descripcion</label><input className="form-control" name="descripcion" value={form.descripcion} onChange={handleChange} /></div>
              <div className="col-md-2"><label className="form-label">Garantia</label><select className="form-select" name="estado_garantia" value={form.estado_garantia} onChange={handleChange}><option>ACTIVA</option><option>VENCIDA</option><option>PENDIENTE</option><option>EN_REVISION</option></select></div>
              <div className="col-md-2"><label className="form-label">Alerta</label><select className="form-select" name="alerta_propiedad" value={form.alerta_propiedad} onChange={handleChange}><option value="false">No</option><option value="true">Si</option></select></div>
              {selectedTipo ? <div className="col-12"><p className="alert alert-info mb-0">Valor ingreso para {selectedTipo.nombre}: {formatCurrency(selectedTipo.valor_ingreso)}</p></div> : null}
              <div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Agregar maquina"}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(initialForm); setFormOpen(false); }}>Cancelar</button></div>
            </form>
          </div>
        </section>
      ) : null}
      <DataTable title="Maquinas / productos serializados" eyebrow="Inventario local" rows={productos} columns={columns} getRowKey={(producto) => producto.id_producto} searchPlaceholder="Buscar por serie, cliente, marca, modelo, tipo de maquina o garantia" emptyMessage="No hay maquinas registradas." loading={loading} error={error} toolbarAction={{ label: formOpen ? "Cancelar" : "+ Agregar maquina", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }} />
    </AppLayout>
  );
}

export default AdminProductos;