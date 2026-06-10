import { formatDeadlineState, getDeadlineState } from "../utils/format";

const deadlineToneMap = {
  none: "bg-slate-100 text-slate-600",
  completed: "bg-emerald-100 text-emerald-800",
  invalid: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-700",
  today: "bg-amber-100 text-amber-800",
  soon: "bg-orange-100 text-orange-800",
  scheduled: "bg-indigo-100 text-indigo-700"
};

export default function DeadlineBadge({ deadline, status }) {
  const state = getDeadlineState(deadline, status);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        deadlineToneMap[state] || deadlineToneMap.none
      }`}
    >
      {formatDeadlineState(state)}
    </span>
  );
}
