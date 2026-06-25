function StatCard({ title, value, detail, tone = "primary", label }) {
  return (
    <article className="card stat-card border-0 shadow-sm h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div className={`stat-icon stat-${tone}`}>{label || String(title || "").slice(0, 2)}</div>
        <div className="min-w-0">
          <p className="stat-title mb-1">{title}</p>
          <strong className="stat-value">{value}</strong>
          {detail ? <p className="stat-detail mb-0">{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}

export default StatCard;
