import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { getDashboardPath, useAuth } from "../context/AuthContext.jsx";

const menuByRole = {
  MARCA: [
    { label: "Dashboard", to: "/marca" },
    { label: "Sucursales", to: "/marca/sucursales" }
  ],
  ADMIN: [
    { label: "Dashboard", to: "/admin" },
    { label: "Ordenes de servicio", to: "/admin/ordenes" },
    { label: "Productos", to: "/admin/productos" },
    { label: "Clientes", to: "/admin/clientes" },
    { label: "Tipos de maquina", to: "/admin/modelos-precios" },
    { label: "Repuestos", to: "/admin/repuestos" },
    { label: "Tecnicos", to: "/admin/tecnicos" },
    { label: "Garantias", to: "/admin/garantias" },
    { label: "Configuracion", to: "/admin/configuracion" }
  ],
  TECNICO: [
    { label: "Dashboard", to: "/tecnico" },
    { label: "Ordenes asignadas", to: "/tecnico/ordenes" },
    { label: "Productos", to: "/tecnico/productos" },
    { label: "Clientes", to: "/tecnico/clientes" },
    { label: "Repuestos", to: "/tecnico/repuestos" },
    { label: "Garantias", to: "/tecnico/garantias" },
    { label: "Configuracion", to: "/tecnico/configuracion" }
  ],
  CLIENTE: [
    { label: "Dashboard", to: "/cliente" },
    { label: "Consulta publica", to: "/consulta-publica" }
  ]
};

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
  const [collapsed, setCollapsed] = useState(false);
  const dashboardPath = getDashboardPath(user?.rol);
  const initials = getInitials(user?.nombre || user?.email || "SC");
  const navItems = menuByRole[user?.rol] || [{ label: "Dashboard", to: dashboardPath }];

  return (
    <div className={`app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">SC</div>
          <div className="sidebar-brand-text">
            <strong>SerialCare</strong>
            <span>Cloud</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegacion principal">
          <p className="sidebar-label">Navegacion</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              end={item.to === dashboardPath}
              to={item.to}
            >
              <span className="sidebar-dot" />
              <span className="sidebar-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account">
          <div className="user-avatar">{initials}</div>
          <div className="sidebar-account-text">
            <strong>{user?.nombre || "Usuario"}</strong>
            <span>{user?.nombre_sucursal || user?.rol || "ROL"}</span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="d-flex align-items-center gap-3 min-w-0">
            <button
              className="topbar-menu"
              type="button"
              aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
              onClick={() => setCollapsed((current) => !current)}
            >
              =
            </button>
            <div className="min-w-0">
              {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
              <h1 className="topbar-title">{title}</h1>
            </div>
          </div>

          <div className="topbar-user">
            <div className="user-avatar soft">{initials}</div>
            <div className="d-none d-sm-block text-end">
              <strong>{user?.nombre || "Usuario"}</strong>
              <span>{user?.nombre_sucursal || user?.rol || "ROL"}</span>
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