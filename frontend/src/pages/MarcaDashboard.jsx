import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function MarcaDashboard() {
  const { logout, user } = useAuth();

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
          <p>Revision de solicitudes para aprobar o rechazar casos.</p>
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

      <Link className="text-link" to="/consulta-publica">
        Ir a consulta publica
      </Link>
    </main>
  );
}

export default MarcaDashboard;
