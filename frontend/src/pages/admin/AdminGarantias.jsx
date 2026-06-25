import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import OrdenDetalleModal from "../../components/OrdenDetalleModal.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatDate } from "../../utils/format.js";

function AdminGarantias() {
  const [garantias, setGarantias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  async function loadGarantias() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/garantias");
      setGarantias(response.data.garantias || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar las garantias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadGarantias(); }, []);

  const columns = [
    { key: "id_orden", label: "Orden", searchValue: (g) => g.id_orden, sortValue: (g) => Number(g.id_orden || 0), render: (g) => `#${g.id_orden}` },
    { key: "numero_serie", label: "Serie", searchValue: (g) => g.numero_serie, render: (g) => <strong>{g.numero_serie}</strong> },
    { key: "cliente", label: "Cliente", searchValue: (g) => g.cliente_nombre || "", render: (g) => g.cliente_nombre || "Sin cliente" },
    { key: "diagnostico", label: "Diagnostico", searchValue: (g) => `${g.diagnostico || ""} ${g.informe_tecnico || ""}`, render: (g) => g.diagnostico || "Sin diagnostico" },
    { key: "estado", label: "Estado", searchValue: (g) => g.estado, render: (g) => <StatusBadge value={g.estado} /> },
    { key: "decision", label: "Decision admin", searchValue: (g) => g.decision_admin || g.observacion_admin || "", render: (g) => g.decision_admin || g.observacion_admin || "Sin decision" },
    { key: "fecha", label: "Fecha", searchValue: (g) => formatDate(g.fecha_solicitud), sortValue: (g) => g.fecha_solicitud, render: (g) => formatDate(g.fecha_solicitud) },
    { key: "acciones", label: "Acciones", searchable: false, sortable: false, render: (g) => <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => setSelected({ id_orden: g.id_orden, numero_serie: g.numero_serie, marca: g.marca, modelo: g.modelo })}>Especificaciones</button> }
  ];

  return (
    <AppLayout title="Garantias internas" eyebrow="ADMIN">
      {selected ? <OrdenDetalleModal orden={selected} onClose={() => setSelected(null)} onUpdated={loadGarantias} /> : null}
      <DataTable title="Garantias internas" eyebrow="Decision operativa" rows={garantias} columns={columns} getRowKey={(g) => g.id_garantia} searchPlaceholder="Buscar por orden, serie, cliente, diagnostico o estado" emptyMessage="No hay garantias registradas." loading={loading} error={error} initialSortKey="fecha" />
    </AppLayout>
  );
}

export default AdminGarantias;