import {
  ArrowLeft,
  CaretRight,
  CheckSquare,
  FileHtml,
  FilePdf,
  FileZip,
  GithubLogo,
  MarkdownLogo,
  Square,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { Brand, SEVERITY_META, scoreColor } from "../components/brand";
import { LoadingBoxes } from "../components/LoadingBoxes";
import {
  buildReportHtml,
  buildReportMarkdown,
  downloadBlob,
  issueKey,
  reportFileBase,
  sortIssues,
} from "../lib/reportExport";
import { CATEGORIES, type Category, type HealthReport, type Severity } from "../types/contract";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export function Report() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const stateReport = (location.state as { report?: HealthReport } | null)?.report;

  const [report, setReport] = useState<HealthReport | null>(stateReport ?? null);
  const [loading, setLoading] = useState(!stateReport);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (report || !id) return;
    setLoading(true);
    api
      .getReport(id)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load this report."))
      .finally(() => setLoading(false));
  }, [id, report]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LoadingBoxes />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-rose-600">{error ?? "Report not found."}</p>
        <button onClick={() => navigate("/")} className="btn-ghost text-xs">
          <ArrowLeft size={14} /> Back to inspector
        </button>
      </div>
    );
  }

  return <ReportView report={report} onBack={() => navigate(-1)} />;
}

function ReportView({ report, onBack }: { report: HealthReport; onBack: () => void }) {
  // Pre-compute a stable {issue, key} list once so selection survives filter changes.
  const allRows = useMemo(
    () => sortIssues(report.issues).map((issue, i) => ({ issue, key: issueKey(issue, i) })),
    [report.issues]
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allRows.map((r) => r.key)));
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const visible = allRows.filter(
    (r) =>
      (sevFilter === "all" || r.issue.severity === sevFilter) &&
      (catFilter === "all" || r.issue.category === catFilter)
  );
  const selectedIssues = allRows.filter((r) => selected.has(r.key)).map((r) => r.issue);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected((prev) => new Set([...prev, ...visible.map((r) => r.key)]));
  }
  function clearAll() {
    setSelected(new Set());
  }

  function downloadHtml() {
    downloadBlob(`${reportFileBase(report)}.html`, buildReportHtml(report, selectedIssues), "text/html");
  }
  function downloadMarkdown() {
    downloadBlob(`${reportFileBase(report)}.md`, buildReportMarkdown(report, selectedIssues), "text/markdown");
  }

  const countBy = (s: Severity) => allRows.filter((r) => r.issue.severity === s).length;

  return (
    <div className="min-h-[100dvh]">
      {/* Toolbar — hidden when printing so the PDF is just the report. */}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-ghost !px-3 !py-2 text-xs" aria-label="Back">
              <ArrowLeft size={14} /> Back
            </button>
            <span className="hidden sm:block">
              <Brand compact />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadHtml} className="btn-ghost !px-3.5 !py-2 text-xs" title="Download as HTML">
              <FileHtml size={15} weight="bold" /> HTML
            </button>
            <button onClick={downloadMarkdown} className="btn-ghost !px-3.5 !py-2 text-xs" title="Download as Markdown">
              <MarkdownLogo size={15} weight="bold" /> Markdown
            </button>
            <button onClick={() => window.print()} className="btn-primary !px-3.5 !py-2 text-xs" title="Save as PDF">
              <FilePdf size={15} weight="bold" /> PDF
            </button>
          </div>
        </div>
      </header>

      <main className="report-sheet mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* Header */}
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

        {/* Category scores */}
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

        {/* Issues with selection + filters */}
        <section className="card mt-6 animate-fade-up">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Issues <span className="text-accent">({selected.size} of {allRows.length} selected)</span>
            </h2>
            <div className="no-print flex items-center gap-2">
              <button onClick={selectAllVisible} className="text-xs font-medium text-accent hover:underline">
                Select all
              </button>
              <span className="text-slate-300">·</span>
              <button onClick={clearAll} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                Clear
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="no-print mb-4 flex flex-wrap items-center gap-1.5">
            <FilterChip active={sevFilter === "all"} onClick={() => setSevFilter("all")} label={`All ${allRows.length}`} />
            {SEVERITY_ORDER.map((s) => (
              <FilterChip
                key={s}
                active={sevFilter === s}
                onClick={() => setSevFilter(s)}
                label={`${SEVERITY_META[s].label} ${countBy(s)}`}
                dot={SEVERITY_META[s].dot}
              />
            ))}
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as Category | "all")}
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
                  <li
                    key={key}
                    className={`-mx-2 rounded-xl px-2 transition ${isSel ? "bg-accent/[0.04]" : "is-unselected"}`}
                  >
                    <div className="flex items-start gap-3 py-3.5">
                      <button
                        onClick={() => toggle(key)}
                        className={`no-print mt-0.5 shrink-0 transition ${isSel ? "text-accent" : "text-slate-300 hover:text-slate-500"}`}
                        aria-label={isSel ? "Deselect issue" : "Select issue"}
                        aria-pressed={isSel}
                      >
                        {isSel ? <CheckSquare size={20} weight="fill" /> : <Square size={20} />}
                      </button>
                      <button
                        onClick={() => setOpenKey(open ? null : key)}
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

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <CheckSquare size={13} weight="fill" className="text-accent" />
          {selectedIssues.length} issue{selectedIssues.length === 1 ? "" : "s"} will be included in the downloaded report.
        </p>
      </main>
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
        active ? "border-accent/40 bg-accent/10 font-medium text-accent" : "border-line text-slate-500 hover:text-slate-900"
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
