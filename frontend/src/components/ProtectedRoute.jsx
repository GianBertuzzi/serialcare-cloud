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
      <main className="auth-page">
        <section className="card auth-card border-0 shadow-sm">
          <div className="card-body p-4">
            <p className="eyebrow mb-1">Acceso denegado</p>
            <h1 className="h3">Vista no disponible para tu rol</h1>
            <p className="text-secondary mb-0">Tu cuenta no tiene permisos para esta seccion.</p>
          </div>
        </section>
      </main>
    );
  }

  return children;
}

export default ProtectedRoute;
