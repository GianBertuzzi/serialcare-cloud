import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import SummaryBars from "../components/SummaryBars.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";
import { countBy, formatDate } from "../utils/format.js";

function MarcaDashboard() {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/sucursales");
        if (mounted) setSucursales(response.data.sucursales || []);
      } catch (requestError) {
        if (mounted) setError(requestError.response?.data?.error || "No se pudo cargar el dashboard marca.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const counts = useMemo(() => countBy(sucursales, "estado"), [sucursales]);
  const recientes = sucursales.slice(-5).reverse();

  return (
    <AppLayout title="Dashboard marca" eyebrow="MARCA">
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {loading ? <p className="text-secondary">Cargando resumen...</p> : null}
      <section className="row g-3 mb-4">
        <div className="col-md-4"><StatCard title="Total sucursales" value={sucursales.length} detail="Red autorizada" tone="primary" label="SU" /></div>
        <div className="col-md-4"><StatCard title="Activas" value={counts.ACTIVA || 0} detail="Operando" tone="success" label="AC" /></div>
        <div className="col-md-4"><StatCard title="Inactivas" value={counts.INACTIVA || 0} detail="Deshabilitadas" tone="danger" label="IN" /></div>
      </section>
      <section className="row g-3">
        <div className="col-lg-6"><SummaryBars title="Sucursales activas vs inactivas" rows={Object.entries(counts).map(([label, value]) => ({ label, value }))} /></div>
        <div className="col-lg-6">
          <section className="card surface-card border-0 shadow-sm"><div className="card-body">
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><h2 className="h5 mb-0">Sucursales recientes</h2><Link className="btn btn-outline-primary btn-sm" to="/marca/sucursales">Administrar</Link></div>
            {recientes.map((sucursal) => <div className="activity-row" key={sucursal.id_sucursal}><div><strong>{sucursal.nombre}</strong><span>{sucursal.ciudad || "Sin ciudad"} - {formatDate(sucursal.fecha_creacion)}</span></div><StatusBadge value={sucursal.estado} /></div>)}
          </div></section>
        </div>
      </section>
    </AppLayout>
  );
}

export default MarcaDashboard;