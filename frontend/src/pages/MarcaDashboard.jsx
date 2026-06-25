import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout.jsx";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";

function formatDate(value) {
  if (!value) {
    return "Sin revision";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha invalida";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

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
  const [garantias, setGarantias] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [isLoadingGarantias, setIsLoadingGarantias] = useState(true);
  const [isLoadingSucursales, setIsLoadingSucursales] = useState(true);
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true);
  const [error, setError] = useState("");
  const [sucursalError, setSucursalError] = useState("");
  const [sucursalSuccess, setSucursalSuccess] = useState("");
  const [sucursalFormError, setSucursalFormError] = useState("");
  const [ordenesError, setOrdenesError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingSucursalId, setUpdatingSucursalId] = useState(null);
  const [isCreatingSucursal, setIsCreatingSucursal] = useState(false);
  const [isSucursalFormOpen, setIsSucursalFormOpen] = useState(false);
  const [sucursalForm, setSucursalForm] = useState(initialSucursalForm);
  const [detalleGarantia, setDetalleGarantia] = useState(null);

  async function loadGarantias() {
    setIsLoadingGarantias(true);
    setError("");

    try {
      const response = await api.get("/garantias");
      setGarantias(response.data.garantias || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudieron cargar las garantias."
      );
    } finally {
      setIsLoadingGarantias(false);
    }
  }

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

  async function loadOrdenes() {
    setIsLoadingOrdenes(true);
    setOrdenesError("");

    try {
      const response = await api.get("/ordenes");
      setOrdenes(response.data.ordenes || []);
    } catch (requestError) {
      setOrdenesError(
        requestError.response?.data?.error ||
          "No se pudieron cargar las ordenes generales."
      );
    } finally {
      setIsLoadingOrdenes(false);
    }
  }

  useEffect(() => {
    loadGarantias();
    loadSucursales();
    loadOrdenes();
  }, []);

  async function updateGarantia(idGarantia, action) {
    setUpdatingId(idGarantia);
    setError("");

    const observacionMarca = window.prompt(
      "Observacion de marca (opcional)",
      action === "aprobar" ? "Garantia aprobada" : "Garantia rechazada"
    );

    try {
      await api.put(
        `/garantias/${idGarantia}/${action}`,
        observacionMarca ? { observacion_marca: observacionMarca } : {}
      );
      setDetalleGarantia(null);
      await loadGarantias();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo actualizar la solicitud de garantia."
      );
    } finally {
      setUpdatingId(null);
    }
  }

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

  async function handleDesactivarSucursal(idSucursal) {
    setUpdatingSucursalId(idSucursal);
    setSucursalError("");

    try {
      await api.put(`/sucursales/${idSucursal}/desactivar`);
      await loadSucursales();
    } catch (requestError) {
      setSucursalError(
        requestError.response?.data?.error ||
          "No se pudo desactivar la sucursal."
      );
    } finally {
      setUpdatingSucursalId(null);
    }
  }

  function getGarantiaRepuestos(garantia) {
    return Array.isArray(garantia?.repuestos_usados)
      ? garantia.repuestos_usados
      : [];
  }

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
      render: (sucursal) => (
        <button
          className="btn btn-outline-danger btn-sm"
          type="button"
          disabled={sucursal.estado === "INACTIVA" || updatingSucursalId === sucursal.id_sucursal}
          onClick={() => handleDesactivarSucursal(sucursal.id_sucursal)}
        >
          Desactivar
        </button>
      )
    }
  ];

  const ordenColumns = [
    { key: "id_orden", label: "ID", searchValue: (orden) => orden.id_orden, sortValue: (orden) => Number(orden.id_orden || 0) },
    {
      key: "nombre_sucursal",
      label: "Sucursal",
      searchValue: (orden) => orden.nombre_sucursal || "Sin sucursal",
      render: (orden) => orden.nombre_sucursal || "Sin sucursal"
    },
    { key: "numero_serie", label: "Serie", searchValue: (orden) => orden.numero_serie },
    {
      key: "modelo",
      label: "Modelo",
      searchValue: (orden) => `${orden.descripcion_modelo || ""} ${orden.modelo || ""} ${orden.cliente_nombre || ""}`,
      render: (orden) => orden.descripcion_modelo || orden.modelo
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (orden) => orden.estado,
      render: (orden) => <StatusBadge value={orden.estado} />
    },
    {
      key: "valor_revision",
      label: "Valor revision",
      searchValue: (orden) => orden.valor_revision,
      sortValue: (orden) => Number(orden.valor_revision || 0),
      render: (orden) => formatCurrency(orden.valor_revision)
    },
    {
      key: "fecha_creacion",
      label: "Fecha",
      searchValue: (orden) => formatDate(orden.fecha_creacion),
      sortValue: (orden) => orden.fecha_creacion,
      render: (orden) => formatDate(orden.fecha_creacion)
    }
  ];

  const garantiaColumns = [
    {
      key: "id_garantia",
      label: "ID",
      searchValue: (garantia) => garantia.id_garantia,
      sortValue: (garantia) => Number(garantia.id_garantia || 0)
    },
    {
      key: "nombre_sucursal",
      label: "Sucursal",
      searchValue: (garantia) => garantia.nombre_sucursal || "Sin sucursal",
      render: (garantia) => garantia.nombre_sucursal || "Sin sucursal"
    },
    {
      key: "id_orden",
      label: "Orden",
      searchValue: (garantia) => garantia.id_orden,
      sortValue: (garantia) => Number(garantia.id_orden || 0),
      render: (garantia) => `#${garantia.id_orden || "-"}`
    },
    {
      key: "numero_serie",
      label: "Producto",
      searchValue: (garantia) => `${garantia.numero_serie || ""} ${garantia.marca || ""} ${garantia.modelo || ""}`,
      render: (garantia) => (
        <>
          <strong>{garantia.numero_serie || "Sin serie"}</strong>
          <span className="table-subtext">
            {[garantia.marca, garantia.modelo].filter(Boolean).join(" - ") || "Sin producto"}
          </span>
        </>
      )
    },
    {
      key: "tecnico",
      label: "Tecnico",
      searchValue: (garantia) => `${garantia.tecnico || ""} ${garantia.tecnico_email || ""}`,
      render: (garantia) => (
        <>
          {garantia.tecnico || "Sin tecnico"}
          {garantia.tecnico_email ? <span className="table-subtext">{garantia.tecnico_email}</span> : null}
        </>
      )
    },
    {
      key: "diagnostico",
      label: "Diagnostico",
      searchValue: (garantia) => garantia.diagnostico || "Sin diagnostico",
      render: (garantia) => garantia.diagnostico || "Sin diagnostico"
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (garantia) => garantia.estado,
      render: (garantia) => <StatusBadge value={garantia.estado} />
    },
    {
      key: "repuestos_usados",
      label: "Repuestos",
      searchValue: (garantia) => getGarantiaRepuestos(garantia).map((repuesto) => repuesto.nombre_repuesto).join(" "),
      sortable: false,
      render: (garantia) => {
        const repuestos = getGarantiaRepuestos(garantia);

        return (
          <div className="table-actions">
            <span className="table-subtext mb-0">{repuestos.length} registrados</span>
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setDetalleGarantia(garantia)}>
              Ver detalle
            </button>
          </div>
        );
      }
    },
    {
      key: "fecha_solicitud",
      label: "Solicitud",
      searchValue: (garantia) => formatDate(garantia.fecha_solicitud),
      sortValue: (garantia) => garantia.fecha_solicitud,
      render: (garantia) => formatDate(garantia.fecha_solicitud)
    },
    {
      key: "fecha_revision",
      label: "Revision marca",
      searchValue: (garantia) => formatDate(garantia.fecha_revision),
      sortValue: (garantia) => garantia.fecha_revision,
      render: (garantia) => formatDate(garantia.fecha_revision)
    },
    {
      key: "acciones",
      label: "Acciones",
      searchable: false,
      sortable: false,
      render: (garantia) => (
        <div className="table-actions">
          <button className="btn btn-success btn-sm" type="button" disabled={updatingId === garantia.id_garantia} onClick={() => updateGarantia(garantia.id_garantia, "aprobar")}>
            Aprobar
          </button>
          <button className="btn btn-outline-danger btn-sm" type="button" disabled={updatingId === garantia.id_garantia} onClick={() => updateGarantia(garantia.id_garantia, "rechazar")}>
            Rechazar
          </button>
        </div>
      )
    }
  ];
  return (
    <AppLayout title="Panel marca" eyebrow="MARCA">
      <section id="dashboard" className="row g-3 mb-4">
        <div className="col-md-4">
          <StatCard title="Sucursales autorizadas" value={sucursales.length} detail="Servicios tecnicos registrados" tone="primary" label="SU" />
        </div>
        <div className="col-md-4">
          <StatCard title="Garantias pendientes" value={garantias.filter((garantia) => garantia.estado === "PENDIENTE").length} detail="Solicitudes por resolver" tone="warning" label="GA" />
        </div>
        <div className="col-md-4">
          <StatCard title="Ordenes generales" value={ordenes.length} detail="Red autorizada" tone="success" label="OS" />
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

              <div className="form-section-heading mt-4">Admin inicial de sucursal</div>
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

      <DataTable
        sectionId="ordenes"
        eyebrow="Operacion"
        title="Ordenes generales"
        rows={ordenes}
        columns={ordenColumns}
        getRowKey={(orden) => orden.id_orden}
        searchPlaceholder="Buscar por sucursal, serie, cliente o estado"
        emptyMessage="No hay ordenes registradas."
        loading={isLoadingOrdenes}
        loadingMessage="Cargando ordenes..."
        error={ordenesError}
        initialSortKey="nombre_sucursal"
      />

      {detalleGarantia ? (
        <section className="card surface-card border-0 shadow-sm warranty-detail-section mb-4">
          <div className="card-header bg-white border-0 d-flex flex-wrap justify-content-between gap-3">
            <div>
              <p className="eyebrow mb-1">Garantia #{detalleGarantia.id_garantia}</p>
              <h2 className="h5 mb-0">Detalle de solicitud</h2>
              <span className="table-subtext">
                Orden #{detalleGarantia.id_orden} - {detalleGarantia.nombre_sucursal || "Sin sucursal"}
              </span>
            </div>
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setDetalleGarantia(null)}>
              Cerrar detalle
            </button>
          </div>
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <span className="detail-label">Producto</span>
                <strong className="d-block">{detalleGarantia.numero_serie || "Sin serie"}</strong>
                <span className="table-subtext">{[detalleGarantia.marca, detalleGarantia.modelo].filter(Boolean).join(" - ")}</span>
              </div>
              <div className="col-md-4">
                <span className="detail-label">Tecnico</span>
                <strong className="d-block">{detalleGarantia.tecnico || "Sin tecnico"}</strong>
                <span className="table-subtext">{detalleGarantia.tecnico_email || "Sin correo"}</span>
              </div>
              <div className="col-md-4">
                <span className="detail-label">Estado</span>
                <div><StatusBadge value={detalleGarantia.estado} /></div>
              </div>
            </div>

            <p className="mb-2"><strong>Diagnostico:</strong> {detalleGarantia.diagnostico || "Sin diagnostico"}</p>
            <p className="mb-2"><strong>Solicitud sucursal:</strong> {detalleGarantia.observacion || "Sin observacion"}</p>
            {detalleGarantia.observacion_marca ? (
              <p className="mb-3"><strong>Respuesta marca:</strong> {detalleGarantia.observacion_marca}</p>
            ) : null}

            {getGarantiaRepuestos(detalleGarantia).length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm align-middle serial-table mb-0">
                  <thead>
                    <tr>
                      <th>Repuesto</th>
                      <th>Cantidad</th>
                      <th>Precio unitario</th>
                      <th>Cubierto</th>
                      <th>Observacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getGarantiaRepuestos(detalleGarantia).map((repuesto) => (
                      <tr key={repuesto.id_repuesto_usado}>
                        <td>{repuesto.nombre_repuesto}</td>
                        <td>{repuesto.cantidad}</td>
                        <td>{formatCurrency(repuesto.precio_unitario)}</td>
                        <td>{repuesto.cubierto_garantia ? "Si" : "No"}</td>
                        <td>{repuesto.observacion || "Sin observacion"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state mb-0">No hay repuestos registrados para esta orden.</p>
            )}
          </div>
        </section>
      ) : null}
      <DataTable
        sectionId="garantias"
        eyebrow="Garantias"
        title="Solicitudes de garantia"
        rows={garantias}
        columns={garantiaColumns}
        getRowKey={(garantia) => garantia.id_garantia}
        searchPlaceholder="Buscar por sucursal, orden, serie, marca, modelo, tecnico o estado"
        emptyMessage="No hay garantias registradas."
        loading={isLoadingGarantias}
        loadingMessage="Cargando garantias..."
        error={error}
        initialSortKey="id_garantia"
        toolbarAction={{
          label: "Consulta publica",
          className: "btn btn-outline-secondary",
          onClick: () => window.location.assign("/consulta-publica")
        }}
      />
    </AppLayout>
  );
}

export default MarcaDashboard;
