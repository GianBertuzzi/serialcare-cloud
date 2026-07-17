import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatDate } from "../../utils/format.js";

const initialCreateForm = {
  nombre: "",
  email: "",
  password: "",
  passwordConfirmation: ""
};

function AdminRecepcionistas() {
  const [recepcionistas, setRecepcionistas] = useState([]);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadRecepcionistas(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    setLoadError("");

    try {
      const response = await api.get("/recepcionistas");
      setRecepcionistas(response.data.recepcionistas || []);
    } catch (requestError) {
      setLoadError(
        requestError.response?.data?.error || "No se pudieron cargar los recepcionistas."
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadRecepcionistas();
  }, []);

  function closeCreateForm() {
    setCreateForm(initialCreateForm);
    setCreateOpen(false);
    setActionError("");
  }

  function openCreateForm() {
    setEditForm(null);
    setCreateForm(initialCreateForm);
    setCreateOpen(true);
    setActionError("");
    setSuccess("");
  }

  function handleCreateChange(event) {
    const { name, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    const nombre = createForm.nombre.trim();
    const email = createForm.email.trim();

    if (!nombre || !email || !createForm.password || !createForm.passwordConfirmation) {
      setActionError("Todos los campos son obligatorios.");
      return;
    }

    if (createForm.password.length < 8) {
      setActionError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (createForm.password !== createForm.passwordConfirmation) {
      setActionError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    setActionError("");
    setSuccess("");

    try {
      await api.post("/recepcionistas", {
        nombre,
        email,
        password: createForm.password
      });
      closeCreateForm();
      setSuccess("Recepcionista creado correctamente.");
      await loadRecepcionistas(false);
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.error || "No se pudo crear el recepcionista."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(recepcionista) {
    closeCreateForm();
    setEditForm({
      id_usuario: recepcionista.id_usuario,
      nombre: recepcionista.nombre,
      email: recepcionista.email,
      nombre_sucursal: recepcionista.nombre_sucursal,
      estado: recepcionista.estado
    });
    setActionError("");
    setSuccess("");
  }

  function closeEditForm() {
    setEditForm(null);
    setActionError("");
  }

  async function updateRecepcionista(idUsuario, changes, successMessage) {
    setUpdatingId(idUsuario);
    setActionError("");
    setSuccess("");

    try {
      await api.put(`/recepcionistas/${idUsuario}`, changes);
      setEditForm(null);
      setSuccess(successMessage);
      await loadRecepcionistas(false);
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.error || "No se pudo actualizar el recepcionista."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleEdit(event) {
    event.preventDefault();
    const nombre = editForm.nombre.trim();

    if (!nombre) {
      setActionError("El nombre es obligatorio.");
      return;
    }

    await updateRecepcionista(
      editForm.id_usuario,
      { nombre, estado: editForm.estado },
      "Recepcionista actualizado correctamente."
    );
  }

  async function toggleEstado(recepcionista) {
    const nextEstado = recepcionista.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    await updateRecepcionista(
      recepcionista.id_usuario,
      { estado: nextEstado },
      `Recepcionista ${nextEstado === "ACTIVO" ? "activado" : "desactivado"} correctamente.`
    );
  }

  const columns = [
    {
      key: "nombre",
      label: "Nombre",
      searchValue: (recepcionista) => recepcionista.nombre,
      render: (recepcionista) => <strong>{recepcionista.nombre}</strong>
    },
    {
      key: "email",
      label: "Correo",
      searchValue: (recepcionista) => recepcionista.email
    },
    {
      key: "sucursal",
      label: "Sucursal",
      searchValue: (recepcionista) => recepcionista.nombre_sucursal || "",
      render: (recepcionista) => recepcionista.nombre_sucursal || "Sin sucursal"
    },
    {
      key: "estado",
      label: "Estado",
      searchValue: (recepcionista) => recepcionista.estado,
      render: (recepcionista) => <StatusBadge value={recepcionista.estado} />
    },
    {
      key: "fecha_creacion",
      label: "Fecha de creación",
      searchValue: (recepcionista) => formatDate(recepcionista.fecha_creacion),
      sortValue: (recepcionista) => recepcionista.fecha_creacion,
      render: (recepcionista) => formatDate(recepcionista.fecha_creacion)
    },
    {
      key: "acciones",
      label: "Acciones",
      searchable: false,
      sortable: false,
      render: (recepcionista) => {
        const isUpdating = updatingId === recepcionista.id_usuario;

        return (
          <div className="table-actions">
            <button
              className="btn btn-outline-primary btn-sm"
              type="button"
              disabled={isUpdating}
              onClick={() => startEdit(recepcionista)}
            >
              Editar
            </button>
            <button
              className={`btn btn-sm ${
                recepcionista.estado === "ACTIVO"
                  ? "btn-outline-danger"
                  : "btn-outline-success"
              }`}
              type="button"
              disabled={isUpdating}
              onClick={() => toggleEstado(recepcionista)}
            >
              {isUpdating
                ? "Guardando..."
                : recepcionista.estado === "ACTIVO"
                  ? "Desactivar"
                  : "Activar"}
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <AppLayout title="Recepcionistas" eyebrow="ADMIN">
      <p className="text-secondary">
        Administra los recepcionistas pertenecientes a tu sucursal.
      </p>

      {success ? <p className="alert alert-success">{success}</p> : null}
      {actionError ? <p className="alert alert-danger">{actionError}</p> : null}

      {createOpen ? (
        <section className="card surface-card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h2 className="h5 mb-3">Agregar recepcionista</h2>
            <form className="row g-3" onSubmit={handleCreate}>
              <div className="col-md-6">
                <label className="form-label" htmlFor="recepcionista-nombre">Nombre</label>
                <input
                  className="form-control"
                  id="recepcionista-nombre"
                  name="nombre"
                  value={createForm.nombre}
                  onChange={handleCreateChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="recepcionista-email">Correo</label>
                <input
                  className="form-control"
                  id="recepcionista-email"
                  name="email"
                  type="email"
                  value={createForm.email}
                  onChange={handleCreateChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="recepcionista-password">
                  Contraseña
                </label>
                <input
                  autoComplete="new-password"
                  className="form-control"
                  id="recepcionista-password"
                  minLength="8"
                  name="password"
                  type="password"
                  value={createForm.password}
                  onChange={handleCreateChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="recepcionista-password-confirmation">
                  Confirmación de contraseña
                </label>
                <input
                  autoComplete="new-password"
                  className="form-control"
                  id="recepcionista-password-confirmation"
                  minLength="8"
                  name="passwordConfirmation"
                  type="password"
                  value={createForm.passwordConfirmation}
                  onChange={handleCreateChange}
                  required
                />
              </div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Agregar recepcionista"}
                </button>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={saving}
                  onClick={closeCreateForm}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {editForm ? (
        <section className="card surface-card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h2 className="h5 mb-1">Editar recepcionista</h2>
            <p className="text-secondary mb-3">
              {editForm.email} · {editForm.nombre_sucursal || "Sin sucursal"}
            </p>
            <form className="row g-3" onSubmit={handleEdit}>
              <div className="col-md-8">
                <label className="form-label" htmlFor="editar-recepcionista-nombre">
                  Nombre
                </label>
                <input
                  className="form-control"
                  id="editar-recepcionista-nombre"
                  value={editForm.nombre}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, nombre: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="editar-recepcionista-estado">
                  Estado
                </label>
                <select
                  className="form-select"
                  id="editar-recepcionista-estado"
                  value={editForm.estado}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, estado: event.target.value }))
                  }
                >
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="INACTIVO">INACTIVO</option>
                </select>
              </div>
              <div className="col-12 d-flex gap-2">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={updatingId === editForm.id_usuario}
                >
                  {updatingId === editForm.id_usuario ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={updatingId === editForm.id_usuario}
                  onClick={closeEditForm}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <DataTable
        title="Recepcionistas"
        eyebrow="Equipo de la sucursal"
        rows={recepcionistas}
        columns={columns}
        getRowKey={(recepcionista) => recepcionista.id_usuario}
        searchPlaceholder="Buscar por nombre, correo, sucursal o estado"
        emptyMessage="No hay recepcionistas registrados."
        loading={loading}
        loadingMessage="Cargando recepcionistas..."
        error={loadError}
        toolbarAction={{
          label: createOpen ? "Cancelar" : "Agregar recepcionista",
          className: createOpen ? "btn btn-outline-secondary" : "btn btn-primary",
          disabled: saving,
          onClick: createOpen ? closeCreateForm : openCreateForm
        }}
      />
    </AppLayout>
  );
}

export default AdminRecepcionistas;
