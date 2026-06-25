import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { getDashboardPath, useAuth } from "../context/AuthContext.jsx";

function ConsultaPublica() {
  const { isAuthenticated, user } = useAuth();
  const [numeroSerie, setNumeroSerie] = useState("");
  const [producto, setProducto] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const serie = numeroSerie.trim();

    if (!serie) {
      setError("Ingresa un numero de serie.");
      setProducto(null);
      return;
    }

    setError("");
    setProducto(null);
    setIsLoading(true);

    try {
      const response = await api.get(`/productos/serie/${encodeURIComponent(serie)}`);
      setProducto(response.data.producto);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo consultar el numero de serie."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell public-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">SerialCare Cloud</p>
          <h1>Consulta publica</h1>
          <p className="muted">Trazabilidad basica por numero de serie.</p>
        </div>
        {isAuthenticated ? (
          <Link className="secondary-link" to={getDashboardPath(user?.rol)}>
            Ir a mi panel
          </Link>
        ) : (
          <Link className="secondary-link" to="/login">
            Iniciar sesion
          </Link>
        )}
      </header>

      <section className="panel search-panel">
        <form className="search-form" onSubmit={handleSubmit}>
          <label>
            Numero de serie
            <input
              type="text"
              value={numeroSerie}
              onChange={(event) => setNumeroSerie(event.target.value)}
              placeholder="SC-ACME-0001"
            />
          </label>
          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? "Consultando..." : "Consultar"}
          </button>
        </form>

        {error ? <p className="alert error-alert">{error}</p> : null}

        {producto ? (
          <div className="result-card">
            <div>
              <span>Numero de serie</span>
              <strong>{producto.numero_serie}</strong>
            </div>
            <div>
              <span>Marca</span>
              <strong>{producto.marca}</strong>
            </div>
            <div>
              <span>Modelo</span>
              <strong>{producto.modelo}</strong>
            </div>
            <div>
              <span>Garantia</span>
              <strong>{producto.estado_garantia}</strong>
            </div>
            <div>
              <span>Alerta propiedad</span>
              <strong>{producto.alerta_propiedad ? "Si" : "No"}</strong>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default ConsultaPublica;
