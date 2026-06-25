import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout.jsx";
import DataTable from "../components/DataTable.jsx";
import NewOrderForm from "../components/NewOrderForm.jsx";
import OrderActionPanel from "../components/OrderActionPanel.jsx";
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [activeOrderAction, setActiveOrderAction] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
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

  useEffect(() => {
    loadOrdenes();
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

  function openOrderAction(orden, action) {
    setOrderSuccess("");
    setSelectedOrder(orden);
    setActiveOrderAction(action);
  }

  function closeOrderAction() {
    setSelectedOrder(null);
    setActiveOrderAction(null);
  }

  async function handleOrderActionSaved(message) {
    closeOrderAction();
    setOrderSuccess(message);
    await loadOrdenes();
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
      searchValue: (orden) =>
        `${orden.numero_serie || ""} ${orden.marca || ""} ${orden.modelo || ""} ${orden.descripcion_modelo || ""}`,
      render: (orden) => (
        <>
          <strong>{orden.numero_serie || "Sin serie"}</strong>
          {orden.marca || orden.modelo ? (
            <span className="table-subtext">
              {[orden.marca, orden.modelo].filter(Boolean).join(" - ")}
            </span>
          ) : null}
        </>
      )
    },
    {
      key: "nombre_sucursal",
      label: "Sucursal",
      searchValue: (orden) => orden.nombre_sucursal || "Sin sucursal",
      render: (orden) => (
        <>
          {orden.nombre_sucursal || "Sin sucursal"}
          <span className="table-subtext">
            Ingreso {formatCurrency(orden.costo_ingreso_taller)} - Revision {formatCurrency(orden.valor_revision)}
          </span>
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
      key: "diagnostico",
      label: "Diagnostico",
      searchValue: (orden) => orden.diagnostico || "Sin diagnostico",
      render: (orden) => orden.diagnostico || "Sin diagnostico"
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (orden) => orden.estado,
      render: (orden) => <StatusBadge value={orden.estado} />
    },
    {
      key: "cambiar_estado",
      label: "Cambiar estado",
      searchable: false,
      sortable: false,
      render: (orden) => (
        <select
          className="form-select form-select-sm state-select"
          value={orden.estado}
          disabled={updatingId === orden.id_orden}
          onChange={(event) => handleEstadoChange(orden.id_orden, event.target.value)}
        >
          {ESTADOS_ORDEN.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      )
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
        <div className="table-actions">
          <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openOrderAction(orden, "repuesto")}>
            Agregar repuesto
          </button>
          <button className="btn btn-outline-success btn-sm" type="button" onClick={() => openOrderAction(orden, "garantia")}>
            Solicitar garantia
          </button>
        </div>
      )
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

      {activeOrderAction ? (
        <OrderActionPanel
          orden={selectedOrder}
          type={activeOrderAction}
          onCancel={closeOrderAction}
          onSaved={handleOrderActionSaved}
        />
      ) : null}

      <DataTable
        sectionId="ordenes"
        eyebrow="Servicio tecnico"
        title="Ordenes de servicio"
        rows={ordenes}
        columns={ordenColumns}
        getRowKey={(orden) => orden.id_orden}
        searchPlaceholder="Buscar por serie, modelo, diagnostico o estado"
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
    </AppLayout>
  );
}

export default TecnicoDashboard;
