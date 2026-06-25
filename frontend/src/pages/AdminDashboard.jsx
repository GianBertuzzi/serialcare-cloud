import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout.jsx";
import DataTable from "../components/DataTable.jsx";
import NewOrderForm from "../components/NewOrderForm.jsx";
import OrderActionPanel from "../components/OrderActionPanel.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../services/api";

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
  const [nombreSucursal, setNombreSucursal] = useState("");
  const [editingPrecioId, setEditingPrecioId] = useState(null);
  const [editingRevisionValue, setEditingRevisionValue] = useState("");
  const [modeloForm, setModeloForm] = useState(initialModeloForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPrecios, setIsLoadingPrecios] = useState(true);
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true);
  const [error, setError] = useState("");
  const [preciosError, setPreciosError] = useState("");
  const [ordenesError, setOrdenesError] = useState("");
  const [createModeloError, setCreateModeloError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [precioSuccess, setPrecioSuccess] = useState("");
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [activeOrderAction, setActiveOrderAction] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
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

  useEffect(() => {
    loadProductos();
    loadPrecios();
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
    await loadProductos();
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
      render: (orden) => orden.nombre_sucursal || "Sin sucursal"
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
      key: "valor_revision",
      label: "Valor revision",
      searchValue: (orden) => orden.valor_revision,
      sortValue: (orden) => Number(orden.valor_revision || 0),
      render: (orden) => formatCurrency(orden.valor_revision)
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
