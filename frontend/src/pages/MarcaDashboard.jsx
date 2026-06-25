import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
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
  direccion: ""
};

function MarcaDashboard() {
  const { logout, user } = useAuth();
  const [garantias, setGarantias] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [isLoadingGarantias, setIsLoadingGarantias] = useState(true);
  const [isLoadingSucursales, setIsLoadingSucursales] = useState(true);
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true);
  const [error, setError] = useState("");
  const [sucursalError, setSucursalError] = useState("");
  const [ordenesError, setOrdenesError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingSucursalId, setUpdatingSucursalId] = useState(null);
  const [isCreatingSucursal, setIsCreatingSucursal] = useState(false);
  const [isSucursalFormOpen, setIsSucursalFormOpen] = useState(false);
  const [sucursalForm, setSucursalForm] = useState(initialSucursalForm);

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

    try {
      await api.put(`/garantias/${idGarantia}/${action}`);
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

  function closeSucursalForm() {
    setSucursalForm(initialSucursalForm);
    setIsSucursalFormOpen(false);
  }

  async function handleCreateSucursal(event) {
    event.preventDefault();
    setIsCreatingSucursal(true);
    setSucursalError("");

    try {
      await api.post("/sucursales", sucursalForm);
      await loadSucursales();
      closeSucursalForm();
    } catch (requestError) {
      setSucursalError(
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

  const sucursalColumns = [
    {
      key: "nombre",
      label: "Nombre",
      searchValue: (sucursal) => sucursal.nombre
    },
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
          className="reject-button"
          type="button"
          disabled={
            sucursal.estado === "INACTIVA" ||
            updatingSucursalId === sucursal.id_sucursal
          }
          onClick={() => handleDesactivarSucursal(sucursal.id_sucursal)}
        >
          Desactivar
        </button>
      )
    }
  ];

  const ordenColumns = [
    {
      key: "id_orden",
      label: "ID",
      searchValue: (orden) => orden.id_orden,
      sortValue: (orden) => Number(orden.id_orden || 0)
    },
    {
      key: "nombre_sucursal",
      label: "Sucursal",
      searchValue: (orden) => orden.nombre_sucursal || "Sin sucursal",
      render: (orden) => orden.nombre_sucursal || "Sin sucursal"
    },
    {
      key: "numero_serie",
      label: "Serie",
      searchValue: (orden) => orden.numero_serie
    },
    {
      key: "modelo",
      label: "Modelo",
      searchValue: (orden) =>
        `${orden.descripcion_modelo || ""} ${orden.modelo || ""} ${orden.cliente_nombre || ""}`,
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
      key: "numero_serie",
      label: "Numero de serie",
      searchValue: (garantia) => garantia.numero_serie || "Sin serie",
      render: (garantia) => garantia.numero_serie || "Sin serie"
    },
    {
      key: "marca",
      label: "Marca",
      searchValue: (garantia) => garantia.marca
    },
    {
      key: "modelo",
      label: "Modelo",
      searchValue: (garantia) => garantia.modelo
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (garantia) => garantia.estado,
      render: (garantia) => <StatusBadge value={garantia.estado} />
    },
    {
      key: "observacion",
      label: "Observacion",
      searchValue: (garantia) => garantia.observacion || "Sin observacion",
      sortable: false,
      render: (garantia) => garantia.observacion || "Sin observacion"
    },
    {
      key: "fecha_revision",
      label: "Fecha revision",
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
          <button
            className="approve-button"
            type="button"
            disabled={updatingId === garantia.id_garantia}
            onClick={() => updateGarantia(garantia.id_garantia, "aprobar")}
          >
            Aprobar
          </button>
          <button
            className="reject-button"
            type="button"
            disabled={updatingId === garantia.id_garantia}
            onClick={() => updateGarantia(garantia.id_garantia, "rechazar")}
          >
            Rechazar
          </button>
        </div>
      )
    }
  ];

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">MARCA</p>
          <h1>Panel marca</h1>
          <p className="muted">{user?.nombre}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Garantias pendientes</h2>
          <p>
            {garantias.filter((garantia) => garantia.estado === "PENDIENTE").length} solicitudes pendientes.
          </p>
        </article>
        <article className="panel">
          <h2>Sucursales autorizadas</h2>
          <p>{sucursales.length} servicios tecnicos registrados.</p>
        </article>
        <article className="panel">
          <h2>Ordenes generales</h2>
          <p>{ordenes.length} ordenes visibles en la red autorizada.</p>
        </article>
      </section>

      {isSucursalFormOpen ? (
        <section className="panel dashboard-table-section branch-section">
          <div className="table-header">
            <div>
              <p className="eyebrow">Red autorizada</p>
              <h2>Crear sucursal autorizada</h2>
            </div>
          </div>

          <form className="branch-form" onSubmit={handleCreateSucursal}>
            <label>
              Nombre
              <input
                name="nombre"
                value={sucursalForm.nombre}
                onChange={handleSucursalInput}
                placeholder="Servicio Tecnico Valdivia"
                required
              />
            </label>
            <label>
              Ciudad
              <input
                name="ciudad"
                value={sucursalForm.ciudad}
                onChange={handleSucursalInput}
                placeholder="Valdivia"
              />
            </label>
            <label>
              Region
              <input
                name="region"
                value={sucursalForm.region}
                onChange={handleSucursalInput}
                placeholder="Los Rios"
              />
            </label>
            <label>
              Direccion
              <input
                name="direccion"
                value={sucursalForm.direccion}
                onChange={handleSucursalInput}
                placeholder="Av. Principal 100"
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isCreatingSucursal}>
                {isCreatingSucursal ? "Creando..." : "Crear sucursal"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={isCreatingSucursal}
                onClick={closeSucursalForm}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <DataTable
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
          className: isSucursalFormOpen ? "secondary-button" : "primary-button",
          onClick: isSucursalFormOpen
            ? closeSucursalForm
            : () => setIsSucursalFormOpen(true)
        }}
      />

      <DataTable
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

      <DataTable
        eyebrow="Garantias"
        title="Solicitudes de garantia"
        rows={garantias}
        columns={garantiaColumns}
        getRowKey={(garantia) => garantia.id_garantia}
        searchPlaceholder="Buscar por serie, marca, modelo o estado"
        emptyMessage="No hay garantias registradas."
        loading={isLoadingGarantias}
        loadingMessage="Cargando garantias..."
        error={error}
        initialSortKey="id_garantia"
        toolbarAction={{
          label: "Consulta publica",
          className: "secondary-button",
          onClick: () => window.location.assign("/consulta-publica")
        }}
      />
    </main>
  );
}

export default MarcaDashboard;

