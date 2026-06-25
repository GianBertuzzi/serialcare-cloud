import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminOrdenes from "./pages/admin/AdminOrdenes.jsx";
import AdminProductos from "./pages/admin/AdminProductos.jsx";
import AdminClientes from "./pages/admin/AdminClientes.jsx";
import AdminModelosPrecios from "./pages/admin/AdminModelosPrecios.jsx";
import AdminRepuestos from "./pages/admin/AdminRepuestos.jsx";
import AdminTecnicos from "./pages/admin/AdminTecnicos.jsx";
import AdminGarantias from "./pages/admin/AdminGarantias.jsx";
import AdminConfiguracion from "./pages/admin/AdminConfiguracion.jsx";
import TecnicoDashboard from "./pages/TecnicoDashboard.jsx";
import TecnicoOrdenes from "./pages/tecnico/TecnicoOrdenes.jsx";
import TecnicoConsultaPage from "./pages/tecnico/TecnicoConsultaPage.jsx";
import TecnicoConfiguracion from "./pages/tecnico/TecnicoConfiguracion.jsx";
import ClienteDashboard from "./pages/ClienteDashboard.jsx";
import MarcaDashboard from "./pages/MarcaDashboard.jsx";
import MarcaSucursales from "./pages/marca/MarcaSucursales.jsx";
import ConsultaPublica from "./pages/ConsultaPublica.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/consulta-publica" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/consulta-publica" element={<ConsultaPublica />} />

      <Route path="/admin" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/ordenes" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminOrdenes /></ProtectedRoute>} />
      <Route path="/admin/productos" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminProductos /></ProtectedRoute>} />
      <Route path="/admin/clientes" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminClientes /></ProtectedRoute>} />
      <Route path="/admin/modelos-precios" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminModelosPrecios /></ProtectedRoute>} />
      <Route path="/admin/repuestos" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminRepuestos /></ProtectedRoute>} />
      <Route path="/admin/tecnicos" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminTecnicos /></ProtectedRoute>} />
      <Route path="/admin/garantias" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminGarantias /></ProtectedRoute>} />
      <Route path="/admin/configuracion" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminConfiguracion /></ProtectedRoute>} />

      <Route path="/tecnico" element={<ProtectedRoute allowedRoles={["TECNICO"]}><TecnicoDashboard /></ProtectedRoute>} />
      <Route path="/tecnico/ordenes" element={<ProtectedRoute allowedRoles={["TECNICO"]}><TecnicoOrdenes /></ProtectedRoute>} />
      <Route path="/tecnico/productos" element={<ProtectedRoute allowedRoles={["TECNICO"]}><TecnicoConsultaPage type="productos" /></ProtectedRoute>} />
      <Route path="/tecnico/clientes" element={<ProtectedRoute allowedRoles={["TECNICO"]}><TecnicoConsultaPage type="clientes" /></ProtectedRoute>} />
      <Route path="/tecnico/repuestos" element={<ProtectedRoute allowedRoles={["TECNICO"]}><TecnicoConsultaPage type="repuestos" /></ProtectedRoute>} />
      <Route path="/tecnico/garantias" element={<ProtectedRoute allowedRoles={["TECNICO"]}><TecnicoConsultaPage type="garantias" /></ProtectedRoute>} />
      <Route path="/tecnico/configuracion" element={<ProtectedRoute allowedRoles={["TECNICO"]}><TecnicoConfiguracion /></ProtectedRoute>} />

      <Route path="/cliente" element={<ProtectedRoute allowedRoles={["CLIENTE"]}><ClienteDashboard /></ProtectedRoute>} />

      <Route path="/marca" element={<ProtectedRoute allowedRoles={["MARCA"]}><MarcaDashboard /></ProtectedRoute>} />
      <Route path="/marca/sucursales" element={<ProtectedRoute allowedRoles={["MARCA"]}><MarcaSucursales /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/consulta-publica" replace />} />
    </Routes>
  );
}

export default App;