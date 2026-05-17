import { formatTaskStatus } from "../utils/format";

const statusToneMap = {
  todo: "bg-slate-100 text-slate-700",
  "in-progress": "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-800"
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        statusToneMap[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {formatTaskStatus(status)}
    </span>
  );
}
