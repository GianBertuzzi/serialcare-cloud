function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function StatusBadge({ value, children }) {
  const label = children || value || "Sin estado";
  const statusClass = normalizeStatus(label);

  return <span className={`status-badge status-${statusClass}`}>{label}</span>;
}

export default StatusBadge;
