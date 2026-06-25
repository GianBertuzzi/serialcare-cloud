export function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha invalida";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "SIN_DATO";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}