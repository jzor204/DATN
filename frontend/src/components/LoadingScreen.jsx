export default function LoadingScreen({ label = "Loading..." }) {
  return (
    <div className="glass-panel flex min-h-[320px] items-center justify-center rounded-[28px] border border-white/70 shadow-panel">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
        <span className="h-3 w-3 animate-pulse rounded-full bg-ember" />
        {label}
      </div>
    </div>
  );
}
