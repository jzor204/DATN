export default function SectionCard({ title, eyebrow, description, children, action }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-panel">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
