/** Small presentational primitives shared by IssueList and the Report page. */

export function FilterChip({
  active,
  onClick,
  label,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-accent/40 bg-accent/10 font-medium text-accent" : "border-line text-slate-500 hover:text-slate-900"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

export function Detail({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-line p-3 ${accent ? "bg-accent/5" : "bg-slate-50"}`}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm leading-relaxed text-slate-600">{value}</p>
    </div>
  );
}
