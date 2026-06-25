import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";

const ESTADOS_ORDEN = ["PENDIENTE", "EN_DIAGNOSTICO", "REPARADA", "CERRADA"];

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

function TecnicoDashboard() {
  const { logout, user } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  async function loadOrdenes() {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get("/ordenes");
      setOrdenes(response.data.ordenes || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudieron cargar las ordenes de servicio."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialOrdenes() {
      setIsLoading(true);
      setError("");

      try {
        const response = await api.get("/ordenes");

        if (isMounted) {
          setOrdenes(response.data.ordenes || []);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.response?.data?.error ||
              "No se pudieron cargar las ordenes de servicio."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialOrdenes();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleEstadoChange(idOrden, estado) {
    setUpdatingId(idOrden);
    setError("");

    try {
      await api.put(`/ordenes/${idOrden}/estado`, { estado });
      await loadOrdenes();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo actualizar el estado de la orden."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">TECNICO</p>
          <h1>Panel tecnico</h1>
          <p className="muted">{user?.nombre}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Ordenes asignadas</h2>
          <p>{ordenes.length} ordenes registradas para seguimiento tecnico.</p>
        </article>
        <article className="panel">
          <h2>Consulta de productos</h2>
          <p>Busqueda de equipos serializados para soporte tecnico.</p>
        </article>
        <article className="panel">
          <h2>Alertas</h2>
          <p>Casos con garantia pendiente o alerta de propiedad.</p>
        </article>
      </section>

      <section className="panel dashboard-table-section">
        <div className="table-header">
          <div>
            <p className="eyebrow">Servicio tecnico</p>
            <h2>Ordenes de servicio</h2>
          </div>
          <Link className="secondary-link" to="/consulta-publica">
            Consulta publica
          </Link>
        </div>

        {isLoading ? <p className="muted">Cargando ordenes...</p> : null}
        {error ? <p className="alert error-alert">{error}</p> : null}

        {!isLoading && !error && ordenes.length === 0 ? (
          <p className="empty-state">No hay ordenes de servicio registradas.</p>
        ) : null}

        {!isLoading && !error && ordenes.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Numero de serie</th>
                  <th>Diagnostico</th>
                  <th>Estado</th>
                  <th>Cambiar estado</th>
                  <th>Fecha creacion</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((orden) => (
                  <tr key={orden.id_orden}>
                    <td>{orden.id_orden}</td>
                    <td>
                      <strong>{orden.numero_serie || "Sin serie"}</strong>
                      {orden.marca || orden.modelo ? (
                        <span className="table-subtext">
                          {[orden.marca, orden.modelo].filter(Boolean).join(" - ")}
                        </span>
                      ) : null}
                    </td>
                    <td>{orden.diagnostico}</td>
                    <td>
                      <span className="status-badge">{orden.estado}</span>
                    </td>
                    <td>
                      <select
                        className="state-select"
                        value={orden.estado}
                        disabled={updatingId === orden.id_orden}
                        onChange={(event) =>
                          handleEstadoChange(orden.id_orden, event.target.value)
                        }
                      >
                        {ESTADOS_ORDEN.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDate(orden.fecha_creacion)}</td>
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

export default TecnicoDashboard;
