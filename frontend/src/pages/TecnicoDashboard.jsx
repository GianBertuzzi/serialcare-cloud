import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function TecnicoDashboard() {
  const { logout, user } = useAuth();

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
          <p>Revision de diagnosticos, estados y avances de servicio.</p>
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

      <Link className="text-link" to="/consulta-publica">
        Ir a consulta publica
      </Link>
    </main>
  );
}

export default TecnicoDashboard;
