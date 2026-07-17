import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import api from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/format.js";

const configs = {
  productos: {
    title: "Maquinas / productos consulta",
    endpoint: "/productos",
    collection: "productos",
    search: "Buscar por serie, cliente, marca o modelo",
    columns: [
      { key: "numero_serie", label: "Serie", searchValue: (p) => p.numero_serie, render: (p) => <strong>{p.numero_serie}</strong> },
      { key: "cliente", label: "Cliente", searchValue: (p) => p.cliente_nombre || "", render: (p) => p.cliente_nombre || "Sin cliente" },
      { key: "marca", label: "Marca", searchValue: (p) => p.marca || "" },
      { key: "modelo", label: "Modelo", searchValue: (p) => p.modelo || "" },
      { key: "garantia", label: "Garantia", searchValue: (p) => p.estado_garantia, render: (p) => <StatusBadge value={p.estado_garantia} /> },
      { key: "fecha", label: "Fecha", searchValue: (p) => formatDate(p.fecha_registro), sortValue: (p) => p.fecha_registro, render: (p) => formatDate(p.fecha_registro) }
    ]
  },
  repuestos: {
    title: "Consulta repuestos",
    endpoint: "/repuestos",
    collection: "repuestos",
    search: "Buscar por codigo, nombre o marca",
    columns: [
      { key: "codigo", label: "Codigo", searchValue: (r) => r.codigo || "" },
      { key: "nombre", label: "Nombre", searchValue: (r) => r.nombre, render: (r) => <strong>{r.nombre}</strong> },
      { key: "marca", label: "Marca", searchValue: (r) => r.marca || "" },
      { key: "precio", label: "Precio", searchValue: (r) => r.precio, sortValue: (r) => Number(r.precio || 0), render: (r) => formatCurrency(r.precio) },
      { key: "stock", label: "Stock", searchValue: (r) => r.stock, sortValue: (r) => Number(r.stock || 0) },
      { key: "estado", label: "Estado", searchValue: (r) => r.estado, render: (r) => <StatusBadge value={r.estado} /> }
    ]
  },
  garantias: {
    title: "Solicitudes / seguimiento",
    endpoint: "/garantias",
    collection: "garantias",
    search: "Buscar por orden, serie, producto o estado",
    columns: [
      { key: "id_orden", label: "Orden", searchValue: (g) => g.id_orden, sortValue: (g) => Number(g.id_orden || 0), render: (g) => `#${g.id_orden}` },
      { key: "numero_serie", label: "Serie", searchValue: (g) => g.numero_serie, render: (g) => <strong>{g.numero_serie}</strong> },
      { key: "producto", label: "Producto", searchValue: (g) => `${g.marca || ""} ${g.modelo || ""}`, render: (g) => [g.marca, g.modelo].filter(Boolean).join(" - ") },
      { key: "estado", label: "Estado", searchValue: (g) => g.estado, render: (g) => <StatusBadge value={g.estado} /> },
      { key: "fecha", label: "Fecha", searchValue: (g) => formatDate(g.fecha_solicitud), sortValue: (g) => g.fecha_solicitud, render: (g) => formatDate(g.fecha_solicitud) }
    ]
  }
};

function TecnicoConsultaPage({ type }) {
  const config = configs[type];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(config.endpoint);
        if (mounted) setRows(response.data[config.collection] || []);
      } catch (requestError) {
        if (mounted) setError(requestError.response?.data?.error || "No se pudieron cargar los datos.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [config]);

  return (
    <AppLayout title={config.title} eyebrow="TECNICO">
      <DataTable title={config.title} eyebrow="Consulta sucursal" rows={rows} columns={config.columns} getRowKey={(row) => row.id_producto || row.id_cliente || row.id_repuesto || row.id_garantia} searchPlaceholder={config.search} emptyMessage="No hay registros." loading={loading} error={error} />
    </AppLayout>
  );
}

export default TecnicoConsultaPage;