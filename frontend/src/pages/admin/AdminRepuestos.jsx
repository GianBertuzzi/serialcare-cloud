import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/format.js";

const initialCreateForm = {
  codigo: "",
  nombre: "",
  marca: "",
  precio: "0",
  stock_inicial: "0",
  stock_minimo: "0"
};
const initialInventoryForm = { tipo: "POSITIVO", cantidad: "", motivo: "" };

function ModalShell({ title, onClose, children, footer, size = "" }) {
  return (
    <>
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-dialog-centered ${size}`.trim()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5">{title}</h2>
              <button className="btn-close" type="button" aria-label="Cerrar" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function getStockStatus(repuesto) {
  if (repuesto.estado_stock) return repuesto.estado_stock;

  const stock = Number(repuesto.stock || 0);
  const stockMinimo = Number(repuesto.stock_minimo || 0);

  if (stock === 0) return "AGOTADO";
  if (stock <= stockMinimo) return "BAJO";
  return "NORMAL";
}

function StockBadge({ repuesto }) {
  const status = getStockStatus(repuesto);
  const className = status === "AGOTADO"
    ? "text-bg-danger"
    : status === "BAJO"
      ? "text-bg-warning"
      : "text-bg-success";

  return <span className={`badge ${className}`}>{repuesto.stock} - {status}</span>;
}

function AdminRepuestos() {
  const [repuestos, setRepuestos] = useState([]);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [inventoryAction, setInventoryAction] = useState(null);
  const [inventoryForm, setInventoryForm] = useState(initialInventoryForm);
  const [movementsRepuesto, setMovementsRepuesto] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadRepuestos(showLoading = true) {
    if (showLoading) setLoading(true);
    setLoadError("");

    try {
      const response = await api.get("/repuestos");
      setRepuestos(response.data.repuestos || []);
    } catch (requestError) {
      setLoadError(requestError.response?.data?.error || "No se pudieron cargar los repuestos.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadRepuestos();
  }, []);

  function resetMessages() {
    setActionError("");
    setSuccess("");
  }

  function handleCreateChange(event) {
    const { name, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: value }));
  }

  function closeCreateForm() {
    setCreateForm(initialCreateForm);
    setCreateOpen(false);
  }

  async function handleCreate(event) {
    event.preventDefault();
    const stockInicial = Number(createForm.stock_inicial);
    const stockMinimo = Number(createForm.stock_minimo);
    const precio = Number(createForm.precio);

    if (!createForm.nombre.trim()) {
      setActionError("Nombre de repuesto es obligatorio.");
      return;
    }

    if (!Number.isFinite(precio) || precio < 0) {
      setActionError("El precio debe ser mayor o igual a 0.");
      return;
    }

    if (!Number.isInteger(stockInicial) || stockInicial < 0 || !Number.isInteger(stockMinimo) || stockMinimo < 0) {
      setActionError("Stock inicial y stock minimo deben ser enteros mayores o iguales a 0.");
      return;
    }

    setSaving(true);
    resetMessages();

    try {
      await api.post("/repuestos", {
        codigo: createForm.codigo,
        nombre: createForm.nombre,
        marca: createForm.marca,
        precio,
        stock_inicial: stockInicial,
        stock_minimo: stockMinimo
      });
      closeCreateForm();
      setSuccess("Repuesto creado y stock inicial registrado correctamente.");
      await loadRepuestos(false);
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || "No se pudo crear el repuesto.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(repuesto) {
    closeCreateForm();
    setInventoryAction(null);
    setEditForm({
      id_repuesto: repuesto.id_repuesto,
      codigo: repuesto.codigo || "",
      nombre: repuesto.nombre,
      marca: repuesto.marca || "",
      precio: String(repuesto.precio || 0),
      stock: repuesto.stock,
      stock_minimo: String(repuesto.stock_minimo || 0),
      estado: repuesto.estado || "ACTIVO"
    });
    resetMessages();
  }

  async function handleEdit(event) {
    event.preventDefault();
    const precio = Number(editForm.precio);
    const stockMinimo = Number(editForm.stock_minimo);

    if (!editForm.nombre.trim()) {
      setActionError("Nombre de repuesto es obligatorio.");
      return;
    }

    if (!Number.isFinite(precio) || precio < 0) {
      setActionError("El precio debe ser mayor o igual a 0.");
      return;
    }

    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      setActionError("El stock minimo debe ser entero mayor o igual a 0.");
      return;
    }

    setSaving(true);
    resetMessages();

    try {
      await api.put(`/repuestos/${editForm.id_repuesto}`, {
        codigo: editForm.codigo,
        nombre: editForm.nombre,
        precio,
        stock_minimo: stockMinimo,
        estado: editForm.estado
      });
      setEditForm(null);
      setSuccess("Repuesto actualizado sin modificar directamente el stock.");
      await loadRepuestos(false);
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || "No se pudo actualizar el repuesto.");
    } finally {
      setSaving(false);
    }
  }

  function openInventoryAction(mode, repuesto) {
    closeCreateForm();
    setEditForm(null);
    setInventoryAction({ mode, repuesto });
    setInventoryForm(initialInventoryForm);
    resetMessages();
  }

  async function handleInventoryAction(event) {
    event.preventDefault();
    const cantidad = Number(inventoryForm.cantidad);
    const motivo = inventoryForm.motivo.trim();

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setActionError("La cantidad debe ser un entero mayor que 0.");
      return;
    }

    if (!motivo) {
      setActionError("El motivo es obligatorio.");
      return;
    }

    if (
      inventoryAction.mode === "ajuste"
      && inventoryForm.tipo === "NEGATIVO"
      && !window.confirm("Este ajuste reducira el stock. Confirmas la operacion?")
    ) {
      return;
    }

    setSaving(true);
    resetMessages();

    try {
      if (inventoryAction.mode === "entrada") {
        await api.post(`/repuestos/${inventoryAction.repuesto.id_repuesto}/entrada`, {
          cantidad,
          motivo
        });
      } else {
        await api.post(`/repuestos/${inventoryAction.repuesto.id_repuesto}/ajuste`, {
          tipo: inventoryForm.tipo,
          cantidad,
          motivo
        });
      }

      const message = inventoryAction.mode === "entrada"
        ? "Entrada de inventario registrada correctamente."
        : "Ajuste de inventario registrado correctamente.";
      setInventoryAction(null);
      setInventoryForm(initialInventoryForm);
      setSuccess(message);
      await loadRepuestos(false);
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || "No se pudo registrar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  async function openMovements(repuesto) {
    closeCreateForm();
    setEditForm(null);
    setInventoryAction(null);
    setMovementsRepuesto(repuesto);
    setMovimientos([]);
    setMovementError("");
    setLoadingMovimientos(true);
    resetMessages();

    try {
      const response = await api.get(`/repuestos/${repuesto.id_repuesto}/movimientos`);
      setMovimientos(response.data.movimientos || []);
    } catch (requestError) {
      setMovementError(requestError.response?.data?.error || "No se pudieron cargar los movimientos.");
    } finally {
      setLoadingMovimientos(false);
    }
  }

  const columns = [
    { key: "codigo", label: "Codigo", searchValue: (repuesto) => repuesto.codigo || "", render: (repuesto) => repuesto.codigo || "Sin codigo" },
    { key: "nombre", label: "Nombre", searchValue: (repuesto) => repuesto.nombre, render: (repuesto) => <strong>{repuesto.nombre}</strong> },
    { key: "marca", label: "Marca", searchValue: (repuesto) => repuesto.marca || "", render: (repuesto) => repuesto.marca || "Sin marca" },
    { key: "precio", label: "Precio", searchValue: (repuesto) => repuesto.precio, sortValue: (repuesto) => Number(repuesto.precio || 0), render: (repuesto) => formatCurrency(repuesto.precio) },
    { key: "stock", label: "Stock actual", searchValue: (repuesto) => `${repuesto.stock} ${getStockStatus(repuesto)}`, sortValue: (repuesto) => Number(repuesto.stock || 0), render: (repuesto) => <StockBadge repuesto={repuesto} /> },
    { key: "stock_minimo", label: "Stock minimo", searchValue: (repuesto) => repuesto.stock_minimo, sortValue: (repuesto) => Number(repuesto.stock_minimo || 0) },
    { key: "estado", label: "Estado", searchValue: (repuesto) => repuesto.estado, render: (repuesto) => <StatusBadge value={repuesto.estado} /> },
    {
      key: "acciones",
      label: "Acciones",
      searchable: false,
      sortable: false,
      render: (repuesto) => (
        <div className="d-flex flex-wrap gap-1">
          <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openEdit(repuesto)}>Editar</button>
          <button className="btn btn-outline-success btn-sm" type="button" onClick={() => openInventoryAction("entrada", repuesto)}>Registrar entrada</button>
          <button className="btn btn-outline-warning btn-sm" type="button" onClick={() => openInventoryAction("ajuste", repuesto)}>Ajustar stock</button>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => openMovements(repuesto)}>Ver movimientos</button>
        </div>
      )
    }
  ];

  return (
    <AppLayout title="Repuestos" eyebrow="ADMIN">
      <p className="text-secondary">
        Administra el catalogo y registra cada cambio de stock mediante movimientos auditables.
      </p>

      {success ? <p className="alert alert-success">{success}</p> : null}
      {actionError && !editForm && !inventoryAction ? <p className="alert alert-danger">{actionError}</p> : null}

      {createOpen ? (
        <section className="card surface-card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h2 className="h5 mb-3">Agregar repuesto</h2>
            <form className="row g-3" onSubmit={handleCreate}>
              <div className="col-md-2"><label className="form-label">Codigo</label><input className="form-control" name="codigo" value={createForm.codigo} onChange={handleCreateChange} /></div>
              <div className="col-md-3"><label className="form-label">Nombre</label><input className="form-control" name="nombre" value={createForm.nombre} onChange={handleCreateChange} required /></div>
              <div className="col-md-2"><label className="form-label">Marca</label><input className="form-control" name="marca" value={createForm.marca} onChange={handleCreateChange} /></div>
              <div className="col-md-2"><label className="form-label">Precio</label><input className="form-control" type="number" min="0" name="precio" value={createForm.precio} onChange={handleCreateChange} required /></div>
              <div className="col-md-1"><label className="form-label">Stock inicial</label><input className="form-control" type="number" min="0" step="1" name="stock_inicial" value={createForm.stock_inicial} onChange={handleCreateChange} required /></div>
              <div className="col-md-2"><label className="form-label">Stock minimo</label><input className="form-control" type="number" min="0" step="1" name="stock_minimo" value={createForm.stock_minimo} onChange={handleCreateChange} required /></div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Agregar repuesto"}</button>
                <button className="btn btn-outline-secondary" type="button" onClick={closeCreateForm}>Cancelar</button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <DataTable
        title="Repuestos"
        eyebrow="Inventario auditable"
        rows={repuestos}
        columns={columns}
        getRowKey={(repuesto) => repuesto.id_repuesto}
        searchPlaceholder="Buscar por codigo, nombre, marca o estado de stock"
        emptyMessage="No hay repuestos."
        loading={loading}
        error={loadError}
        toolbarAction={{
          label: createOpen ? "Cancelar" : "+ Agregar repuesto",
          className: createOpen ? "btn btn-outline-secondary" : "btn btn-primary",
          onClick: () => {
            resetMessages();
            setCreateOpen((current) => !current);
          }
        }}
      />

      {editForm ? (
        <ModalShell
          title="Editar repuesto"
          onClose={() => setEditForm(null)}
          footer={(
            <>
              <button className="btn btn-outline-secondary" type="button" onClick={() => setEditForm(null)}>Cancelar</button>
              <button className="btn btn-primary" type="submit" form="edit-repuesto-form" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
            </>
          )}
        >
          {actionError ? <p className="alert alert-danger">{actionError}</p> : null}
          <form id="edit-repuesto-form" className="row g-3" onSubmit={handleEdit}>
            <div className="col-md-6"><label className="form-label">Codigo</label><input className="form-control" value={editForm.codigo} onChange={(event) => setEditForm((current) => ({ ...current, codigo: event.target.value }))} /></div>
            <div className="col-md-6"><label className="form-label">Nombre</label><input className="form-control" value={editForm.nombre} onChange={(event) => setEditForm((current) => ({ ...current, nombre: event.target.value }))} required /></div>
            <div className="col-md-6"><label className="form-label">Marca</label><input className="form-control" value={editForm.marca} disabled /></div>
            <div className="col-md-6"><label className="form-label">Stock actual</label><input className="form-control" value={editForm.stock} disabled /></div>
            <div className="col-md-4"><label className="form-label">Precio</label><input className="form-control" type="number" min="0" value={editForm.precio} onChange={(event) => setEditForm((current) => ({ ...current, precio: event.target.value }))} required /></div>
            <div className="col-md-4"><label className="form-label">Stock minimo</label><input className="form-control" type="number" min="0" step="1" value={editForm.stock_minimo} onChange={(event) => setEditForm((current) => ({ ...current, stock_minimo: event.target.value }))} required /></div>
            <div className="col-md-4"><label className="form-label">Estado</label><select className="form-select" value={editForm.estado} onChange={(event) => setEditForm((current) => ({ ...current, estado: event.target.value }))}><option value="ACTIVO">ACTIVO</option><option value="INACTIVO">INACTIVO</option></select></div>
          </form>
        </ModalShell>
      ) : null}

      {inventoryAction ? (
        <ModalShell
          title={inventoryAction.mode === "entrada" ? "Registrar entrada" : "Ajustar stock"}
          onClose={() => setInventoryAction(null)}
          footer={(
            <>
              <button className="btn btn-outline-secondary" type="button" onClick={() => setInventoryAction(null)}>Cancelar</button>
              <button className="btn btn-primary" type="submit" form="inventory-action-form" disabled={saving}>{saving ? "Registrando..." : "Registrar movimiento"}</button>
            </>
          )}
        >
          <p><strong>{inventoryAction.repuesto.nombre}</strong></p>
          <p className="text-secondary">Stock actual: {inventoryAction.repuesto.stock}</p>
          {actionError ? <p className="alert alert-danger">{actionError}</p> : null}
          <form id="inventory-action-form" className="row g-3" onSubmit={handleInventoryAction}>
            {inventoryAction.mode === "ajuste" ? (
              <div className="col-md-6"><label className="form-label">Tipo de ajuste</label><select className="form-select" value={inventoryForm.tipo} onChange={(event) => setInventoryForm((current) => ({ ...current, tipo: event.target.value }))}><option value="POSITIVO">POSITIVO</option><option value="NEGATIVO">NEGATIVO</option></select></div>
            ) : null}
            <div className={inventoryAction.mode === "ajuste" ? "col-md-6" : "col-12"}><label className="form-label">Cantidad</label><input className="form-control" type="number" min="1" step="1" value={inventoryForm.cantidad} onChange={(event) => setInventoryForm((current) => ({ ...current, cantidad: event.target.value }))} required /></div>
            <div className="col-12"><label className="form-label">Motivo</label><textarea className="form-control" value={inventoryForm.motivo} onChange={(event) => setInventoryForm((current) => ({ ...current, motivo: event.target.value }))} required /></div>
          </form>
        </ModalShell>
      ) : null}

      {movementsRepuesto ? (
        <ModalShell
          title={`Movimientos - ${movementsRepuesto.nombre}`}
          onClose={() => setMovementsRepuesto(null)}
          size="modal-xl"
          footer={<button className="btn btn-secondary" type="button" onClick={() => setMovementsRepuesto(null)}>Cerrar</button>}
        >
          {loadingMovimientos ? <p className="text-secondary">Cargando movimientos...</p> : null}
          {movementError ? <p className="alert alert-danger">{movementError}</p> : null}
          {!loadingMovimientos && !movementError && movimientos.length === 0 ? <p className="alert alert-info mb-0">No existen movimientos para este repuesto.</p> : null}
          {!loadingMovimientos && !movementError && movimientos.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Stock anterior</th><th>Stock nuevo</th><th>Motivo</th><th>Usuario</th><th>Orden</th></tr></thead>
                <tbody>
                  {movimientos.map((movimiento) => (
                    <tr key={movimiento.id_movimiento}>
                      <td>{formatDate(movimiento.fecha)}</td>
                      <td><StatusBadge value={movimiento.tipo} /></td>
                      <td>{movimiento.cantidad}</td>
                      <td>{movimiento.stock_anterior}</td>
                      <td>{movimiento.stock_nuevo}</td>
                      <td>{movimiento.motivo || "Sin motivo"}</td>
                      <td>{movimiento.usuario || "Usuario no disponible"}</td>
                      <td>{movimiento.id_orden ? `#${movimiento.id_orden}${movimiento.numero_serie ? ` - ${movimiento.numero_serie}` : ""}` : "Sin orden"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ModalShell>
      ) : null}
    </AppLayout>
  );
}

export default AdminRepuestos;