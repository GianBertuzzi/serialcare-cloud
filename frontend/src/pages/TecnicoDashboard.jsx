import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import SummaryBars from "../components/SummaryBars.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";
import { countBy, formatDate } from "../utils/format.js";

function TecnicoDashboard() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/ordenes");
        if (mounted) setOrdenes(response.data.ordenes || []);
      } catch (requestError) {
        if (mounted) setError(requestError.response?.data?.error || "No se pudo cargar el dashboard tecnico.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const estadoCounts = useMemo(() => countBy(ordenes, "estado"), [ordenes]);
  const tipoCounts = useMemo(() => countBy(ordenes, "tipo_atencion"), [ordenes]);
  const tipoMaquinaCounts = useMemo(() => countBy(ordenes, "tipo_maquina"), [ordenes]);
  const conGarantia = ordenes.filter((orden) => orden.tipo_atencion === "GARANTIA" || orden.garantia_aprobada_por_admin !== null).length;

  return (
    <AppLayout title="Dashboard tecnico" eyebrow="TECNICO">
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {loading ? <p className="text-secondary">Cargando resumen...</p> : null}
      <section className="row g-3 mb-4">
        <div className="col-md-3"><StatCard title="Ordenes asignadas" value={ordenes.length} detail="Sucursal" tone="primary" label="OS" /></div>
        <div className="col-md-3"><StatCard title="Pendientes" value={estadoCounts.PENDIENTE || 0} detail="Por iniciar" tone="warning" label="PE" /></div>
        <div className="col-md-3"><StatCard title="En diagnostico" value={estadoCounts.EN_DIAGNOSTICO || 0} detail="Revision activa" tone="success" label="DG" /></div>
        <div className="col-md-3"><StatCard title="Con garantia" value={conGarantia} detail="Seguimiento" tone="danger" label="GA" /></div>
      </section>
      <section className="row g-3">
        <div className="col-lg-6"><SummaryBars title="Distribucion por estado" rows={Object.entries(estadoCounts).map(([label, value]) => ({ label, value }))} /></div>
        <div className="col-lg-6"><SummaryBars title="Distribucion por tipo de atencion" rows={Object.entries(tipoCounts).map(([label, value]) => ({ label, value }))} /></div>
        <div className="col-lg-6"><SummaryBars title="Maquinas por tipo" rows={Object.entries(tipoMaquinaCounts).map(([label, value]) => ({ label, value }))} /></div>
        <div className="col-12">
          <section className="card surface-card border-0 shadow-sm"><div className="card-body">
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><h2 className="h5 mb-0">Actividad reciente</h2><Link className="btn btn-outline-primary btn-sm" to="/tecnico/ordenes">Ver ordenes</Link></div>
            {ordenes.slice(0, 5).map((orden) => <div className="activity-row" key={orden.id_orden}><div><strong>Orden #{orden.id_orden} - {orden.numero_serie}</strong><span>{orden.cliente_nombre || "Sin cliente"} - {formatDate(orden.fecha_creacion)}</span></div><StatusBadge value={orden.estado} /></div>)}
          </div></section>
        </div>
      </section>
    </AppLayout>
  );
}

export default TecnicoDashboard;