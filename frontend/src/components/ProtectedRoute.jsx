import { Navigate, useLocation } from "react-router-dom";
import { getDashboardPath, useAuth } from "../context/AuthContext.jsx";

function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const userRole = user?.rol;

  if (allowedRoles?.length && !allowedRoles.includes(userRole)) {
    const fallbackPath = getDashboardPath(userRole);

    if (fallbackPath !== "/login" && fallbackPath !== location.pathname) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <main className="page-shell">
        <section className="panel compact-panel">
          <p className="eyebrow">Acceso denegado</p>
          <h1>Vista no disponible para tu rol</h1>
          <p className="muted">Tu cuenta no tiene permisos para esta seccion.</p>
        </section>
      </main>
    );
  }

  return children;
}

export default ProtectedRoute;
