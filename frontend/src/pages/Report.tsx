import { ArrowLeft, CheckSquare, FileHtml, FilePdf, MarkdownLogo } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { Brand } from "../components/brand";
import { LoadingBoxes } from "../components/LoadingBoxes";
import { ReportCategoryBreakdown, ReportIssuesSection, ReportScoreSummary } from "../components/ReportSections";
import {
  buildReportHtml,
  buildReportMarkdown,
  downloadBlob,
  issueKey,
  reportFileBase,
  sortIssues,
} from "../lib/reportExport";
import type { Category, HealthReport, Severity } from "../types/contract";

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
    let current = true;
    setLoading(true);
    api
      .getReport(id)
      .then((r) => {
        if (current) setReport(r);
      })
      .catch((err) => {
        if (current) setError(err instanceof ApiError ? err.message : "Failed to load this report.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    // Ignore this fetch's result if `id` changes (fast nav between report pages) or the
    // page unmounts before it resolves -- otherwise a slower, stale response can land
    // after a newer one and overwrite the report currently on screen.
    return () => {
      current = false;
    };
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

  function downloadHtml() {
    downloadBlob(`${reportFileBase(report)}.html`, buildReportHtml(report, selectedIssues), "text/html");
  }
  function downloadMarkdown() {
    downloadBlob(`${reportFileBase(report)}.md`, buildReportMarkdown(report, selectedIssues), "text/markdown");
  }

  return (
    <div className="min-h-[100dvh]">
      {/* Toolbar — hidden when printing so the PDF is just the report. */}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-nav" aria-label="Back">
              <ArrowLeft size={14} /> Back
            </button>
            <span className="hidden sm:block">
              <Brand compact />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadHtml} className="btn-nav" title="Download as HTML">
              <FileHtml size={15} weight="bold" /> HTML
            </button>
            <button onClick={downloadMarkdown} className="btn-nav" title="Download as Markdown">
              <MarkdownLogo size={15} weight="bold" /> Markdown
            </button>
            <button onClick={() => window.print()} className="btn-primary !px-3.5 !py-2 text-xs" title="Save as PDF">
              <FilePdf size={15} weight="bold" /> PDF
            </button>
          </div>
        </div>
      </header>

      <main className="report-sheet mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <ReportScoreSummary report={report} />
        <ReportCategoryBreakdown report={report} />
        <ReportIssuesSection
          allRows={allRows}
          visible={visible}
          selected={selected}
          sevFilter={sevFilter}
          catFilter={catFilter}
          openKey={openKey}
          onToggle={toggle}
          onSelectAllVisible={() => setSelected((prev) => new Set([...prev, ...visible.map((r) => r.key)]))}
          onClearAll={() => setSelected(new Set())}
          onSevFilterChange={setSevFilter}
          onCatFilterChange={setCatFilter}
          onOpenKeyChange={setOpenKey}
        />

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <CheckSquare size={13} weight="fill" className="text-accent" />
          {selectedIssues.length} issue{selectedIssues.length === 1 ? "" : "s"} will be included in the downloaded report.
        </p>
      </main>
    </div>
  );
}
