import { useState } from "react";
import StatusBadge from "./StatusBadge.jsx";
import api from "../services/api";

const TIPOS_ORDEN = [
  "REPARACION",
  "GARANTIA",
  "MANTENIMIENTO",
  "PUESTA_EN_MARCHA"
];

const initialForm = {
  numero_serie: "",
  tipo_orden: "REPARACION",
  diagnostico: ""
};

function NewOrderForm({ onCancel, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [producto, setProducto] = useState(null);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({ ...current, [name]: value }));

    if (name === "numero_serie") {
      setProducto(null);
      setError("");
    }
  }

  async function lookupProducto() {
    const numeroSerie = form.numero_serie.trim();

    if (!numeroSerie) {
      setProducto(null);
      setError("Numero de serie es obligatorio");
      return false;
    }

    setIsChecking(true);
    setError("");

    try {
      const response = await api.get(
        `/productos/serie/${encodeURIComponent(numeroSerie)}`
      );
      setProducto(response.data.producto);
      return true;
    } catch (requestError) {
      setProducto(null);
      setError(
        requestError.response?.data?.error || "Producto no encontrado"
      );
      return false;
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.numero_serie.trim()) {
      setError("Numero de serie es obligatorio");
      return;
    }

    if (!form.tipo_orden) {
      setError("Tipo de orden es obligatorio");
      return;
    }

    const productoOk = producto ? true : await lookupProducto();

    if (!productoOk) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await api.post("/ordenes", {
        numero_serie: form.numero_serie.trim(),
        tipo_orden: form.tipo_orden,
        diagnostico: form.diagnostico.trim()
      });

      setForm(initialForm);
      setProducto(null);
      await onCreated(response.data.orden);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "No se pudo crear la orden."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card surface-card border-0 shadow-sm order-form-section">
      <div className="card-header bg-white border-0">
        <p className="eyebrow mb-1">Servicio tecnico</p>
        <h2 className="h5 mb-0">Nueva orden de servicio</h2>
      </div>

      <div className="card-body">
        <form className="order-form" onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-7">
              <label className="form-label">Numero de serie</label>
              <input
                className="form-control"
                name="numero_serie"
                value={form.numero_serie}
                onBlur={lookupProducto}
                onChange={handleChange}
                placeholder="SC-ACME-0001"
                required
              />
            </div>

            <div className="col-md-5">
              <label className="form-label">Tipo de orden</label>
              <select
                className="form-select"
                name="tipo_orden"
                value={form.tipo_orden}
                onChange={handleChange}
                required
              >
                {TIPOS_ORDEN.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label">Diagnostico inicial u observacion</label>
              <textarea
                className="form-control"
                name="diagnostico"
                value={form.diagnostico}
                onChange={handleChange}
                placeholder="Observacion inicial del ingreso a taller"
              />
            </div>
          </div>

          {isChecking ? <p className="text-secondary mt-3 mb-0">Validando producto...</p> : null}
          {error ? <p className="alert alert-danger mt-3 mb-0">{error}</p> : null}

          {producto ? (
            <div className="product-preview mt-3">
              <div>
                <span>Marca</span>
                <strong>{producto.marca}</strong>
              </div>
              <div>
                <span>Modelo</span>
                <strong>{producto.modelo}</strong>
              </div>
              <div>
                <span>Garantia</span>
                <StatusBadge value={producto.estado_garantia} />
              </div>
              <div>
                <span>Alerta propiedad</span>
                <strong>{producto.alerta_propiedad ? "Si" : "No"}</strong>
              </div>
            </div>
          ) : null}

          {producto?.alerta_propiedad ? (
            <p className="alert alert-warning mt-3 mb-0">
              Producto con alerta de propiedad registrada
            </p>
          ) : null}

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSubmitting || isChecking}
            >
              {isSubmitting ? "Creando..." : "Crear orden"}
            </button>
            <button
              className="btn btn-outline-secondary"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default NewOrderForm;
