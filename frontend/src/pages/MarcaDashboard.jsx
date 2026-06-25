import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout.jsx";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";

const initialSucursalForm = {
  nombre: "",
  ciudad: "",
  region: "",
  direccion: "",
  admin_nombre: "",
  admin_email: "",
  admin_password: ""
};

function MarcaDashboard() {
  const [sucursales, setSucursales] = useState([]);
  const [isLoadingSucursales, setIsLoadingSucursales] = useState(true);
  const [sucursalError, setSucursalError] = useState("");
  const [sucursalSuccess, setSucursalSuccess] = useState("");
  const [sucursalFormError, setSucursalFormError] = useState("");
  const [updatingSucursalId, setUpdatingSucursalId] = useState(null);
  const [isCreatingSucursal, setIsCreatingSucursal] = useState(false);
  const [isSucursalFormOpen, setIsSucursalFormOpen] = useState(false);
  const [sucursalForm, setSucursalForm] = useState(initialSucursalForm);

  async function loadSucursales() {
    setIsLoadingSucursales(true);
    setSucursalError("");

    try {
      const response = await api.get("/sucursales");
      setSucursales(response.data.sucursales || []);
    } catch (requestError) {
      setSucursalError(
        requestError.response?.data?.error ||
          "No se pudieron cargar las sucursales."
      );
    } finally {
      setIsLoadingSucursales(false);
    }
  }

  useEffect(() => {
    loadSucursales();
  }, []);

  function handleSucursalInput(event) {
    const { name, value } = event.target;
    setSucursalForm((current) => ({ ...current, [name]: value }));
  }

  function openSucursalForm() {
    setSucursalFormError("");
    setSucursalSuccess("");
    setIsSucursalFormOpen(true);
  }

  function closeSucursalForm() {
    setSucursalForm(initialSucursalForm);
    setSucursalFormError("");
    setIsSucursalFormOpen(false);
  }

  function validateSucursalForm() {
    if (!sucursalForm.nombre.trim()) {
      return "Nombre sucursal es obligatorio.";
    }

    if (!sucursalForm.ciudad.trim()) {
      return "Ciudad es obligatoria.";
    }

    if (!sucursalForm.region.trim()) {
      return "Region es obligatoria.";
    }

    if (!sucursalForm.admin_nombre.trim()) {
      return "Nombre admin es obligatorio.";
    }

    if (!sucursalForm.admin_email.trim()) {
      return "Correo admin es obligatorio.";
    }

    if (!sucursalForm.admin_password) {
      return "Contrasena temporal es obligatoria.";
    }

    if (sucursalForm.admin_password.length < 6) {
      return "La contrasena temporal debe tener minimo 6 caracteres.";
    }

    return "";
  }

  async function handleCreateSucursal(event) {
    event.preventDefault();
    setSucursalFormError("");
    setSucursalSuccess("");

    const validationError = validateSucursalForm();

    if (validationError) {
      setSucursalFormError(validationError);
      return;
    }

    setIsCreatingSucursal(true);

    try {
      await api.post("/sucursales", {
        nombre: sucursalForm.nombre.trim(),
        ciudad: sucursalForm.ciudad.trim(),
        region: sucursalForm.region.trim(),
        direccion: sucursalForm.direccion.trim(),
        admin_nombre: sucursalForm.admin_nombre.trim(),
        admin_email: sucursalForm.admin_email.trim(),
        admin_password: sucursalForm.admin_password
      });
      await loadSucursales();
      closeSucursalForm();
      setSucursalSuccess("Sucursal y cuenta admin creadas correctamente");
    } catch (requestError) {
      setSucursalFormError(
        requestError.response?.data?.error || "No se pudo crear la sucursal."
      );
    } finally {
      setIsCreatingSucursal(false);
    }
  }

  async function handleSucursalEstado(idSucursal, nextAction) {
    setUpdatingSucursalId(idSucursal);
    setSucursalError("");
    setSucursalSuccess("");

    try {
      await api.put(`/sucursales/${idSucursal}/${nextAction}`);
      await loadSucursales();
      setSucursalSuccess(
        nextAction === "activar"
          ? "Sucursal activada correctamente"
          : "Sucursal desactivada correctamente"
      );
    } catch (requestError) {
      setSucursalError(
        requestError.response?.data?.error ||
          `No se pudo ${nextAction === "activar" ? "activar" : "desactivar"} la sucursal.`
      );
    } finally {
      setUpdatingSucursalId(null);
    }
  }

  const sucursalesActivas = sucursales.filter(
    (sucursal) => sucursal.estado === "ACTIVA"
  ).length;
  const sucursalesInactivas = sucursales.filter(
    (sucursal) => sucursal.estado === "INACTIVA"
  ).length;

  const sucursalColumns = [
    { key: "nombre", label: "Nombre", searchValue: (sucursal) => sucursal.nombre },
    {
      key: "ciudad",
      label: "Ciudad",
      searchValue: (sucursal) => sucursal.ciudad || "Sin ciudad",
      render: (sucursal) => sucursal.ciudad || "Sin ciudad"
    },
    {
      key: "region",
      label: "Region",
      searchValue: (sucursal) => sucursal.region || "Sin region",
      render: (sucursal) => sucursal.region || "Sin region"
    },
    {
      key: "direccion",
      label: "Direccion",
      searchValue: (sucursal) => sucursal.direccion || "Sin direccion",
      render: (sucursal) => sucursal.direccion || "Sin direccion",
      sortable: false
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (sucursal) => sucursal.estado,
      render: (sucursal) => <StatusBadge value={sucursal.estado} />
    },
    {
      key: "acciones",
      label: "Acciones",
      searchable: false,
      sortable: false,
      render: (sucursal) => {
        const isInactive = sucursal.estado === "INACTIVA";
        const action = isInactive ? "activar" : "desactivar";

        return (
          <button
            className={isInactive ? "btn btn-outline-success btn-sm" : "btn btn-outline-danger btn-sm"}
            type="button"
            disabled={updatingSucursalId === sucursal.id_sucursal}
            onClick={() => handleSucursalEstado(sucursal.id_sucursal, action)}
          >
            {isInactive ? "Activar" : "Desactivar"}
          </button>
        );
      }
    }
  ];

  return (
    <AppLayout title="Panel marca" eyebrow="MARCA">
      <section id="dashboard" className="row g-3 mb-4">
        <div className="col-md-4">
          <StatCard title="Sucursales autorizadas" value={sucursales.length} detail="Red registrada" tone="primary" label="SU" />
        </div>
        <div className="col-md-4">
          <StatCard title="Activas" value={sucursalesActivas} detail="Operativas actualmente" tone="success" label="AC" />
        </div>
        <div className="col-md-4">
          <StatCard title="Inactivas" value={sucursalesInactivas} detail="Fuera de operacion" tone="danger" label="IN" />
        </div>
      </section>

      {sucursalSuccess ? <p className="alert alert-success">{sucursalSuccess}</p> : null}

      {isSucursalFormOpen ? (
        <section className="card surface-card border-0 shadow-sm branch-section">
          <div className="card-header bg-white border-0">
            <p className="eyebrow mb-1">Red autorizada</p>
            <h2 className="h5 mb-0">Crear sucursal autorizada</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreateSucursal}>
              <div className="form-section-heading">Datos de sucursal</div>
              <div className="row g-3">
                <div className="col-md-6 col-xl-3">
                  <label className="form-label">Nombre sucursal</label>
                  <input className="form-control" name="nombre" value={sucursalForm.nombre} onChange={handleSucursalInput} placeholder="Servicio Tecnico Valdivia" required />
                </div>
                <div className="col-md-6 col-xl-3">
                  <label className="form-label">Ciudad</label>
                  <input className="form-control" name="ciudad" value={sucursalForm.ciudad} onChange={handleSucursalInput} placeholder="Valdivia" required />
                </div>
                <div className="col-md-6 col-xl-3">
                  <label className="form-label">Region</label>
                  <input className="form-control" name="region" value={sucursalForm.region} onChange={handleSucursalInput} placeholder="Los Rios" required />
                </div>
                <div className="col-md-6 col-xl-3">
                  <label className="form-label">Direccion</label>
                  <input className="form-control" name="direccion" value={sucursalForm.direccion} onChange={handleSucursalInput} placeholder="Av. Principal 123" />
                </div>
              </div>

              <div className="form-section-heading mt-4">Admin inicial</div>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Nombre admin</label>
                  <input className="form-control" name="admin_nombre" value={sucursalForm.admin_nombre} onChange={handleSucursalInput} placeholder="Admin Valdivia" required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Correo admin</label>
                  <input className="form-control" name="admin_email" type="email" value={sucursalForm.admin_email} onChange={handleSucursalInput} placeholder="admin.valdivia@serialcare.cl" required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Contrasena temporal</label>
                  <input className="form-control" name="admin_password" type="password" minLength="6" value={sucursalForm.admin_password} onChange={handleSucursalInput} placeholder="Admin123" required />
                </div>
              </div>

              {sucursalFormError ? <p className="alert alert-danger mt-3 mb-0">{sucursalFormError}</p> : null}

              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-primary" type="submit" disabled={isCreatingSucursal}>
                  {isCreatingSucursal ? "Creando..." : "Crear sucursal y admin"}
                </button>
                <button className="btn btn-outline-secondary" type="button" disabled={isCreatingSucursal} onClick={closeSucursalForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <DataTable
        sectionId="sucursales"
        eyebrow="Red autorizada"
        title="Sucursales autorizadas"
        rows={sucursales}
        columns={sucursalColumns}
        getRowKey={(sucursal) => sucursal.id_sucursal}
        searchPlaceholder="Buscar por nombre, ciudad, region o direccion"
        emptyMessage="No hay sucursales registradas."
        loading={isLoadingSucursales}
        loadingMessage="Cargando sucursales..."
        error={sucursalError}
        initialSortKey="nombre"
        toolbarAction={{
          label: isSucursalFormOpen ? "Cancelar" : "+ Agregar sucursal",
          className: isSucursalFormOpen ? "btn btn-outline-secondary" : "btn btn-primary",
          onClick: isSucursalFormOpen ? closeSucursalForm : openSucursalForm
        }}
      />
    </AppLayout>
  );
}

export default MarcaDashboard;