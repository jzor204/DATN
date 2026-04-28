export default function SectionCard({ title, eyebrow, description, children, action }) {
  return (
    <section className="glass-panel rounded-[28px] border border-white/70 px-5 py-5 shadow-panel">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-tide">{eyebrow}</p>
          ) : null}
          <h2 className="mt-2 text-2xl text-ink">{title}</h2>
          {description ? <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
