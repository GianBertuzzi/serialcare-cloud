import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function ClienteDashboard() {
  const { logout, user } = useAuth();

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
          <p>Equipos registrados y estado de garantia vigente.</p>
        </article>
        <article className="panel">
          <h2>Mis ordenes</h2>
          <p>Seguimiento de solicitudes de servicio tecnico.</p>
        </article>
        <article className="panel">
          <h2>Garantias</h2>
          <p>Estado de solicitudes aprobadas, rechazadas o pendientes.</p>
        </article>
      </section>

      <Link className="text-link" to="/consulta-publica">
        Ir a consulta publica
      </Link>
    </main>
  );
}

export default ClienteDashboard;
