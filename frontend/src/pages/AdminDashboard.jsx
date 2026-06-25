import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout.jsx";
import DataTable from "../components/DataTable.jsx";
import NewOrderForm from "../components/NewOrderForm.jsx";
import OrdenDetalleModal from "../components/OrdenDetalleModal.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";

const ESTADOS_ORDEN = ["PENDIENTE", "EN_DIAGNOSTICO", "REPARADA", "CERRADA"];

const initialModeloForm = {
  codigo_comercial: "",
  descripcion: "",
  familia: "",
  marca: "",
  valor_revision: "",
  valor_mano_obra: "",
  certificado: "true"
};

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

function AdminDashboard() {
  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [garantias, setGarantias] = useState([]);
  const [nombreSucursal, setNombreSucursal] = useState("");
  const [editingPrecioId, setEditingPrecioId] = useState(null);
  const [editingRevisionValue, setEditingRevisionValue] = useState("");
  const [modeloForm, setModeloForm] = useState(initialModeloForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPrecios, setIsLoadingPrecios] = useState(true);
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true);
  const [isLoadingGarantias, setIsLoadingGarantias] = useState(true);
  const [error, setError] = useState("");
  const [preciosError, setPreciosError] = useState("");
  const [ordenesError, setOrdenesError] = useState("");
  const [garantiasError, setGarantiasError] = useState("");
  const [createModeloError, setCreateModeloError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [precioSuccess, setPrecioSuccess] = useState("");
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);
  const [updatingEstadoId, setUpdatingEstadoId] = useState(null);
  const [isModeloFormOpen, setIsModeloFormOpen] = useState(false);
  const [isCreatingModelo, setIsCreatingModelo] = useState(false);
  const [updatingPrecioId, setUpdatingPrecioId] = useState(null);

  async function loadProductos() {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get("/productos");
      setProductos(response.data.productos || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudieron cargar los productos registrados."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPrecios() {
    setIsLoadingPrecios(true);
    setPreciosError("");

    try {
      const response = await api.get("/precios-sucursal");
      setNombreSucursal(response.data.nombre_sucursal || "");
      setPrecios(response.data.precios || []);
    } catch (requestError) {
      setPreciosError(
        requestError.response?.data?.error ||
          "No se pudieron cargar los valores de revision."
      );
    } finally {
      setIsLoadingPrecios(false);
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
          "No se pudieron cargar las ordenes de servicio."
      );
    } finally {
      setIsLoadingOrdenes(false);
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
    loadProductos();
    loadPrecios();
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
    await loadProductos();
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
    setUpdatingEstadoId(idOrden);
    setOrdenesError("");

    try {
      await api.put(`/ordenes/${idOrden}/estado`, { estado });
      await loadOrdenes();
    } catch (requestError) {
      setOrdenesError(
        requestError.response?.data?.error ||
          "No se pudo actualizar el estado de la orden."
      );
    } finally {
      setUpdatingEstadoId(null);
    }
  }
  function openModeloForm() {
    setPrecioSuccess("");
    setCreateModeloError("");
    setModeloForm(initialModeloForm);
    setIsModeloFormOpen(true);
  }

  function closeModeloForm() {
    setIsModeloFormOpen(false);
    setCreateModeloError("");
    setModeloForm(initialModeloForm);
  }

  function handleModeloFormChange(event) {
    const { name, value } = event.target;
    setModeloForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreateModelo(event) {
    event.preventDefault();
    setCreateModeloError("");
    setPrecioSuccess("");

    if (!modeloForm.codigo_comercial.trim()) {
      setCreateModeloError("Codigo comercial es obligatorio.");
      return;
    }

    if (!modeloForm.descripcion.trim()) {
      setCreateModeloError("Descripcion es obligatoria.");
      return;
    }

    const revisionValue = Number(modeloForm.valor_revision);

    if (!Number.isFinite(revisionValue) || revisionValue < 0) {
      setCreateModeloError("Valor revision debe ser numero mayor o igual a 0.");
      return;
    }

    const manoObraValue =
      modeloForm.valor_mano_obra === "" ? 0 : Number(modeloForm.valor_mano_obra);

    if (!Number.isFinite(manoObraValue) || manoObraValue < 0) {
      setCreateModeloError(
        "Valor mano de obra debe ser numero mayor o igual a 0."
      );
      return;
    }

    setIsCreatingModelo(true);

    try {
      await api.post("/modelos", {
        codigo_comercial: modeloForm.codigo_comercial.trim(),
        descripcion: modeloForm.descripcion.trim(),
        familia: modeloForm.familia.trim(),
        marca: modeloForm.marca.trim(),
        certificado: modeloForm.certificado === "true",
        valor_revision: revisionValue,
        valor_mano_obra: manoObraValue
      });
      closeModeloForm();
      setPrecioSuccess("Modelo creado y precio configurado correctamente.");
      await loadPrecios();
    } catch (requestError) {
      setCreateModeloError(
        requestError.response?.data?.error ||
          "No se pudo crear el modelo con su precio."
      );
    } finally {
      setIsCreatingModelo(false);
    }
  }

  function startEditingPrecio(precio) {
    setEditingPrecioId(precio.id_precio);
    setEditingRevisionValue(String(precio.valor_revision ?? 0));
  }

  function cancelEditingPrecio() {
    setEditingPrecioId(null);
    setEditingRevisionValue("");
  }

  async function handleUpdatePrecio(idPrecio) {
    setUpdatingPrecioId(idPrecio);
    setPreciosError("");
    setPrecioSuccess("");

    try {
      await api.put(`/precios-sucursal/${idPrecio}`, {
        valor_revision: Number(editingRevisionValue || 0)
      });
      cancelEditingPrecio();
      setPrecioSuccess("Valor de revision actualizado correctamente.");
      await loadPrecios();
    } catch (requestError) {
      setPreciosError(
        requestError.response?.data?.error ||
          "No se pudo actualizar el valor de revision."
      );
    } finally {
      setUpdatingPrecioId(null);
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
            disabled={updatingEstadoId === orden.id_orden}
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
      key: "tecnico",
      label: "Tecnico",
      searchValue: (garantia) => `${garantia.tecnico || ""} ${garantia.tecnico_email || ""}`,
      render: (garantia) => garantia.tecnico || "Sin tecnico"
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
  const productoColumns = [
    {
      key: "numero_serie",
      label: "Numero de serie",
      searchValue: (producto) => producto.numero_serie
    },
    {
      key: "marca",
      label: "Marca",
      searchValue: (producto) => producto.marca
    },
    {
      key: "modelo",
      label: "Modelo",
      searchValue: (producto) =>
        `${producto.modelo || ""} ${producto.codigo_comercial || ""}`,
      render: (producto) => (
        <>
          {producto.modelo}
          {producto.codigo_comercial ? (
            <span className="table-subtext">{producto.codigo_comercial}</span>
          ) : null}
        </>
      )
    },
    {
      key: "nombre_sucursal",
      label: "Sucursal",
      searchValue: (producto) => producto.nombre_sucursal || "Sin sucursal",
      render: (producto) => producto.nombre_sucursal || "Sin sucursal"
    },
    {
      key: "estado_garantia",
      label: "Garantia",
      searchValue: (producto) => producto.estado_garantia,
      render: (producto) => <StatusBadge value={producto.estado_garantia} />
    },
    {
      key: "valor_revision",
      label: "Valor revision",
      searchValue: (producto) => producto.valor_revision,
      sortValue: (producto) => Number(producto.valor_revision || 0),
      render: (producto) => formatCurrency(producto.valor_revision)
    },
    {
      key: "fecha_registro",
      label: "Fecha registro",
      searchValue: (producto) => formatDate(producto.fecha_registro),
      sortValue: (producto) => producto.fecha_registro,
      render: (producto) => formatDate(producto.fecha_registro)
    }
  ];

  const preciosColumns = [
    {
      key: "codigo_comercial",
      label: "Codigo comercial",
      searchValue: (precio) => precio.codigo_comercial || "Sin codigo"
    },
    {
      key: "descripcion",
      label: "Descripcion",
      searchValue: (precio) => precio.descripcion
    },
    {
      key: "familia",
      label: "Familia",
      searchValue: (precio) => precio.familia || "Sin familia"
    },
    {
      key: "marca",
      label: "Marca",
      searchValue: (precio) => precio.marca || "Sin marca"
    },
    {
      key: "valor_revision",
      label: "Valor revision",
      searchValue: (precio) => precio.valor_revision,
      sortValue: (precio) => Number(precio.valor_revision || 0),
      render: (precio) =>
        editingPrecioId === precio.id_precio ? (
          <input
            className="form-control form-control-sm price-input"
            type="number"
            min="0"
            value={editingRevisionValue}
            onChange={(event) => setEditingRevisionValue(event.target.value)}
          />
        ) : (
          formatCurrency(precio.valor_revision)
        )
    },
    {
      key: "certificado",
      label: "Certificado",
      searchValue: (precio) => (precio.certificado ? "Si" : "No"),
      sortValue: (precio) => (precio.certificado ? 1 : 0),
      render: (precio) => (
        <span className={precio.certificado ? "yes-badge" : "no-badge"}>
          {precio.certificado ? "Si" : "No"}
        </span>
      )
    },
    {
      key: "acciones",
      label: "Acciones",
      searchable: false,
      sortable: false,
      render: (precio) =>
        editingPrecioId === precio.id_precio ? (
          <div className="table-actions">
            <button
              className="btn btn-success btn-sm"
              type="button"
              disabled={updatingPrecioId === precio.id_precio}
              onClick={() => handleUpdatePrecio(precio.id_precio)}
            >
              Guardar
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              disabled={updatingPrecioId === precio.id_precio}
              onClick={cancelEditingPrecio}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            className="btn btn-outline-primary btn-sm"
            type="button"
            onClick={() => startEditingPrecio(precio)}
          >
            Modificar
          </button>
        )
    }
  ];

  return (
    <AppLayout title="Panel administrador" eyebrow="ADMIN">
      <section id="dashboard" className="row g-3 mb-4">
        <div className="col-md-4">
          <StatCard title="Sucursal" value={nombreSucursal || "Operativa"} detail="Administracion local" tone="primary" label="SU" />
        </div>
        <div className="col-md-4">
          <StatCard title="Productos visibles" value={productos.length} detail="Equipos para tu sucursal" tone="success" label="PR" />
        </div>
        <div className="col-md-4">
          <StatCard title="Valores de revision" value={precios.length} detail="Modelos con precio" tone="warning" label="VR" />
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
        loading={isLoadingOrdenes}
        loadingMessage="Cargando ordenes..."
        error={ordenesError}
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
        searchPlaceholder="Buscar por orden, serie, producto, tecnico, estado u observacion"
        emptyMessage="No hay solicitudes de garantia registradas."
        loading={isLoadingGarantias}
        loadingMessage="Cargando solicitudes..."
        error={garantiasError}
        initialSortKey="id_garantia"
      />

      <DataTable
        sectionId="productos"
        eyebrow="Inventario"
        title="Productos registrados"
        rows={productos}
        columns={productoColumns}
        getRowKey={(producto) => producto.id_producto || producto.numero_serie}
        searchPlaceholder="Buscar por serie, marca, modelo, sucursal o garantia"
        emptyMessage="No hay productos registrados."
        loading={isLoading}
        loadingMessage="Cargando productos..."
        error={error}
        initialSortKey="numero_serie"
      />

      {precioSuccess ? <p className="alert alert-success">{precioSuccess}</p> : null}

      {isModeloFormOpen ? (
        <section className="card surface-card border-0 shadow-sm model-form-section">
          <div className="card-header bg-white border-0">
            <p className="eyebrow mb-1">Precios sucursal</p>
            <h2 className="h5 mb-0">Agregar modelo</h2>
          </div>
          <div className="card-body">
            <form className="model-form" onSubmit={handleCreateModelo}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Codigo comercial</label>
                  <input className="form-control" name="codigo_comercial" value={modeloForm.codigo_comercial} onChange={handleModeloFormChange} placeholder="TF75" required />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Descripcion</label>
                  <input className="form-control" name="descripcion" value={modeloForm.descripcion} onChange={handleModeloFormChange} placeholder="Motor gasolina 7.5 HP" required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Familia</label>
                  <input className="form-control" name="familia" value={modeloForm.familia} onChange={handleModeloFormChange} placeholder="Motores gasolina" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Marca</label>
                  <input className="form-control" name="marca" value={modeloForm.marca} onChange={handleModeloFormChange} placeholder="Toyama" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Certificado</label>
                  <select className="form-select" name="certificado" value={modeloForm.certificado} onChange={handleModeloFormChange}>
                    <option value="true">Si</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Valor revision</label>
                  <input className="form-control" name="valor_revision" type="number" min="0" value={modeloForm.valor_revision} onChange={handleModeloFormChange} placeholder="25000" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Valor mano de obra</label>
                  <input className="form-control" name="valor_mano_obra" type="number" min="0" value={modeloForm.valor_mano_obra} onChange={handleModeloFormChange} placeholder="Opcional" />
                </div>
              </div>

              {createModeloError ? <p className="alert alert-danger mt-3 mb-0">{createModeloError}</p> : null}

              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-primary" type="submit" disabled={isCreatingModelo}>
                  {isCreatingModelo ? "Creando..." : "Crear modelo"}
                </button>
                <button className="btn btn-outline-secondary" type="button" disabled={isCreatingModelo} onClick={closeModeloForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <DataTable
        sectionId="modelos"
        eyebrow="Precios sucursal"
        title="Modelos y valores de revision"
        rows={precios}
        columns={preciosColumns}
        getRowKey={(precio) => precio.id_precio}
        searchPlaceholder="Buscar por codigo, descripcion, familia o marca"
        emptyMessage="No hay precios configurados para esta sucursal."
        loading={isLoadingPrecios}
        loadingMessage="Cargando valores..."
        error={preciosError}
        initialSortKey="codigo_comercial"
        toolbarAction={{
          label: isModeloFormOpen ? "Cancelar" : "Agregar modelo",
          className: isModeloFormOpen ? "btn btn-outline-secondary" : "btn btn-primary",
          onClick: isModeloFormOpen ? closeModeloForm : openModeloForm
        }}
      />
    </AppLayout>
  );
}

export default AdminDashboard;
