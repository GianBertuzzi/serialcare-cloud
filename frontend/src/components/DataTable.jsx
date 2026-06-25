import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 8;

function getColumnValue(column, row) {
  if (column.sortValue) {
    return column.sortValue(row);
  }

  if (column.searchValue) {
    return column.searchValue(row);
  }

  return row[column.key];
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  const aDate = Date.parse(a);
  const bDate = Date.parse(b);

  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return aDate - bDate;
  }

  const aNumber = Number(a);
  const bNumber = Number(b);

  if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
}

function DataTable({
  title,
  eyebrow,
  rows,
  columns,
  getRowKey,
  searchPlaceholder = "Buscar...",
  emptyMessage = "No hay registros.",
  loading = false,
  loadingMessage = "Cargando...",
  error = "",
  pageSize = DEFAULT_PAGE_SIZE,
  initialSortKey,
  toolbarAction,
  sectionId
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(initialSortKey || columns[0]?.key);
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);

  const searchableColumns = columns.filter((column) => column.searchable !== false);
  const sortableColumns = columns.filter((column) => column.sortable !== false);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return rows;
    }

    return rows.filter((row) =>
      searchableColumns.some((column) => {
        const value = column.searchValue
          ? column.searchValue(row)
          : getColumnValue(column, row);
        return normalize(value).includes(term);
      })
    );
  }, [rows, search, searchableColumns]);

  const sortedRows = useMemo(() => {
    const activeColumn = sortableColumns.find((column) => column.key === sortKey);

    if (!activeColumn) {
      return filteredRows;
    }

    return [...filteredRows].sort((left, right) => {
      const result = compareValues(
        getColumnValue(activeColumn, left),
        getColumnValue(activeColumn, right)
      );

      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredRows, sortDirection, sortKey, sortableColumns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  function handleSort(column) {
    if (column.sortable === false) {
      return;
    }

    if (sortKey === column.key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDirection("asc");
    }

    setPage(1);
  }

  return (
    <section id={sectionId} className="card surface-card data-table-section border-0 shadow-sm">
      <div className="card-header bg-white border-0 data-table-toolbar">
        <div>
          {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
          <h2 className="h5 mb-1">{title}</h2>
          <p className="table-count mb-0">
            {filteredRows.length} de {rows.length} registros
          </p>
        </div>
        <div className="table-toolbar-actions">
          <input
            className="form-control table-search"
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
          />
          {toolbarAction ? (
            <button
              className={toolbarAction.className || "btn btn-outline-secondary"}
              type="button"
              disabled={toolbarAction.disabled}
              onClick={toolbarAction.onClick}
            >
              {toolbarAction.label}
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <div className="card-body text-secondary">{loadingMessage}</div> : null}
      {error ? (
        <div className="card-body pt-0">
          <p className="alert alert-danger mb-0">{error}</p>
        </div>
      ) : null}

      {!loading && !error && sortedRows.length === 0 ? (
        <div className="card-body">
          <p className="empty-state mb-0">{emptyMessage}</p>
        </div>
      ) : null}

      {!loading && !error && sortedRows.length > 0 ? (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-middle serial-table mb-0">
              <thead>
                <tr>
                  {columns.map((column) => {
                    const isActive = sortKey === column.key;
                    const indicator = isActive
                      ? sortDirection === "asc"
                        ? " ^"
                        : " v"
                      : "";

                    return (
                      <th key={column.key} className={column.headerClassName || ""}>
                        {column.sortable === false ? (
                          column.label
                        ) : (
                          <button
                            className="sort-button"
                            type="button"
                            onClick={() => handleSort(column)}
                          >
                            {column.label}{indicator}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={getRowKey(row)}>
                    {columns.map((column) => (
                      <td key={column.key} className={column.className || ""}>
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <div className="card-footer bg-white border-0 pagination-bar">
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </button>
              <span>
                Pagina {currentPage} de {pageCount}
              </span>
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                disabled={currentPage === pageCount}
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default DataTable;
