import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import OrdenDetalleModal from "../../components/OrdenDetalleModal.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatDate } from "../../utils/format.js";

function TecnicoOrdenes() {
  const [activeScope, setActiveScope] = useState("disponibles");
  const [disponibles, setDisponibles] = useState([]);
  const [mias, setMias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState(null);
  const [takingId, setTakingId] = useState(null);

  async function loadOrdenes() {
    setLoading(true);
    setError("");

    try {
      const [disponiblesResponse, miasResponse] = await Promise.all([
        api.get("/ordenes", { params: { scope: "disponibles" } }),
        api.get("/ordenes", { params: { scope: "mias" } })
      ]);
      setDisponibles(disponiblesResponse.data.ordenes || []);
      setMias(miasResponse.data.ordenes || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar las ordenes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrdenes();
  }, []);

  async function handleTake(idOrden) {
    setTakingId(idOrden);
    setError("");
    setSuccess("");

    try {
      await api.post(`/ordenes/${idOrden}/tomar`);
      setSuccess(`Orden #${idOrden} tomada correctamente.`);
      setActiveScope("mias");
      await loadOrdenes();
    } catch (requestError) {
      const conflict = requestError.response?.status === 409;
      if (conflict) await loadOrdenes();
      setError(requestError.response?.data?.error || (conflict ? "Otro usuario ya tomo esta orden." : "No se pudo tomar la orden."));
    } finally {
      setTakingId(null);
    }
  }

  const columns = [
    { key: "id_orden", label: "ID", searchValue: (orden) => orden.id_orden, sortValue: (orden) => Number(orden.id_orden || 0) },
    { key: "numero_serie", label: "Serie", searchValue: (orden) => orden.numero_serie || "", render: (orden) => <strong>{orden.numero_serie}</strong> },
    { key: "cliente_producto", label: "Cliente / producto", searchValue: (orden) => `${orden.cliente_nombre || ""} ${orden.marca || ""} ${orden.modelo || ""}`, render: (orden) => <>{orden.cliente_nombre || "Sin cliente"}<span className="table-subtext">{[orden.marca, orden.modelo].filter(Boolean).join(" - ")}</span></> },
    { key: "tipo", label: "Tipo", searchValue: (orden) => orden.tipo_orden || orden.tipo_atencion || "", render: (orden) => orden.tipo_orden || orden.tipo_atencion },
    { key: "estado", label: "Estado", searchValue: (orden) => orden.estado, render: (orden) => <StatusBadge value={orden.estado} /> },
    { key: "fecha", label: "Fecha", searchValue: (orden) => formatDate(orden.fecha_creacion), sortValue: (orden) => orden.fecha_creacion, render: (orden) => formatDate(orden.fecha_creacion) },
    { key: "acciones", label: "Acciones", searchable: false, sortable: false, render: (orden) => (
      <div className="table-actions">
        <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => setSelected(orden)}>Ver detalle</button>
        {activeScope === "disponibles" ? (
          <button className="btn btn-primary btn-sm" type="button" disabled={takingId === orden.id_orden} onClick={() => handleTake(orden.id_orden)}>
            {takingId === orden.id_orden ? "Tomando..." : "Tomar orden"}
          </button>
        ) : null}
      </div>
    ) }
  ];

  const rows = activeScope === "disponibles" ? disponibles : mias;

  return (
    <AppLayout title="Ordenes de servicio" eyebrow="TECNICO">
      {success ? <p className="alert alert-success">{success}</p> : null}
      {selected ? <OrdenDetalleModal orden={selected} readOnly onClose={() => setSelected(null)} /> : null}

      <ul className="nav nav-tabs mb-3" aria-label="Vistas de ordenes">
        <li className="nav-item">
          <button className={`nav-link ${activeScope === "disponibles" ? "active" : ""}`} type="button" onClick={() => setActiveScope("disponibles")}>
            Disponibles <span className="badge text-bg-secondary ms-1">{disponibles.length}</span>
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeScope === "mias" ? "active" : ""}`} type="button" onClick={() => setActiveScope("mias")}>
            Mis ordenes <span className="badge text-bg-secondary ms-1">{mias.length}</span>
          </button>
        </li>
      </ul>

      <DataTable
        title={activeScope === "disponibles" ? "Ordenes disponibles" : "Mis ordenes"}
        eyebrow="Servicio tecnico"
        rows={rows}
        columns={columns}
        getRowKey={(orden) => orden.id_orden}
        searchPlaceholder="Buscar por ID, serie, cliente, producto o estado"
        emptyMessage={activeScope === "disponibles" ? "No hay ordenes disponibles." : "No has tomado ordenes."}
        loading={loading}
        error={error}
        initialSortKey="id_orden"
      />
    </AppLayout>
  );
}

export default TecnicoOrdenes;