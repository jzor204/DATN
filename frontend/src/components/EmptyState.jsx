export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <h3 className="text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
