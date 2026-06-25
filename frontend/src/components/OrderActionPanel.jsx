import { useState } from "react";
import api from "../services/api";

const initialRepuestoForm = {
  nombre_repuesto: "",
  cantidad: "1",
  precio_unitario: "0",
  cubierto_garantia: "false",
  observacion: ""
};

const initialGarantiaForm = {
  observacion: ""
};

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function OrderActionPanel({ orden, type, onCancel, onSaved }) {
  const [repuestoForm, setRepuestoForm] = useState(initialRepuestoForm);
  const [garantiaForm, setGarantiaForm] = useState(initialGarantiaForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!orden || !type) {
    return null;
  }

  const isRepuesto = type === "repuesto";
  const title = isRepuesto ? "Agregar repuesto" : "Solicitar garantia";

  function handleRepuestoChange(event) {
    const { name, value } = event.target;
    setRepuestoForm((current) => ({ ...current, [name]: value }));
  }

  function handleGarantiaChange(event) {
    const { name, value } = event.target;
    setGarantiaForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (isRepuesto && !repuestoForm.nombre_repuesto.trim()) {
      setError("Nombre del repuesto es obligatorio.");
      return;
    }

    if (!isRepuesto && !garantiaForm.observacion.trim()) {
      setError("Motivo u observacion es obligatorio.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRepuesto) {
        await api.post(`/ordenes/${orden.id_orden}/repuestos`, {
          nombre_repuesto: repuestoForm.nombre_repuesto.trim(),
          cantidad: Number(repuestoForm.cantidad || 1),
          precio_unitario: Number(repuestoForm.precio_unitario || 0),
          cubierto_garantia: repuestoForm.cubierto_garantia === "true",
          observacion: repuestoForm.observacion.trim()
        });
        onSaved("Repuesto agregado correctamente.");
      } else {
        await api.post(`/ordenes/${orden.id_orden}/solicitar-garantia`, {
          motivo_solicitud: garantiaForm.observacion.trim()
        });
        onSaved("Solicitud de garantia creada correctamente.");
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo completar la accion solicitada."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card surface-card border-0 shadow-sm order-action-panel mb-4">
      <div className="card-header bg-white border-0 d-flex flex-wrap justify-content-between gap-3">
        <div>
          <p className="eyebrow mb-1">Orden #{orden.id_orden}</p>
          <h2 className="h5 mb-0">{title}</h2>
          <span className="table-subtext">
            {orden.numero_serie || "Sin serie"} - {orden.marca || "Sin marca"} {orden.modelo || ""}
          </span>
        </div>
        <div className="text-secondary small text-end">
          <span className="d-block">Sucursal: {orden.nombre_sucursal || "Sin sucursal"}</span>
          <span className="d-block">Revision: {formatCurrency(orden.valor_revision)}</span>
        </div>
      </div>

      <div className="card-body">
        <form onSubmit={handleSubmit}>
          {isRepuesto ? (
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label">Nombre del repuesto</label>
                <input
                  className="form-control"
                  name="nombre_repuesto"
                  value={repuestoForm.nombre_repuesto}
                  onChange={handleRepuestoChange}
                  placeholder="Bujia, filtro, modulo..."
                  required
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Cantidad</label>
                <input
                  className="form-control"
                  name="cantidad"
                  type="number"
                  min="1"
                  value={repuestoForm.cantidad}
                  onChange={handleRepuestoChange}
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Precio unitario</label>
                <input
                  className="form-control"
                  name="precio_unitario"
                  type="number"
                  min="0"
                  value={repuestoForm.precio_unitario}
                  onChange={handleRepuestoChange}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Cubierto</label>
                <select
                  className="form-select"
                  name="cubierto_garantia"
                  value={repuestoForm.cubierto_garantia}
                  onChange={handleRepuestoChange}
                >
                  <option value="false">No</option>
                  <option value="true">Si</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Observacion</label>
                <textarea
                  className="form-control"
                  name="observacion"
                  value={repuestoForm.observacion}
                  onChange={handleRepuestoChange}
                  placeholder="Detalle tecnico del repuesto usado"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="form-label">Motivo u observacion</label>
              <textarea
                className="form-control"
                name="observacion"
                value={garantiaForm.observacion}
                onChange={handleGarantiaChange}
                placeholder="Describe por que la sucursal solicita cobertura de garantia"
                required
              />
            </div>
          )}

          {error ? <p className="alert alert-danger mt-3 mb-0">{error}</p> : null}

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : isRepuesto ? "Guardar repuesto" : "Solicitar garantia"}
            </button>
            <button className="btn btn-outline-secondary" type="button" disabled={isSubmitting} onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default OrderActionPanel;