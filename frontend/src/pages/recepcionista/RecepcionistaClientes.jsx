import { useCallback, useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../services/api";

const initialForm = { nombre: "", rut: "", telefono: "", email: "", direccion: "" };

function getNombreSucursalRegistro(cliente) {
  return cliente.nombre_sucursal_registro || cliente.nombre_sucursal || "Sin sucursal";
}

function RecepcionistaClientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const loadClientes = useCallback(async (value) => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await api.get("/clientes", {
        params: { search: value.trim(), limit: 50 }
      });
      setClientes(response.data.clientes || []);
    } catch (requestError) {
      setLoadError(requestError.response?.data?.error || "No se pudieron cargar los clientes globales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClientes("");
  }, [loadClientes]);

  function resetForm() {
    setForm(initialForm);
    setFormOpen(false);
    setFormError("");
  }

  function openCreateForm() {
    setForm(initialForm);
    setFormError("");
    setSuccess("");
    setFormOpen(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSearch(event) {
    event.preventDefault();
    await loadClientes(search.trim());
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.nombre.trim()) {
      setFormError("Nombre del cliente es obligatorio.");
      return;
    }

    setSaving(true);
    setFormError("");
    setSuccess("");

    try {
      await api.post("/clientes", form);
      resetForm();
      setSearch("");
      setSuccess("Cliente creado correctamente en tu sucursal.");
      await loadClientes("");
    } catch (requestError) {
      setFormError(requestError.response?.data?.error || "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "nombre",
      label: "Nombre",
      searchValue: (cliente) => cliente.nombre,
      render: (cliente) => <strong>{cliente.nombre}</strong>
    },
    {
      key: "rut",
      label: "RUT",
      searchValue: (cliente) => cliente.rut || "",
      render: (cliente) => cliente.rut || "Sin RUT"
    },
    {
      key: "telefono",
      label: "Telefono",
      searchValue: (cliente) => cliente.telefono || "",
      render: (cliente) => cliente.telefono || "Sin telefono"
    },
    {
      key: "email",
      label: "Correo",
      searchValue: (cliente) => cliente.email || "",
      render: (cliente) => cliente.email || "Sin correo"
    },
    {
      key: "sucursal_registro",
      label: "Sucursal de registro",
      searchValue: getNombreSucursalRegistro,
      render: (cliente) => getNombreSucursalRegistro(cliente)
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (cliente) => cliente.estado,
      render: (cliente) => <StatusBadge value={cliente.estado} />
    }
  ];

  return (
    <AppLayout title="Clientes" eyebrow="RECEPCIONISTA">
      <p className="text-secondary mb-3">
        Busca clientes globalmente y registra nuevos clientes en {user?.nombre_sucursal || "tu sucursal"}.
      </p>
      {success ? <p className="alert alert-success">{success}</p> : null}

      <section className="card surface-card border-0 shadow-sm mb-3">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={handleSearch}>
            <div className="col-lg-9">
              <label className="form-label" htmlFor="recepcionista-clientes-search">
                Buscar por nombre, RUT, telefono o correo
              </label>
              <input
                id="recepcionista-clientes-search"
                className="form-control"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ejemplo: 76123456 o Agricola"
              />
            </div>
            <div className="col-lg-3 d-grid">
              <button className="btn btn-outline-primary" type="submit" disabled={loading}>
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {formOpen ? (
        <section className="card surface-card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
              <h2 className="h5 mb-0">Agregar cliente</h2>
              <span className="badge text-bg-light border">Sucursal: {user?.nombre_sucursal || "Sin sucursal"}</span>
            </div>
            {formError ? <p className="alert alert-danger">{formError}</p> : null}
            <form className="row g-3" onSubmit={handleSubmit}>
              <div className="col-md-4">
                <label className="form-label" htmlFor="recepcionista-cliente-nombre">Nombre</label>
                <input id="recepcionista-cliente-nombre" className="form-control" name="nombre" value={form.nombre} onChange={handleChange} required />
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="recepcionista-cliente-rut">RUT</label>
                <input id="recepcionista-cliente-rut" className="form-control" name="rut" value={form.rut} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="recepcionista-cliente-telefono">Telefono</label>
                <input id="recepcionista-cliente-telefono" className="form-control" name="telefono" value={form.telefono} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="recepcionista-cliente-email">Correo</label>
                <input id="recepcionista-cliente-email" className="form-control" type="email" name="email" value={form.email} onChange={handleChange} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="recepcionista-cliente-direccion">Direccion</label>
                <input id="recepcionista-cliente-direccion" className="form-control" name="direccion" value={form.direccion} onChange={handleChange} />
              </div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? "Guardando..." : "Agregar cliente"}
                </button>
                <button className="btn btn-outline-secondary" type="button" onClick={resetForm} disabled={saving}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <DataTable
        title="Clientes globales"
        eyebrow="Consulta global"
        rows={clientes}
        columns={columns}
        getRowKey={(cliente) => cliente.id_cliente}
        showSearch={false}
        emptyMessage={search.trim() ? "No se encontraron clientes para la busqueda." : "No hay clientes registrados."}
        loading={loading}
        error={loadError}
        pageSize={10}
        toolbarAction={{
          label: "+ Agregar cliente",
          className: "btn btn-primary",
          onClick: openCreateForm
        }}
      />
    </AppLayout>
  );
}

export default RecepcionistaClientes;
