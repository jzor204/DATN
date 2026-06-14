import { formatTaskPriority, normalizeTaskPriority } from "../utils/format";

const priorityToneMap = {
  none: "bg-slate-100 text-slate-600",
  low: "bg-sky-100 text-sky-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-700"
};

export default function PriorityBadge({ priority }) {
  const normalized = normalizeTaskPriority(priority);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        priorityToneMap[normalized] || priorityToneMap.none
      }`}
    >
      {formatTaskPriority(normalized)}
    </span>
  );
}
