import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";

function formatDate(value) {
  if (!value) {
    return "Sin revision";
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

function MarcaDashboard() {
  const { logout, user } = useAuth();
  const [garantias, setGarantias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  async function loadGarantias() {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get("/garantias");
      setGarantias(response.data.garantias || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudieron cargar las garantias."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialGarantias() {
      setIsLoading(true);
      setError("");

      try {
        const response = await api.get("/garantias");

        if (isMounted) {
          setGarantias(response.data.garantias || []);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.response?.data?.error ||
              "No se pudieron cargar las garantias."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialGarantias();

    return () => {
      isMounted = false;
    };
  }, []);

  async function updateGarantia(idGarantia, action) {
    setUpdatingId(idGarantia);
    setError("");

    try {
      await api.put(`/garantias/${idGarantia}/${action}`);
      await loadGarantias();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo actualizar la solicitud de garantia."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">MARCA</p>
          <h1>Panel marca</h1>
          <p className="muted">{user?.nombre}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Garantias pendientes</h2>
          <p>{garantias.filter((garantia) => garantia.estado === "PENDIENTE").length} solicitudes pendientes.</p>
        </article>
        <article className="panel">
          <h2>Productos de marca</h2>
          <p>Vista de modelos, series y trazabilidad basica.</p>
        </article>
        <article className="panel">
          <h2>Alertas de propiedad</h2>
          <p>Senales de equipos sin cliente registrado o con revision requerida.</p>
        </article>
      </section>

      <section className="panel dashboard-table-section">
        <div className="table-header">
          <div>
            <p className="eyebrow">Garantias</p>
            <h2>Solicitudes de garantia</h2>
          </div>
          <Link className="secondary-link" to="/consulta-publica">
            Consulta publica
          </Link>
        </div>

        {isLoading ? <p className="muted">Cargando garantias...</p> : null}
        {error ? <p className="alert error-alert">{error}</p> : null}

        {!isLoading && !error && garantias.length === 0 ? (
          <p className="empty-state">No hay garantias registradas.</p>
        ) : null}

        {!isLoading && !error && garantias.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Numero de serie</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Estado</th>
                  <th>Observacion</th>
                  <th>Fecha revision</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {garantias.map((garantia) => (
                  <tr key={garantia.id_garantia}>
                    <td>{garantia.id_garantia}</td>
                    <td>{garantia.numero_serie || "Sin serie"}</td>
                    <td>{garantia.marca}</td>
                    <td>{garantia.modelo}</td>
                    <td>
                      <span className="status-badge">{garantia.estado}</span>
                    </td>
                    <td>{garantia.observacion || "Sin observacion"}</td>
                    <td>{formatDate(garantia.fecha_revision)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="approve-button"
                          type="button"
                          disabled={updatingId === garantia.id_garantia}
                          onClick={() => updateGarantia(garantia.id_garantia, "aprobar")}
                        >
                          Aprobar
                        </button>
                        <button
                          className="reject-button"
                          type="button"
                          disabled={updatingId === garantia.id_garantia}
                          onClick={() => updateGarantia(garantia.id_garantia, "rechazar")}
                        >
                          Rechazar
                        </button>
                      </div>
                    </td>
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

export default MarcaDashboard;
