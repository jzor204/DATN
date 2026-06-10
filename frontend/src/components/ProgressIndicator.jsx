import { normalizeTaskProgress } from "../utils/format";

function getProgressTone(progress) {
  if (progress >= 100) {
    return "bg-emerald-500";
  }
  if (progress >= 70) {
    return "bg-blue-600";
  }
  if (progress >= 35) {
    return "bg-amber-500";
  }
  return "bg-slate-500";
}

export default function ProgressIndicator({ progress, compact = false }) {
  const value = normalizeTaskProgress(progress);

  return (
    <div className={compact ? "min-w-[120px]" : "w-full"}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-600">Tiến độ</span>
        <span className="font-semibold text-ink">{value}%</span>
      </div>
      <div className={`${compact ? "h-1.5" : "h-2"} overflow-hidden rounded-full bg-slate-200`}>
        <div
          className={`${getProgressTone(value)} h-full rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
