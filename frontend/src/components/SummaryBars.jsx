function toneClass(index) {
  return ["primary", "success", "warning", "danger", "secondary"][index % 5];
}

function SummaryBars({ title, rows }) {
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0) || 1;

  return (
    <section className="card surface-card border-0 shadow-sm summary-card">
      <div className="card-body">
        <h2 className="h5 mb-3">{title}</h2>
        <div className="summary-bars">
          {rows.map((row, index) => {
            const width = Math.round((Number(row.value || 0) / total) * 100);
            return (
              <div className="summary-bar-row" key={row.label}>
                <div className="d-flex justify-content-between gap-3">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
                <div className="progress" role="progressbar" aria-valuenow={width} aria-valuemin="0" aria-valuemax="100">
                  <div className={`progress-bar sc-progress-${toneClass(index)}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default SummaryBars;