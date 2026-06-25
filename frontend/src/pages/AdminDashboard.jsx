import { useEffect, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";

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
  const { logout, user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [nombreSucursal, setNombreSucursal] = useState("");
  const [editingPrecioId, setEditingPrecioId] = useState(null);
  const [editingRevisionValue, setEditingRevisionValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPrecios, setIsLoadingPrecios] = useState(true);
  const [error, setError] = useState("");
  const [preciosError, setPreciosError] = useState("");
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

  useEffect(() => {
    loadProductos();
    loadPrecios();
  }, []);

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

    try {
      await api.put(`/precios-sucursal/${idPrecio}`, {
        valor_revision: Number(editingRevisionValue || 0)
      });
      cancelEditingPrecio();
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
            className="price-input"
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
              className="approve-button"
              type="button"
              disabled={updatingPrecioId === precio.id_precio}
              onClick={() => handleUpdatePrecio(precio.id_precio)}
            >
              Guardar
            </button>
            <button
              className="secondary-button compact-button"
              type="button"
              disabled={updatingPrecioId === precio.id_precio}
              onClick={cancelEditingPrecio}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => startEditingPrecio(precio)}
          >
            Modificar
          </button>
        )
    }
  ];

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>Panel administrador</h1>
          <p className="muted">{user?.nombre}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Sucursal</h2>
          <p>{nombreSucursal || "Sucursal operativa"}</p>
        </article>
        <article className="panel">
          <h2>Productos serializados</h2>
          <p>{productos.length} productos visibles para tu sucursal.</p>
        </article>
        <article className="panel">
          <h2>Valores de revision</h2>
          <p>{precios.length} modelos con precio configurado.</p>
        </article>
      </section>

      <DataTable
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

      <DataTable
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
          label: "Agregar precio/modelo",
          disabled: true,
          className: "secondary-button"
        }}
      />
    </main>
  );
}

export default AdminDashboard;
