import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import NewOrderForm from "../../components/NewOrderForm.jsx";
import OrdenDetalleModal from "../../components/OrdenDetalleModal.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatDate } from "../../utils/format.js";

const ESTADOS_ORDEN = ["PENDIENTE", "EN_DIAGNOSTICO", "REPARADA", "CERRADA"];

function TecnicoOrdenes() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  async function loadOrdenes() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/ordenes");
      setOrdenes(response.data.ordenes || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar las ordenes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrdenes(); }, []);

  async function handleEstadoChange(idOrden, estado) {
    setUpdatingId(idOrden);
    setError("");
    try {
      await api.put(`/ordenes/${idOrden}/estado`, { estado });
      await loadOrdenes();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo actualizar el estado.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCreated() {
    setFormOpen(false);
    setSuccess("Orden creada correctamente.");
    await loadOrdenes();
  }

  async function handleUpdated(message) {
    if (message) setSuccess(message);
    await loadOrdenes();
  }

  const columns = [
    { key: "id_orden", label: "ID", searchValue: (orden) => orden.id_orden, sortValue: (orden) => Number(orden.id_orden || 0) },
    { key: "numero_serie", label: "Serie", searchValue: (orden) => orden.numero_serie || "", render: (orden) => <strong>{orden.numero_serie}</strong> },
    { key: "cliente_producto", label: "Cliente / producto", searchValue: (orden) => `${orden.cliente_nombre || ""} ${orden.marca || ""} ${orden.modelo || ""} ${orden.tipo_maquina || ""}`, render: (orden) => <>{orden.cliente_nombre || "Sin cliente"}<span className="table-subtext">{[orden.marca, orden.modelo].filter(Boolean).join(" - ")}</span><span className="table-subtext">{orden.tipo_maquina || "Sin tipo de maquina"}</span></> },
    { key: "sucursal", label: "Sucursal", searchValue: (orden) => orden.nombre_sucursal || "", render: (orden) => orden.nombre_sucursal || "Sin sucursal" },
    { key: "tipo", label: "Tipo atencion", searchValue: (orden) => orden.tipo_atencion || "", render: (orden) => orden.tipo_atencion || orden.tipo_orden },
    { key: "estado", label: "Estado", searchValue: (orden) => orden.estado, render: (orden) => <StatusBadge value={orden.estado} /> },
    { key: "fecha", label: "Fecha", searchValue: (orden) => formatDate(orden.fecha_creacion), sortValue: (orden) => orden.fecha_creacion, render: (orden) => formatDate(orden.fecha_creacion) },
    { key: "acciones", label: "Acciones", searchable: false, sortable: false, render: (orden) => <div className="table-actions action-stack"><button className="btn btn-outline-primary btn-sm" onClick={() => setSelected(orden)}>Especificaciones</button><select className="form-select form-select-sm state-select" value={orden.estado} disabled={updatingId === orden.id_orden} onChange={(event) => handleEstadoChange(orden.id_orden, event.target.value)}>{ESTADOS_ORDEN.map((estado) => <option key={estado} value={estado}>{estado}</option>)}</select></div> }
  ];

  return (
    <AppLayout title="Ordenes asignadas" eyebrow="TECNICO">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {formOpen ? <NewOrderForm onCancel={() => setFormOpen(false)} onCreated={handleCreated} /> : null}
      {selected ? <OrdenDetalleModal orden={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} /> : null}
      <DataTable
        title="Ordenes asignadas"
        eyebrow="Servicio tecnico"
        rows={ordenes}
        columns={columns}
        getRowKey={(orden) => orden.id_orden}
        searchPlaceholder="Buscar por ID, serie, cliente, producto o estado"
        emptyMessage="No hay ordenes asignadas."
        loading={loading}
        error={error}
        initialSortKey="id_orden"
        toolbarAction={{ label: formOpen ? "Cancelar" : "+ Nueva orden", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }}
      />
    </AppLayout>
  );
}

export default TecnicoOrdenes;