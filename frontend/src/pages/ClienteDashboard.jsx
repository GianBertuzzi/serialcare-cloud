import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha invalida";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function ClienteDashboard() {
  const { logout, user } = useAuth();
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
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">CLIENTE</p>
          <h1>Panel cliente</h1>
          <p className="muted">{user?.nombre}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Mis productos</h2>
          <p>{productos.length} productos asociados a tu cuenta.</p>
        </article>
        <article className="panel">
          <h2>Mis ordenes</h2>
          <p>{productosConOrden} productos con historial de servicio tecnico.</p>
        </article>
        <article className="panel">
          <h2>Garantias</h2>
          <p>Estado de garantia visible por producto registrado.</p>
        </article>
      </section>

      <section className="panel dashboard-table-section">
        <div className="table-header">
          <div>
            <p className="eyebrow">Mis equipos</p>
            <h2>Productos registrados</h2>
          </div>
          <Link className="secondary-link" to="/consulta-publica">
            Consulta publica
          </Link>
        </div>

        {isLoading ? <p className="muted">Cargando tus productos...</p> : null}
        {error ? <p className="alert error-alert">{error}</p> : null}

        {!isLoading && !error && productos.length === 0 ? (
          <p className="empty-state">No tienes productos registrados.</p>
        ) : null}

        {!isLoading && !error && productos.length > 0 ? (
          <div className="table-wrapper">
            <table>
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
                    <td>{producto.numero_serie}</td>
                    <td>{producto.marca}</td>
                    <td>{producto.modelo}</td>
                    <td>
                      <span className="status-badge">
                        {producto.estado_garantia}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          producto.alerta_propiedad ? "yes-badge" : "no-badge"
                        }
                      >
                        {producto.alerta_propiedad ? "Si" : "No"}
                      </span>
                    </td>
                    <td>
                      {producto.estado_reparacion ? (
                        <>
                          <span className="status-badge">
                            {producto.estado_reparacion}
                          </span>
                          <span className="table-subtext">
                            Orden #{producto.id_ultima_orden} - {formatDate(producto.fecha_ultima_orden)}
                          </span>
                        </>
                      ) : (
                        <span className="no-badge">Sin ordenes</span>
                      )}
                    </td>
                    <td>{formatDate(producto.fecha_registro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default ClienteDashboard;
