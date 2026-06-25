const CHILE_TIME_ZONE = "America/Santiago";

function normalizeDateInput(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasTime = trimmed.includes("T") || trimmed.includes(" ");
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);

  if (hasTime && !hasTimeZone) {
    return `${trimmed.replace(" ", "T")}Z`;
  }

  return trimmed;
}

function getDateParts(value, options) {
  if (!value) return null;

  const normalizedValue = normalizeDateInput(value);
  const date = normalizedValue instanceof Date ? normalizedValue : new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TIME_ZONE,
    hourCycle: "h23",
    ...options
  });

  return formatter.formatToParts(date).reduce((parts, part) => {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
    return parts;
  }, {});
}

export function formatDateTimeChile(value) {
  const parts = getDateParts(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  if (!parts) return "Sin fecha";

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatDateCLP(value) {
  const parts = getDateParts(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  if (!parts) return "Sin fecha";

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export const formatDateTimeCLP = formatDateTimeChile;

export function formatDate(value) {
  return formatDateTimeChile(value);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export const formatCurrencyCLP = formatCurrency;

export function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "SIN_DATO";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}