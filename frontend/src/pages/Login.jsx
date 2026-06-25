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
      <section className="auth-panel">
        <div className="brand-block">
          <p className="eyebrow">SerialCare Cloud</p>
          <h1>Iniciar sesion</h1>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Correo
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@serialcare.cl"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="alert error-alert">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <Link className="text-link" to="/consulta-publica">
          Consulta publica por numero de serie
        </Link>
      </section>
    </main>
  );
}

export default Login;
