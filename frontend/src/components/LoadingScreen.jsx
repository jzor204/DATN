export default function LoadingScreen({ label = "Loading..." }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-slate-200 bg-white shadow-panel">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-600" />
        {label}
      </div>
    </div>
  );
}
