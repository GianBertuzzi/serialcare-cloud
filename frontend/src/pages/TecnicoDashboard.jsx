import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
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
  const { logout, user } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
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
      searchValue: (orden) => orden.numero_serie,
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
      key: "diagnostico",
      label: "Diagnostico",
      searchValue: (orden) => orden.diagnostico
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
          className="state-select"
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
    }
  ];

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">TECNICO</p>
          <h1>Panel tecnico</h1>
          <p className="muted">{user?.nombre}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Ordenes asignadas</h2>
          <p>{ordenes.length} ordenes registradas para seguimiento tecnico.</p>
        </article>
        <article className="panel">
          <h2>Consulta de productos</h2>
          <p>Busqueda de equipos serializados para soporte tecnico.</p>
        </article>
        <article className="panel">
          <h2>Alertas</h2>
          <p>Casos con garantia pendiente o alerta de propiedad.</p>
        </article>
      </section>

      <DataTable
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
      />
    </main>
  );
}

export default TecnicoDashboard;
