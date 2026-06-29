import { CaretRight, CheckSquare, FileZip, GithubLogo, Square } from "@phosphor-icons/react";
import { SEVERITY_META, scoreColor } from "./brand";
import { Detail, FilterChip } from "./IssueControls";
import { CATEGORIES, SEVERITIES, type Category, type HealthReport, type Issue, type Severity } from "../types/contract";

/** The title/source/overall-score card at the top of the report. */
export function ReportScoreSummary({ report }: { report: HealthReport }) {
  return (
    <section className="card animate-fade-up">
      <h1 className="font-display text-4xl uppercase leading-[0.95] tracking-tight text-slate-900 sm:text-5xl">
        Project Health Report
      </h1>
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        {report.source.type === "github" ? <GithubLogo size={16} /> : <FileZip size={16} />}
        <span className="truncate font-mono text-xs">{report.source.ref}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Analyzed {new Date(report.createdAt).toLocaleString()} · Generated {new Date().toLocaleString()}
      </p>
      <div className="mt-6 flex items-end gap-3">
        <span className={`font-display text-6xl leading-none ${scoreColor(report.overallScore)}`}>
          {report.overallScore}
        </span>
        <span className="mb-1 text-xs uppercase tracking-wider text-slate-400">Overall health / 100</span>
      </div>
    </section>
  );
}

/** The per-category score bars card. */
export function ReportCategoryBreakdown({ report }: { report: HealthReport }) {
  return (
    <section className="card mt-6 animate-fade-up">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Category scores</h2>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <div key={c}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-slate-700">{c}</span>
              <span className={`font-mono font-medium ${scoreColor(report.categoryScores[c])}`}>
                {report.categoryScores[c]}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-accent" style={{ width: `${report.categoryScores[c]}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface IssueRow {
  issue: Issue;
  key: string;
}

interface ReportIssuesSectionProps {
  allRows: IssueRow[];
  visible: IssueRow[];
  selected: Set<string>;
  sevFilter: Severity | "all";
  catFilter: Category | "all";
  openKey: string | null;
  onToggle: (key: string) => void;
  onSelectAllVisible: () => void;
  onClearAll: () => void;
  onSevFilterChange: (s: Severity | "all") => void;
  onCatFilterChange: (c: Category | "all") => void;
  onOpenKeyChange: (key: string | null) => void;
}

/** The filterable, selectable issue list card -- the bulk of the report page. */
export function ReportIssuesSection({
  allRows,
  visible,
  selected,
  sevFilter,
  catFilter,
  openKey,
  onToggle,
  onSelectAllVisible,
  onClearAll,
  onSevFilterChange,
  onCatFilterChange,
  onOpenKeyChange,
}: ReportIssuesSectionProps) {
  const countBy = (s: Severity) => allRows.filter((r) => r.issue.severity === s).length;

  return (
    <section className="card mt-6 animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Issues <span className="text-accent">({selected.size} of {allRows.length} selected)</span>
        </h2>
        <div className="no-print flex items-center gap-2">
          <button onClick={onSelectAllVisible} className="text-xs font-medium text-accent hover:underline">
            Select all
          </button>
          <span className="text-slate-300">·</span>
          <button onClick={onClearAll} className="text-xs font-medium text-slate-500 hover:text-slate-900">
            Clear
          </button>
        </div>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-center gap-1.5">
        <FilterChip active={sevFilter === "all"} onClick={() => onSevFilterChange("all")} label={`All ${allRows.length}`} />
        {SEVERITIES.map((s) => (
          <FilterChip
            key={s}
            active={sevFilter === s}
            onClick={() => onSevFilterChange(s)}
            label={`${SEVERITY_META[s].label} ${countBy(s)}`}
            dot={SEVERITY_META[s].dot}
          />
        ))}
        <select
          value={catFilter}
          onChange={(e) => onCatFilterChange(e.target.value as Category | "all")}
          className="ml-1 rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 outline-none focus:border-accent/60"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-slate-400">
          No issues match this filter.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map(({ issue, key }) => {
            const isSel = selected.has(key);
            const open = openKey === key;
            const meta = SEVERITY_META[issue.severity];
            return (
              <li key={key} className={`-mx-2 rounded-xl px-2 transition ${isSel ? "bg-accent/[0.04]" : "is-unselected"}`}>
                <div className="flex items-start gap-3 py-3.5">
                  <button
                    onClick={() => onToggle(key)}
                    className={`no-print mt-0.5 shrink-0 transition ${isSel ? "text-accent" : "text-slate-300 hover:text-slate-500"}`}
                    aria-label={isSel ? "Deselect issue" : "Select issue"}
                    aria-pressed={isSel}
                  >
                    {isSel ? <CheckSquare size={20} weight="fill" /> : <Square size={20} />}
                  </button>
                  <button
                    onClick={() => onOpenKeyChange(open ? null : key)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
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
                    <CaretRight
                      size={14}
                      className={`no-print mt-1 shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`}
                    />
                  </button>
                </div>

                <div className={`issue-details ${open ? "open" : ""} ml-[2.4rem] gap-3 pb-4 pr-2 sm:grid-cols-3`}>
                  <Detail label="Root cause" value={issue.rootCause} />
                  <Detail label="Impact" value={issue.impact} />
                  <Detail label="Suggested fix" value={issue.solution} accent />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
