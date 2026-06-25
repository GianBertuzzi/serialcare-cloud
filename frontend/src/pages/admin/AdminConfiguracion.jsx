import AppLayout from "../../components/AppLayout.jsx";

function AdminConfiguracion() {
  return (
    <AppLayout title="Configuracion" eyebrow="ADMIN">
      <section className="card surface-card border-0 shadow-sm">
        <div className="card-body">
          <h2 className="h5">Configuracion de sucursal</h2>
          <p className="text-secondary mb-0">Modulo reservado para parametros locales de operacion. Los precios operativos se administran en Tipos de maquina.</p>
        </div>
      </section>
    </AppLayout>
  );
}

export default AdminConfiguracion;