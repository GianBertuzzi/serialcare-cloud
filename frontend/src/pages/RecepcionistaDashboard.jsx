import AppLayout from "../components/AppLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function RecepcionistaDashboard() {
  const { user } = useAuth();

  return (
    <AppLayout title="Recepción y seguimiento" eyebrow="RECEPCIONISTA">
      <section className="row g-3">
        <div className="col-lg-8 col-xl-7">
          <section className="card surface-card border-0 shadow-sm">
            <div className="card-body p-4">
              <p className="eyebrow mb-2">Área de atención</p>
              <h2 className="h4 mb-2">Bienvenido, {user?.nombre || "Recepcionista"}</h2>
              <p className="text-secondary mb-4">
                Sucursal: {user?.nombre_sucursal || "Sin sucursal asignada"}
              </p>
              <div className="alert alert-primary mb-0" role="status">
                Esta área administrará la recepción de máquinas, su seguimiento y la entrega
                al cliente.
              </div>
            </div>
          </section>
        </div>
      </section>
    </AppLayout>
  );
}

export default RecepcionistaDashboard;
