import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "./StatusBadge.jsx";
import api from "../services/api";
import { formatCurrency } from "../utils/format.js";

const TIPOS_ORDEN = ["REPARACION", "REVISION_GARANTIA", "MANTENCION", "PUESTA_EN_MARCHA"];

const initialForm = {
  id_cliente: "",
  cliente_mode: "existente",
  cliente_search: "",
  cliente_nombre: "",
  cliente_rut: "",
  cliente_telefono: "",
  cliente_email: "",
  cliente_direccion: "",
  producto_mode: "existente",
  producto_search: "",
  id_producto: "",
  numero_serie: "",
  marca: "",
  modelo: "",
  id_tipo_maquina: "",
  descripcion_producto: "",
  estado_garantia: "PENDIENTE",
  alerta_propiedad: "false",
  tipo_orden: "REPARACION",
  descripcion_problema: "",
  accesorios_recibidos: "",
  observaciones_recepcion: ""
};

function NewOrderForm({ onCancel, onCreated }) {
  const { user } = useAuth();
  const canCreateRelatedRecords = ["ADMIN", "RECEPCIONISTA"].includes(user?.rol);
  const [form, setForm] = useState(initialForm);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tiposMaquina, setTiposMaquina] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegisteringProducto, setIsRegisteringProducto] = useState(false);

  async function loadCatalogos() {
    setIsLoading(true);
    setError("");

    try {
      const [clientesResponse, productosResponse, tiposResponse] = await Promise.all([
        api.get("/clientes"),
        api.get("/productos"),
        api.get("/tipos-maquina")
      ]);

      const nextClientes = clientesResponse.data.clientes || [];
      const nextProductos = productosResponse.data.productos || [];
      const nextTipos = tiposResponse.data.tipos_maquina || tiposResponse.data.tipos || [];
      const firstClient = nextClientes[0] || null;
      const firstProduct = firstClient
        ? nextProductos.find((producto) => Number(producto.id_cliente) === Number(firstClient.id_cliente))
        : null;

      setClientes(nextClientes);
      setProductos(nextProductos);
      setTiposMaquina(nextTipos);
      setForm((current) => ({
        ...current,
        id_cliente: firstClient ? String(firstClient.id_cliente) : "",
        id_producto: firstProduct ? String(firstProduct.id_producto) : "",
        id_tipo_maquina: nextTipos[0] ? String(nextTipos[0].id_tipo_maquina) : ""
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudieron cargar los datos para crear la orden.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogos();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "cliente_mode") {
      setForm((current) => ({
        ...current,
        cliente_mode: value,
        id_cliente: value === "nuevo" ? "" : current.id_cliente,
        producto_mode: value === "nuevo" ? "nuevo" : current.producto_mode,
        id_producto: ""
      }));
      return;
    }

    if (name === "id_cliente") {
      const firstProduct = productos.find((producto) => Number(producto.id_cliente) === Number(value));
      setForm((current) => ({
        ...current,
        id_cliente: value,
        id_producto: firstProduct ? String(firstProduct.id_producto) : ""
      }));
      return;
    }

    if (name === "id_producto") {
      const producto = productos.find((item) => String(item.id_producto) === String(value));
      setForm((current) => ({
        ...current,
        id_producto: value,
        id_cliente: producto ? String(producto.id_cliente) : current.id_cliente
      }));
      return;
    }

    if (name === "producto_mode") {
      setForm((current) => ({ ...current, producto_mode: value, id_producto: "" }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  const clienteSearch = form.cliente_search.trim().toLowerCase();
  const productoSearch = form.producto_search.trim().toLowerCase();
  const filteredClientes = clientes.filter((cliente) =>
    !clienteSearch || [cliente.nombre, cliente.rut].some((value) =>
      String(value || "").toLowerCase().includes(clienteSearch)
    )
  );
  const filteredProductos = productos.filter((producto) => {
    const cliente = clientes.find((item) => Number(item.id_cliente) === Number(producto.id_cliente));
    const matchesCliente = !form.id_cliente || Number(producto.id_cliente) === Number(form.id_cliente);
    const matchesSearch = [producto.numero_serie, producto.marca, producto.modelo, cliente?.nombre, cliente?.rut]
      .some((value) => String(value || "").toLowerCase().includes(productoSearch));

    return productoSearch ? matchesSearch : matchesCliente;
  });
  const selectedProducto = productos.find((producto) => String(producto.id_producto) === String(form.id_producto));
  const selectedTipoMaquina = tiposMaquina.find((tipo) => String(tipo.id_tipo_maquina) === String(form.id_tipo_maquina));
  const garantiaVencida = selectedProducto?.estado_garantia === "VENCIDA" && form.tipo_orden === "REVISION_GARANTIA";

  function buildPayload() {
    const payload = {
      tipo_orden: form.tipo_orden,
      descripcion_problema: form.descripcion_problema.trim(),
      accesorios_recibidos: form.accesorios_recibidos.trim(),
      observaciones_recepcion: form.observaciones_recepcion.trim()
    };

    if (form.cliente_mode === "nuevo") {
      payload.cliente_nuevo = {
        nombre: form.cliente_nombre.trim(),
        rut: form.cliente_rut.trim(),
        telefono: form.cliente_telefono.trim(),
        email: form.cliente_email.trim(),
        direccion: form.cliente_direccion.trim()
      };
    } else {
      payload.id_cliente = Number(form.id_cliente);
    }

    if (form.producto_mode === "nuevo") {
      payload.producto_nuevo = {
        numero_serie: form.numero_serie.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        id_tipo_maquina: Number(form.id_tipo_maquina),
        descripcion: form.descripcion_producto.trim(),
        estado_garantia: form.estado_garantia,
        alerta_propiedad: form.alerta_propiedad === "true"
      };
    } else {
      payload.id_producto = Number(form.id_producto);
    }

    return payload;
  }

  function validateForm() {
    if (form.cliente_mode === "existente" && !form.id_cliente) return "Selecciona un cliente o crea uno nuevo.";
    if (form.cliente_mode === "nuevo" && !form.cliente_nombre.trim()) return "Nombre del cliente es obligatorio.";
    if (form.producto_mode === "existente" && !form.id_producto) return "Selecciona una maquina o registra una nueva.";
    if (form.producto_mode === "nuevo" && (!form.numero_serie.trim() || !form.marca.trim() || !form.modelo.trim())) return "Serie, marca y modelo de la maquina son obligatorios.";
    if (form.producto_mode === "nuevo" && !form.id_tipo_maquina) return "Selecciona un tipo de maquina.";
    if (!form.tipo_orden) return "Selecciona un tipo de orden.";
    if (!form.descripcion_problema.trim()) return "Descripcion del problema es obligatoria.";
    return "";
  }

  async function handleRegisterProducto() {
    if (form.cliente_mode !== "existente" || !form.id_cliente) {
      setError("Selecciona un cliente existente antes de registrar la maquina.");
      return;
    }

    if (!form.numero_serie.trim() || !form.marca.trim() || !form.modelo.trim()) {
      setError("Serie, marca y modelo de la maquina son obligatorios.");
      return;
    }

    if (!form.id_tipo_maquina) {
      setError("Selecciona un tipo de maquina.");
      return;
    }

    setIsRegisteringProducto(true);
    setError("");
    setNotice("");

    try {
      const response = await api.post("/productos", {
        id_cliente: Number(form.id_cliente),
        numero_serie: form.numero_serie.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        id_tipo_maquina: Number(form.id_tipo_maquina),
        descripcion: form.descripcion_producto.trim(),
        estado_garantia: form.estado_garantia,
        alerta_propiedad: form.alerta_propiedad === "true"
      });
      const producto = response.data.producto;

      setProductos((current) => [producto, ...current.filter((item) => item.id_producto !== producto.id_producto)]);
      setForm((current) => ({
        ...current,
        producto_mode: "existente",
        producto_search: producto.numero_serie,
        id_producto: String(producto.id_producto),
        id_cliente: String(producto.id_cliente),
        numero_serie: "",
        marca: "",
        modelo: "",
        descripcion_producto: "",
        estado_garantia: "PENDIENTE",
        alerta_propiedad: "false"
      }));
      setNotice("Maquina registrada y seleccionada para la orden.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo registrar la maquina.");
    } finally {
      setIsRegisteringProducto(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await api.post("/ordenes", buildPayload());
      setForm(initialForm);
      await onCreated(response.data.orden);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "No se pudo crear la orden.");
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
        {isLoading ? <p className="text-secondary">Cargando formulario...</p> : null}
        <form className="order-form" onSubmit={handleSubmit}>
          <p className="form-section-heading">1. Cliente</p>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label">Modo cliente</label>
              <select className="form-select" name="cliente_mode" value={form.cliente_mode} onChange={handleChange}>
                <option value="existente">Cliente existente</option>
                {canCreateRelatedRecords ? <option value="nuevo">Crear cliente nuevo</option> : null}
              </select>
            </div>

            {form.cliente_mode === "existente" ? (
              <>
                <div className="col-md-4">
                  <label className="form-label">Buscar cliente</label>
                  <input
                    className="form-control"
                    name="cliente_search"
                    value={form.cliente_search}
                    onChange={handleChange}
                    placeholder="Nombre o RUT"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Cliente</label>
                  <select className="form-select" name="id_cliente" value={form.id_cliente} onChange={handleChange}>
                    <option value="">Seleccionar cliente</option>
                    {filteredClientes.map((cliente) => (
                      <option key={cliente.id_cliente} value={cliente.id_cliente}>
                        {cliente.nombre}{cliente.rut ? ` - ${cliente.rut}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="col-md-4"><label className="form-label">Nombre cliente</label><input className="form-control" name="cliente_nombre" value={form.cliente_nombre} onChange={handleChange} required /></div>
                <div className="col-md-4"><label className="form-label">RUT</label><input className="form-control" name="cliente_rut" value={form.cliente_rut} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Telefono</label><input className="form-control" name="cliente_telefono" value={form.cliente_telefono} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Email</label><input className="form-control" name="cliente_email" value={form.cliente_email} onChange={handleChange} /></div>
                <div className="col-md-8"><label className="form-label">Direccion</label><input className="form-control" name="cliente_direccion" value={form.cliente_direccion} onChange={handleChange} /></div>
              </>
            )}
          </div>

          <p className="form-section-heading">2. Maquina</p>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label">Modo maquina</label>
              <select className="form-select" name="producto_mode" value={form.producto_mode} onChange={handleChange} disabled={form.cliente_mode === "nuevo"}>
                <option value="existente">Maquina existente</option>
                {canCreateRelatedRecords ? <option value="nuevo">Registrar maquina nueva</option> : null}
              </select>
            </div>

            {form.producto_mode === "existente" ? (
              <>
                <div className="col-md-4">
                  <label className="form-label">Buscar maquina</label>
                  <input
                    className="form-control"
                    name="producto_search"
                    value={form.producto_search}
                    onChange={handleChange}
                    placeholder="Serie, cliente, RUT, marca o modelo"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Maquina</label>
                  <select className="form-select" name="id_producto" value={form.id_producto} onChange={handleChange}>
                    <option value="">Seleccionar maquina</option>
                    {filteredProductos.map((producto) => (
                      <option key={producto.id_producto} value={producto.id_producto}>
                        {producto.numero_serie} - {producto.marca} {producto.modelo}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="col-md-3"><label className="form-label">Numero de serie</label><input className="form-control" name="numero_serie" value={form.numero_serie} onChange={handleChange} required /></div>
                <div className="col-md-3"><label className="form-label">Marca</label><input className="form-control" name="marca" value={form.marca} onChange={handleChange} required /></div>
                <div className="col-md-3"><label className="form-label">Modelo</label><input className="form-control" name="modelo" value={form.modelo} onChange={handleChange} required /></div>
                <div className="col-md-3"><label className="form-label">Tipo de maquina</label><select className="form-select" name="id_tipo_maquina" value={form.id_tipo_maquina} onChange={handleChange} required><option value="">Seleccionar tipo</option>{tiposMaquina.map((tipo) => <option key={tipo.id_tipo_maquina} value={tipo.id_tipo_maquina}>{tipo.nombre} - {formatCurrency(tipo.valor_ingreso)}</option>)}</select></div>
                <div className="col-md-5"><label className="form-label">Descripcion</label><input className="form-control" name="descripcion_producto" value={form.descripcion_producto} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Estado garantia</label><select className="form-select" name="estado_garantia" value={form.estado_garantia} onChange={handleChange}><option value="ACTIVA">ACTIVA</option><option value="VENCIDA">VENCIDA</option><option value="PENDIENTE">PENDIENTE</option><option value="EN_REVISION">EN_REVISION</option></select></div>
                <div className="col-md-3"><label className="form-label">Alerta propiedad</label><select className="form-select" name="alerta_propiedad" value={form.alerta_propiedad} onChange={handleChange}><option value="false">No</option><option value="true">Si</option></select></div>
                <div className="col-12">
                  {form.cliente_mode === "existente" ? (
                    <button
                      className="btn btn-outline-primary"
                      type="button"
                      disabled={isRegisteringProducto || isSubmitting}
                      onClick={handleRegisterProducto}
                    >
                      {isRegisteringProducto ? "Registrando maquina..." : "Registrar maquina"}
                    </button>
                  ) : (
                    <p className="alert alert-info mb-0">
                      El cliente y la maquina se registraran al crear la orden.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {selectedProducto ? (
            <div className="product-preview mb-3">
              <div><span>Serie</span><strong>{selectedProducto.numero_serie}</strong></div>
              <div><span>Marca</span><strong>{selectedProducto.marca}</strong></div>
              <div><span>Modelo</span><strong>{selectedProducto.modelo}</strong></div>
              <div><span>Tipo de maquina</span><strong>{selectedProducto.tipo_maquina || "Sin tipo"}</strong></div>
              <div><span>Valor ingreso</span><strong>{formatCurrency(selectedProducto.valor_ingreso)}</strong></div>
              <div><span>Garantia</span><StatusBadge value={selectedProducto.estado_garantia} /></div>
              <div><span>Alerta</span><strong>{selectedProducto.alerta_propiedad ? "Si" : "No"}</strong></div>
            </div>
          ) : null}

          {form.producto_mode === "nuevo" && selectedTipoMaquina ? <p className="alert alert-info mb-3">Valor ingreso para {selectedTipoMaquina.nombre}: {formatCurrency(selectedTipoMaquina.valor_ingreso)}</p> : null}
          {garantiaVencida ? <p className="alert alert-warning mb-3">La garantia del equipo esta vencida. Revise si corresponde atencion por garantia interna.</p> : null}

          <p className="form-section-heading">3. Atencion</p>
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label">Tipo de orden</label><select className="form-select" name="tipo_orden" value={form.tipo_orden} onChange={handleChange} required>{TIPOS_ORDEN.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></div>
            <div className="col-12"><label className="form-label">Descripcion del problema</label><textarea className="form-control" name="descripcion_problema" value={form.descripcion_problema} onChange={handleChange} required /></div>
            <div className="col-md-6"><label className="form-label">Accesorios recibidos</label><textarea className="form-control" name="accesorios_recibidos" value={form.accesorios_recibidos} onChange={handleChange} /></div>
            <div className="col-md-6"><label className="form-label">Observaciones de recepcion</label><textarea className="form-control" name="observaciones_recepcion" value={form.observaciones_recepcion} onChange={handleChange} /></div>
          </div>

          {notice ? <p className="alert alert-success mt-3 mb-0">{notice}</p> : null}
          {error ? <p className="alert alert-danger mt-3 mb-0">{error}</p> : null}

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button className="btn btn-primary" type="submit" disabled={isSubmitting || isRegisteringProducto || isLoading}>{isSubmitting ? "Creando..." : "Crear orden"}</button>
            <button className="btn btn-outline-secondary" type="button" disabled={isSubmitting || isRegisteringProducto} onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default NewOrderForm;