export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total_pages <= 1) {
    return null;
  }

  const currentPage = pagination.page;
  const totalPages = pagination.total_pages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
      <p className="text-sm text-slate-600">
        Page <span className="font-semibold text-ink">{currentPage}</span> / {totalPages} - Total{" "}
        <span className="font-semibold text-ink">{pagination.total}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          Previous
        </button>
        <button
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
