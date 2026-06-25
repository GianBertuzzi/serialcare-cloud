import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getDashboardPath, useAuth } from "../context/AuthContext.jsx";

function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={getDashboardPath(user?.rol)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const usuario = await login(email, password);
      navigate(getDashboardPath(usuario.rol), { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo iniciar sesion. Revisa tus credenciales."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card card border-0 shadow-sm">
        <div className="card-body p-4 p-md-5">
          <div className="brand-block mb-4">
            <div className="sidebar-brand auth-brand mb-3">
              <div className="brand-mark">SC</div>
              <div>
                <strong>SerialCare</strong>
                <span>Cloud</span>
              </div>
            </div>
            <p className="eyebrow mb-1">Acceso privado</p>
            <h1 className="display-title mb-2">Iniciar sesion</h1>
            <p className="text-secondary mb-0">Gestion postventa, garantias y servicio tecnico.</p>
          </div>

          <form className="d-grid gap-3" onSubmit={handleSubmit}>
            <div>
              <label className="form-label">Correo</label>
              <input
                className="form-control form-control-lg"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@serialcare.cl"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <input
                className="form-control form-control-lg"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
            </div>

            {error ? <p className="alert alert-danger mb-0">{error}</p> : null}

            <button className="btn btn-primary btn-lg" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <Link className="btn btn-link px-0 mt-3" to="/consulta-publica">
            Consulta publica por numero de serie
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Login;
