import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import TecnicoDashboard from "./pages/TecnicoDashboard.jsx";
import ClienteDashboard from "./pages/ClienteDashboard.jsx";
import MarcaDashboard from "./pages/MarcaDashboard.jsx";
import ConsultaPublica from "./pages/ConsultaPublica.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/consulta-publica" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/consulta-publica" element={<ConsultaPublica />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tecnico"
        element={
          <ProtectedRoute allowedRoles={["TECNICO"]}>
            <TecnicoDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cliente"
        element={
          <ProtectedRoute allowedRoles={["CLIENTE"]}>
            <ClienteDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/marca"
        element={
          <ProtectedRoute allowedRoles={["MARCA"]}>
            <MarcaDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/consulta-publica" replace />} />
    </Routes>
  );
}

export default App;
