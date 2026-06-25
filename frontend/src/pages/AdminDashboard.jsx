import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function AdminDashboard() {
  const { logout, user } = useAuth();

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>Panel administrador</h1>
          <p className="muted">{user?.nombre}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Usuarios y roles</h2>
          <p>Control operativo para cuentas ADMIN, TECNICO, CLIENTE y MARCA.</p>
        </article>
        <article className="panel">
          <h2>Productos serializados</h2>
          <p>Revision de inventario, propiedad y estados de garantia.</p>
        </article>
        <article className="panel">
          <h2>Servicio tecnico</h2>
          <p>Seguimiento general de ordenes y casos abiertos.</p>
        </article>
      </section>

      <Link className="text-link" to="/consulta-publica">
        Ir a consulta publica
      </Link>
    </main>
  );
}

export default AdminDashboard;
