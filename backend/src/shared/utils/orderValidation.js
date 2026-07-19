function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTipoAtencion(value) {
  const tipo = clean(value || "REPARACION").toUpperCase();
  if (tipo === "MANTENIMIENTO") return "MANTENCION";
  if (tipo === "GARANTIA") return "REVISION_GARANTIA";
  return tipo;
}

function parsePositiveInteger(value, defaultValue) {
  const numberValue = value === undefined || value === null || value === "" ? defaultValue : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) return null;
  return numberValue;
}

function parseMoney(value, defaultValue = 0) {
  const numberValue = value === undefined || value === null || value === "" ? defaultValue : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue);
}

function parseNonNegativeDecimal(value) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

module.exports = {
  clean,
  normalizeTipoAtencion,
  parsePositiveInteger,
  parseMoney,
  parseNonNegativeDecimal
};
