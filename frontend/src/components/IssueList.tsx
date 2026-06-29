import { CaretRight } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { Issue, Severity } from "../types/contract";
import { SEVERITY_META } from "./brand";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export function IssueList({ issues }: { issues: Issue[] }) {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...issues].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      ),
    [issues]
  );
  const visible = filter === "all" ? sorted : sorted.filter((i) => i.severity === filter);

  const countBy = (s: Severity) => issues.filter((i) => i.severity === s).length;

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Findings <span className="text-slate-400">({issues.length})</span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`All ${issues.length}`} />
          {SEVERITY_ORDER.map((s) => (
            <FilterChip
              key={s}
              active={filter === s}
              onClick={() => setFilter(s)}
              label={`${SEVERITY_META[s].label} ${countBy(s)}`}
              dot={SEVERITY_META[s].dot}
            />
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-slate-400">
          No issues in this category. Nicely done.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((issue, idx) => {
            const key = `${issue.file}-${issue.line}-${idx}`;
            const open = openKey === key;
            const meta = SEVERITY_META[issue.severity];
            return (
              <li key={key}>
                <button
                  onClick={() => setOpenKey(open ? null : key)}
                  className="flex w-full items-start gap-3 py-3.5 text-left"
                >
                  <CaretRight
                    size={14}
                    className={`mt-1 shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`}
                  />
                  <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
                    {meta.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{issue.issue}</span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-slate-400">
                      {issue.file}
                      {issue.line ? `:${issue.line}` : ""}
                      <span className="ml-2 text-slate-300">· {issue.category}</span>
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="ml-[2.1rem] grid gap-3 pb-4 pr-2 sm:grid-cols-3">
                    <Detail label="Root cause" value={issue.rootCause} />
                    <Detail label="Impact" value={issue.impact} />
                    <Detail label="Suggested fix" value={issue.solution} accent />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
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
        active
          ? "border-accent/40 bg-accent/10 font-medium text-accent"
          : "border-line text-slate-500 hover:text-slate-900"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

function Detail({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-line p-3 ${accent ? "bg-accent/5" : "bg-slate-50"}`}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm leading-relaxed text-slate-600">{value}</p>
    </div>
  );
}
