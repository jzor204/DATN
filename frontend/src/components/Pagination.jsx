export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total_pages <= 1) {
    return null;
  }

  const currentPage = pagination.page;
  const totalPages = pagination.total_pages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-600">
        Trang <span className="font-semibold text-ink">{currentPage}</span> / {totalPages} - Tổng{" "}
        <span className="font-semibold text-ink">{pagination.total}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          Trước
        </button>
        <button
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          Tiếp
        </button>
      </div>
    </div>
  );
}
