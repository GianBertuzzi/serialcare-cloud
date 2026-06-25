import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { getDashboardPath, useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

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
    <main className="public-shell">
      <section className="public-card card border-0 shadow-sm">
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <p className="eyebrow mb-1">SerialCare Cloud</p>
              <h1 className="display-title mb-2">Consulta publica</h1>
              <p className="text-secondary mb-0">Trazabilidad basica por numero de serie.</p>
            </div>
            {isAuthenticated ? (
              <Link className="btn btn-outline-secondary" to={getDashboardPath(user?.rol)}>
                Ir a mi panel
              </Link>
            ) : (
              <Link className="btn btn-outline-secondary" to="/login">
                Iniciar sesion
              </Link>
            )}
          </div>

          <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
            <div className="col-md">
              <label className="form-label">Numero de serie</label>
              <input
                className="form-control form-control-lg"
                type="text"
                value={numeroSerie}
                onChange={(event) => setNumeroSerie(event.target.value)}
                placeholder="SC-ACME-0001"
              />
            </div>
            <div className="col-md-auto">
              <button className="btn btn-primary btn-lg w-100" type="submit" disabled={isLoading}>
                {isLoading ? "Consultando..." : "Consultar"}
              </button>
            </div>
          </form>

          {error ? <p className="alert alert-danger mt-4 mb-0">{error}</p> : null}

          {producto ? (
            <div className="row g-3 mt-4 result-grid">
              <div className="col-md-6 col-xl">
                <div className="result-item">
                  <span>Numero de serie</span>
                  <strong>{producto.numero_serie}</strong>
                </div>
              </div>
              <div className="col-md-6 col-xl">
                <div className="result-item">
                  <span>Marca</span>
                  <strong>{producto.marca}</strong>
                </div>
              </div>
              <div className="col-md-6 col-xl">
                <div className="result-item">
                  <span>Modelo</span>
                  <strong>{producto.modelo}</strong>
                </div>
              </div>
              <div className="col-md-6 col-xl">
                <div className="result-item">
                  <span>Garantia</span>
                  <StatusBadge value={producto.estado_garantia} />
                </div>
              </div>
              <div className="col-md-6 col-xl">
                <div className="result-item">
                  <span>Alerta propiedad</span>
                  <strong>{producto.alerta_propiedad ? "Si" : "No"}</strong>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default ConsultaPublica;
