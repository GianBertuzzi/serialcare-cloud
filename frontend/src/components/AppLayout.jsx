import { Link, useLocation } from "react-router-dom";
import { getDashboardPath, useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { label: "Dashboard", href: "dashboard" },
  { label: "Ordenes de servicio", href: "ordenes" },
  { label: "Productos", href: "productos" },
  { label: "Clientes", href: "clientes" },
  { label: "Modelos y precios", href: "modelos" },
  { label: "Tecnicos", href: "tecnicos" },
  { label: "Sucursales", href: "sucursales" },
  { label: "Garantias", href: "garantias" },
  { label: "Configuracion", href: "configuracion" }
];

function getInitials(name = "SC") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SC";
}

function AppLayout({ title, eyebrow, children }) {
  const { logout, user } = useAuth();
  const location = useLocation();
  const dashboardPath = getDashboardPath(user?.rol);
  const initials = getInitials(user?.nombre || user?.email || "SC");

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">SC</div>
          <div>
            <strong>SerialCare</strong>
            <span>Cloud</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegacion principal">
          <p className="sidebar-label">Navegacion</p>
          {navItems.map((item) => {
            const isDashboard = item.href === "dashboard";
            const isActive = isDashboard && location.pathname === dashboardPath;

            return isDashboard ? (
              <Link
                key={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                to={dashboardPath}
              >
                <span className="sidebar-dot" />
                {item.label}
              </Link>
            ) : (
              <a key={item.href} className="sidebar-link" href={`#${item.href}`}>
                <span className="sidebar-dot" />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <div className="user-avatar">{initials}</div>
          <div>
            <strong>{user?.nombre || "Usuario"}</strong>
            <span>{user?.rol || "ROL"}</span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="d-flex align-items-center gap-3">
            <span className="topbar-menu" aria-hidden="true">=</span>
            <div>
              {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
              <h1 className="topbar-title">{title}</h1>
            </div>
          </div>

          <div className="topbar-user">
            <div className="user-avatar soft">{initials}</div>
            <div className="d-none d-sm-block text-end">
              <strong>{user?.nombre || "Usuario"}</strong>
              <span>{user?.rol || "ROL"}</span>
            </div>
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={logout}>
              Cerrar sesion
            </button>
          </div>
        </header>

        <main className="content-area container-fluid">{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;
