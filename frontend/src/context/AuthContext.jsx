import { createContext, useContext, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const roleRoutes = {
  ADMIN: "/admin",
  TECNICO: "/tecnico",
  CLIENTE: "/cliente",
  MARCA: "/marca"
};

export function getDashboardPath(role) {
  return roleRoutes[role] || "/login";
}

function getStoredUser() {
  const storedUser = localStorage.getItem("usuario");

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch (error) {
    localStorage.removeItem("usuario");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(getStoredUser);

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    const { token: nextToken, usuario } = response.data;

    localStorage.setItem("token", nextToken);
    localStorage.setItem("usuario", JSON.stringify(usuario));
    setToken(nextToken);
    setUser(usuario);

    return usuario;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      logout
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
