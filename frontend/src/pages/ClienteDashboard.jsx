import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";
import { formatDate } from "../utils/format.js";

function ClienteDashboard() {
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProductos() {
      setIsLoading(true);
      setError("");

      try {
        const response = await api.get("/productos");

        if (isMounted) {
          setProductos(response.data.productos || []);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.response?.data?.error ||
              "No se pudieron cargar tus productos."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProductos();

    return () => {
      isMounted = false;
    };
  }, []);

  const productosConOrden = productos.filter(
    (producto) => producto.estado_reparacion
  ).length;

  return (
    <AppLayout title="Panel cliente" eyebrow="CLIENTE">
      <section id="dashboard" className="row g-3 mb-4">
        <div className="col-md-4">
          <StatCard title="Mis productos" value={productos.length} detail="Asociados a tu cuenta" tone="primary" label="PR" />
        </div>
        <div className="col-md-4">
          <StatCard title="Mis ordenes" value={productosConOrden} detail="Historial de servicio" tone="success" label="OS" />
        </div>
        <div className="col-md-4">
          <StatCard title="Garantias" value="Estado" detail="Visible por producto" tone="warning" label="GA" />
        </div>
      </section>

      <section id="productos" className="card surface-card border-0 shadow-sm data-table-section">
        <div className="card-header bg-white border-0 data-table-toolbar">
          <div>
            <p className="eyebrow mb-1">Mis equipos</p>
            <h2 className="h5 mb-1">Productos registrados</h2>
            <p className="table-count mb-0">{productos.length} registros</p>
          </div>
          <Link className="btn btn-outline-secondary" to="/consulta-publica">
            Consulta publica
          </Link>
        </div>

        {isLoading ? <div className="card-body text-secondary">Cargando tus productos...</div> : null}
        {error ? (
          <div className="card-body pt-0">
            <p className="alert alert-danger mb-0">{error}</p>
          </div>
        ) : null}

        {!isLoading && !error && productos.length === 0 ? (
          <div className="card-body">
            <p className="empty-state mb-0">No tienes productos registrados.</p>
          </div>
        ) : null}

        {!isLoading && !error && productos.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle serial-table mb-0">
              <thead>
                <tr>
                  <th>Numero de serie</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Garantia</th>
                  <th>Alerta propiedad</th>
                  <th>Reparacion</th>
                  <th>Fecha registro</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => (
                  <tr key={producto.id_producto || producto.numero_serie}>
                    <td><strong>{producto.numero_serie}</strong></td>
                    <td>{producto.marca}</td>
                    <td>{producto.modelo}</td>
                    <td><StatusBadge value={producto.estado_garantia} /></td>
                    <td>
                      <span className={producto.alerta_propiedad ? "yes-badge" : "no-badge"}>
                        {producto.alerta_propiedad ? "Si" : "No"}
                      </span>
                    </td>
                    <td>
                      {producto.estado_reparacion ? (
                        <>
                          <StatusBadge value={producto.estado_reparacion} />
                          <span className="table-subtext date-cell">
                            Orden #{producto.id_ultima_orden} - {formatDate(producto.fecha_ultima_orden)}
                          </span>
                        </>
                      ) : (
                        <span className="no-badge">Sin ordenes</span>
                      )}
                    </td>
                    <td className="date-cell">{formatDate(producto.fecha_registro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}

export default ClienteDashboard;