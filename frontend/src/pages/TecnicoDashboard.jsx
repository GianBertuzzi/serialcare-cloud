import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout.jsx";
import DataTable from "../components/DataTable.jsx";
import NewOrderForm from "../components/NewOrderForm.jsx";
import OrdenDetalleModal from "../components/OrdenDetalleModal.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";

const ESTADOS_ORDEN = ["PENDIENTE", "EN_DIAGNOSTICO", "REPARADA", "CERRADA"];

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
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

function TecnicoDashboard() {
  const [ordenes, setOrdenes] = useState([]);
  const [garantias, setGarantias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGarantias, setIsLoadingGarantias] = useState(true);
  const [error, setError] = useState("");
  const [garantiasError, setGarantiasError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  async function loadOrdenes() {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get("/ordenes");
      setOrdenes(response.data.ordenes || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudieron cargar las ordenes de servicio."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadGarantias() {
    setIsLoadingGarantias(true);
    setGarantiasError("");

    try {
      const response = await api.get("/garantias");
      setGarantias(response.data.garantias || []);
    } catch (requestError) {
      setGarantiasError(
        requestError.response?.data?.error ||
          "No se pudieron cargar las solicitudes de garantia."
      );
    } finally {
      setIsLoadingGarantias(false);
    }
  }

  useEffect(() => {
    loadOrdenes();
    loadGarantias();
  }, []);

  function openOrderForm() {
    setOrderSuccess("");
    setIsOrderFormOpen(true);
  }

  function closeOrderForm() {
    setIsOrderFormOpen(false);
  }

  async function handleOrderCreated() {
    setIsOrderFormOpen(false);
    setOrderSuccess("Orden creada correctamente.");
    await loadOrdenes();
  }
  function openOrderDetail(orden) {
    setOrderSuccess("");
    setSelectedDetailOrder(orden);
  }

  function closeOrderDetail() {
    setSelectedDetailOrder(null);
  }

  async function handleOrderDetailUpdated(message) {
    if (message) {
      setOrderSuccess(message);
    }

    await loadOrdenes();
    await loadGarantias();
  }
  async function handleEstadoChange(idOrden, estado) {
    setUpdatingId(idOrden);
    setError("");

    try {
      await api.put(`/ordenes/${idOrden}/estado`, { estado });
      await loadOrdenes();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo actualizar el estado de la orden."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const pendientes = ordenes.filter((orden) => orden.estado === "PENDIENTE").length;
  const enDiagnostico = ordenes.filter((orden) => orden.estado === "EN_DIAGNOSTICO").length;

  const ordenColumns = [
    {
      key: "id_orden",
      label: "ID",
      searchValue: (orden) => orden.id_orden,
      sortValue: (orden) => Number(orden.id_orden || 0)
    },
    {
      key: "numero_serie",
      label: "Numero de serie",
      searchValue: (orden) => orden.numero_serie || "Sin serie",
      render: (orden) => <strong>{orden.numero_serie || "Sin serie"}</strong>
    },
    {
      key: "producto",
      label: "Producto / modelo",
      searchValue: (orden) => `${orden.marca || ""} ${orden.modelo || ""} ${orden.descripcion_modelo || ""}`,
      render: (orden) => (
        <>
          {[orden.marca, orden.modelo].filter(Boolean).join(" - ") || "Sin producto"}
          {orden.descripcion_modelo ? <span className="table-subtext">{orden.descripcion_modelo}</span> : null}
        </>
      )
    },
    {
      key: "tipo_orden",
      label: "Tipo",
      searchValue: (orden) => orden.tipo_orden || "Sin tipo",
      render: (orden) => orden.tipo_orden || "Sin tipo"
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (orden) => orden.estado,
      render: (orden) => <StatusBadge value={orden.estado} />
    },
    {
      key: "fecha_creacion",
      label: "Fecha creacion",
      searchValue: (orden) => formatDate(orden.fecha_creacion),
      sortValue: (orden) => orden.fecha_creacion,
      render: (orden) => formatDate(orden.fecha_creacion)
    },
    {
      key: "acciones",
      label: "Acciones",
      searchable: false,
      sortable: false,
      render: (orden) => (
        <div className="table-actions action-stack">
          <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openOrderDetail(orden)}>
            Especificaciones
          </button>
          <select
            className="form-select form-select-sm state-select"
            value={orden.estado}
            disabled={updatingId === orden.id_orden}
            onChange={(event) => handleEstadoChange(orden.id_orden, event.target.value)}
          >
            {ESTADOS_ORDEN.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
        </div>
      )
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
      key: "estado",
      label: "Estado",
      searchValue: (garantia) => garantia.estado,
      render: (garantia) => <StatusBadge value={garantia.estado} />
    },
    {
      key: "observacion",
      label: "Observacion sucursal",
      searchValue: (garantia) => garantia.observacion || "Sin observacion",
      sortable: false,
      render: (garantia) => garantia.observacion || "Sin observacion"
    },
    {
      key: "observacion_marca",
      label: "Respuesta marca",
      searchValue: (garantia) => garantia.observacion_marca || "Sin respuesta",
      sortable: false,
      render: (garantia) => garantia.observacion_marca || "Sin respuesta"
    },
    {
      key: "fecha_solicitud",
      label: "Fecha solicitud",
      searchValue: (garantia) => formatDate(garantia.fecha_solicitud),
      sortValue: (garantia) => garantia.fecha_solicitud,
      render: (garantia) => formatDate(garantia.fecha_solicitud)
    }
  ];
  return (
    <AppLayout title="Panel tecnico" eyebrow="TECNICO">
      <section id="dashboard" className="row g-3 mb-4">
        <div className="col-md-4">
          <StatCard title="Ordenes asignadas" value={ordenes.length} detail="Seguimiento tecnico" tone="primary" label="OS" />
        </div>
        <div className="col-md-4">
          <StatCard title="En diagnostico" value={enDiagnostico} detail="Equipos en revision" tone="warning" label="ED" />
        </div>
        <div className="col-md-4">
          <StatCard title="Pendientes" value={pendientes} detail="Ingresos por atender" tone="danger" label="PE" />
        </div>
      </section>

      {orderSuccess ? <p className="alert alert-success">{orderSuccess}</p> : null}

      {isOrderFormOpen ? (
        <NewOrderForm onCancel={closeOrderForm} onCreated={handleOrderCreated} />
      ) : null}

      {selectedDetailOrder ? (
        <OrdenDetalleModal
          orden={selectedDetailOrder}
          onClose={closeOrderDetail}
          onUpdated={handleOrderDetailUpdated}
        />
      ) : null}

      <DataTable
        sectionId="ordenes"
        eyebrow="Servicio tecnico"
        title="Ordenes de servicio"
        rows={ordenes}
        columns={ordenColumns}
        getRowKey={(orden) => orden.id_orden}
        searchPlaceholder="Buscar por ID, serie, producto, tipo o estado"
        emptyMessage="No hay ordenes de servicio registradas."
        loading={isLoading}
        loadingMessage="Cargando ordenes..."
        error={error}
        initialSortKey="id_orden"
        toolbarAction={{
          label: isOrderFormOpen ? "Cancelar" : "+ Nueva orden",
          className: isOrderFormOpen ? "btn btn-outline-secondary" : "btn btn-primary",
          onClick: isOrderFormOpen ? closeOrderForm : openOrderForm
        }}
      />

      <DataTable
        sectionId="garantias"
        eyebrow="Garantias"
        title="Solicitudes de garantia"
        rows={garantias}
        columns={garantiaColumns}
        getRowKey={(garantia) => garantia.id_garantia}
        searchPlaceholder="Buscar por orden, serie, producto, estado u observacion"
        emptyMessage="No hay solicitudes de garantia registradas."
        loading={isLoadingGarantias}
        loadingMessage="Cargando solicitudes..."
        error={garantiasError}
        initialSortKey="id_garantia"
      />
    </AppLayout>
  );
}

export default TecnicoDashboard;
