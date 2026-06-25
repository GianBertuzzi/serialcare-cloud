import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import SummaryBars from "../components/SummaryBars.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";
import { countBy, formatCurrency, formatDate } from "../utils/format.js";

function AdminDashboard() {
  const [data, setData] = useState({ ordenes: [], clientes: [], productos: [], tecnicos: [], repuestos: [], tipos: [], garantias: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [ordenes, clientes, productos, tecnicos, repuestos, tipos, garantias] = await Promise.all([
          api.get("/ordenes"),
          api.get("/clientes"),
          api.get("/productos"),
          api.get("/tecnicos"),
          api.get("/repuestos"),
          api.get("/tipos-maquina"),
          api.get("/garantias")
        ]);

        if (mounted) {
          setData({
            ordenes: ordenes.data.ordenes || [],
            clientes: clientes.data.clientes || [],
            productos: productos.data.productos || [],
            tecnicos: tecnicos.data.tecnicos || [],
            repuestos: repuestos.data.repuestos || [],
            tipos: tipos.data.tipos || [],
            garantias: garantias.data.garantias || []
          });
        }
      } catch (requestError) {
        if (mounted) setError(requestError.response?.data?.error || "No se pudo cargar el dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const estadoCounts = useMemo(() => countBy(data.ordenes, "estado"), [data.ordenes]);
  const tipoCounts = useMemo(() => countBy(data.ordenes, "tipo_atencion"), [data.ordenes]);
  const tipoMaquinaCounts = useMemo(() => countBy(data.productos, "tipo_maquina"), [data.productos]);
  const garantiasPendientes = data.garantias.filter((garantia) => ["PENDIENTE", "EN_REVISION"].includes(garantia.estado)).length;
  const cotizacionTotal = data.ordenes.reduce((total, orden) => total + Number(orden.valor_ingreso || orden.valor_revision || 0), 0);
  const recientes = data.ordenes.slice(0, 5);

  return (
    <AppLayout title="Dashboard admin" eyebrow="ADMIN">
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {loading ? <p className="text-secondary">Cargando resumen...</p> : null}

      <section className="row g-3 mb-4">
        <div className="col-md-3"><StatCard title="Total ordenes" value={data.ordenes.length} detail="Operacion local" tone="primary" label="OS" /></div>
        <div className="col-md-3"><StatCard title="Pendientes" value={estadoCounts.PENDIENTE || 0} detail="Por atender" tone="warning" label="PE" /></div>
        <div className="col-md-3"><StatCard title="En diagnostico" value={estadoCounts.EN_DIAGNOSTICO || 0} detail="Trabajo tecnico" tone="success" label="DG" /></div>
        <div className="col-md-3"><StatCard title="Cerradas" value={estadoCounts.CERRADA || 0} detail="Finalizadas" tone="danger" label="CE" /></div>
      </section>

      <section className="row g-3 mb-4">
        <div className="col-md-3"><StatCard title="Garantias pendientes" value={garantiasPendientes} detail="Decision sucursal" tone="warning" label="GA" /></div>
        <div className="col-md-3"><StatCard title="Clientes" value={data.clientes.length} detail="De la sucursal" tone="primary" label="CL" /></div>
        <div className="col-md-3"><StatCard title="Maquinas" value={data.productos.length} detail="Registradas" tone="success" label="MQ" /></div>
        <div className="col-md-3"><StatCard title="Repuestos" value={data.repuestos.length} detail="Catalogo local" tone="danger" label="RP" /></div>
      </section>

      <section className="row g-3 mb-4">
        <div className="col-lg-6">
          <SummaryBars
            title="Distribucion por estado"
            rows={Object.entries(estadoCounts).map(([label, value]) => ({ label, value }))}
          />
        </div>
        <div className="col-lg-6">
          <SummaryBars
            title="Distribucion por tipo de atencion"
            rows={Object.entries(tipoCounts).map(([label, value]) => ({ label, value }))}
          />
        </div>
      </section>

      <section className="row g-3 mb-4">
        <div className="col-lg-6">
          <SummaryBars
            title="Maquinas por tipo"
            rows={Object.entries(tipoMaquinaCounts).map(([label, value]) => ({ label, value }))}
          />
        </div>
        <div className="col-lg-6">
          <section className="card surface-card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">Tipos de maquina configurados</h2>
              <strong className="stat-value mb-2">{data.tipos.length}</strong>
              <p className="stat-title mb-0">Valores de ingreso administrados por sucursal</p>
            </div>
          </section>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-lg-8">
          <section className="card surface-card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                <h2 className="h5 mb-0">Ordenes recientes</h2>
                <Link className="btn btn-outline-primary btn-sm" to="/admin/ordenes">Ver ordenes</Link>
              </div>
              {recientes.length === 0 ? <p className="empty-state">No hay ordenes recientes.</p> : null}
              {recientes.map((orden) => (
                <div className="activity-row" key={orden.id_orden}>
                  <div>
                    <strong>Orden #{orden.id_orden} - {orden.numero_serie}</strong>
                    <span>{orden.cliente_nombre || "Sin cliente"} - {formatDate(orden.fecha_creacion)}</span>
                  </div>
                  <StatusBadge value={orden.estado} />
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="col-lg-4">
          <section className="card surface-card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Resumen cotizaciones</h2>
              <p className="stat-title mb-1">Valor ingreso acumulado</p>
              <strong className="stat-value mb-3">{formatCurrency(cotizacionTotal)}</strong>
              <div className="quick-links">
                <Link to="/admin/clientes">Clientes</Link>
                <Link to="/admin/productos">Maquinas</Link>
                <Link to="/admin/repuestos">Repuestos</Link>
                <Link to="/admin/modelos-precios">Tipos de maquina</Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </AppLayout>
  );
}

export default AdminDashboard;