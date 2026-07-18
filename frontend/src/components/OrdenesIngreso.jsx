import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import AppLayout from "./AppLayout.jsx";
import DataTable from "./DataTable.jsx";
import NewOrderForm from "./NewOrderForm.jsx";
import OrdenDetalleModal from "./OrdenDetalleModal.jsx";
import StatusBadge from "./StatusBadge.jsx";
import api from "../services/api";
import { formatDate } from "../utils/format.js";

function OrdenesIngreso() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [takingId, setTakingId] = useState(null);

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

  useEffect(() => {
    loadOrdenes();
  }, []);

  async function handleCreated() {
    setFormOpen(false);
    setSuccess("Orden creada correctamente.");
    await loadOrdenes();
  }

  async function handleTake(idOrden) {
    setTakingId(idOrden);
    setError("");
    setSuccess("");

    try {
      await api.post(`/ordenes/${idOrden}/tomar`);
      setSuccess(`Orden #${idOrden} tomada correctamente.`);
      await loadOrdenes();
    } catch (requestError) {
      const fallback = requestError.response?.status === 409
        ? "La orden ya fue tomada por otro usuario."
        : "No se pudo tomar la orden.";
      if (requestError.response?.status === 409) await loadOrdenes();
      setError(requestError.response?.data?.error || fallback);
    } finally {
      setTakingId(null);
    }
  }

  const columns = [
    { key: "id_orden", label: "ID", searchValue: (orden) => orden.id_orden, sortValue: (orden) => Number(orden.id_orden || 0) },
    { key: "numero_serie", label: "N serie", searchValue: (orden) => orden.numero_serie || "", render: (orden) => <strong>{orden.numero_serie}</strong> },
    { key: "cliente", label: "Cliente", searchValue: (orden) => orden.cliente_nombre || "", render: (orden) => orden.cliente_nombre || "Sin cliente" },
    { key: "producto", label: "Producto / tipo", searchValue: (orden) => `${orden.marca || ""} ${orden.modelo || ""} ${orden.tipo_maquina || ""}`, render: (orden) => <>{[orden.marca, orden.modelo].filter(Boolean).join(" - ")}<span className="table-subtext">{orden.tipo_maquina || "Sin tipo de maquina"}</span></> },
    { key: "responsable", label: "Responsable", searchValue: (orden) => orden.responsable_nombre || orden.tecnico_nombre || "", render: (orden) => orden.responsable_nombre || orden.tecnico_nombre || "Sin asignar" },
    { key: "tipo_orden", label: "Tipo", searchValue: (orden) => orden.tipo_orden || orden.tipo_atencion || "", render: (orden) => orden.tipo_orden || orden.tipo_atencion },
    { key: "estado", label: "Estado", searchValue: (orden) => orden.estado, render: (orden) => <StatusBadge value={orden.estado} /> },
    { key: "fecha", label: "Fecha", searchValue: (orden) => formatDate(orden.fecha_creacion), sortValue: (orden) => orden.fecha_creacion, render: (orden) => formatDate(orden.fecha_creacion) },
    { key: "acciones", label: "Acciones", searchable: false, sortable: false, render: (orden) => (
      <div className="table-actions">
        {isAdmin ? <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => setSelected(orden)}>Ver detalle</button> : null}
        {isAdmin && orden.estado === "INGRESADA" && !orden.id_responsable ? (
          <button className="btn btn-primary btn-sm" type="button" disabled={takingId === orden.id_orden} onClick={() => handleTake(orden.id_orden)}>
            {takingId === orden.id_orden ? "Tomando..." : "Tomar orden"}
          </button>
        ) : null}
        {!isAdmin ? <span className="text-secondary small">Solo consulta</span> : null}
      </div>
    ) }
  ];

  return (
    <AppLayout title="Ordenes de servicio" eyebrow={user?.rol || "OPERACION"}>
      {success ? <p className="alert alert-success">{success}</p> : null}
      {formOpen ? <NewOrderForm onCancel={() => setFormOpen(false)} onCreated={handleCreated} /> : null}
      {selected ? <OrdenDetalleModal orden={selected} readOnly onClose={() => setSelected(null)} /> : null}
      <DataTable
        title="Ordenes de servicio"
        eyebrow="Recepcion y seguimiento"
        rows={ordenes}
        columns={columns}
        getRowKey={(orden) => orden.id_orden}
        searchPlaceholder="Buscar por ID, serie, cliente, producto o estado"
        emptyMessage="No hay ordenes registradas."
        loading={loading}
        loadingMessage="Cargando ordenes..."
        error={error}
        initialSortKey="id_orden"
        toolbarAction={{ label: formOpen ? "Cancelar" : "+ Nueva orden", className: formOpen ? "btn btn-outline-secondary" : "btn btn-primary", onClick: () => setFormOpen((current) => !current) }}
      />
    </AppLayout>
  );
}

export default OrdenesIngreso;