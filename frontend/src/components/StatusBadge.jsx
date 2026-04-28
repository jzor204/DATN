import { formatTaskStatus } from "../utils/format";

const statusToneMap = {
  todo: "bg-amber-100 text-amber-800",
  "in-progress": "bg-sky-100 text-sky-800",
  in_progress: "bg-sky-100 text-sky-800",
  done: "bg-emerald-100 text-emerald-800"
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
        statusToneMap[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {formatTaskStatus(status)}
    </span>
  );
}
