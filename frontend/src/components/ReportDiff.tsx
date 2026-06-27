import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  FileZip,
  GithubLogo,
  Minus,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ReportDiffResult } from "../lib/reportDiff";
import { CATEGORIES } from "../types/contract";
import type { HealthReport, Issue } from "../types/contract";
import { SEVERITY_META } from "./brand";

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-ink-950/40 px-2.5 py-1 text-xs font-semibold text-gray-400">
        <Minus size={12} /> 0
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        positive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
      }`}
    >
      {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {positive ? `+${value}` : value}
    </span>
  );
}

function SourceLabel({ label, report }: { label: string; report: HealthReport }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-200">
        {report.source.type === "github" ? <GithubLogo size={14} /> : <FileZip size={14} />}
        <span className="max-w-[12rem] truncate font-mono text-xs">{report.source.ref}</span>
      </div>
      <span className="text-xs text-gray-500">{new Date(report.createdAt).toLocaleString()}</span>
    </div>
  );
}

function IssueColumn({
  title,
  issues,
  tone,
  emptyText,
}: {
  title: string;
  issues: Issue[];
  tone: "good" | "bad";
  emptyText: string;
}) {
  const Icon = tone === "good" ? CheckCircle : WarningCircle;
  const toneClass = tone === "good" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="card">
      <h3 className={`mb-4 flex items-center gap-2 text-sm font-semibold ${toneClass}`}>
        <Icon size={16} /> {title} <span className="text-gray-500">({issues.length})</span>
      </h3>
      {issues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-gray-500">
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {issues.map((issue, idx) => (
            <li key={`${issue.file}-${issue.line}-${idx}`} className="flex items-start gap-3 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_META[issue.severity].dot}`} />
              <div className="min-w-0">
                <p className="text-sm text-gray-200">{issue.issue}</p>
                <p className="truncate font-mono text-xs text-gray-500">
                  {issue.file}
                  {issue.line ? `:${issue.line}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportDiff({ diff }: { diff: ReportDiffResult }) {
  const { older, newer, overallDelta, categoryDeltas, resolved, introduced } = diff;
  const sameSource = older.source.type === newer.source.type && older.source.ref === newer.source.ref;

  return (
    <div className="space-y-6">
      <section className="card animate-fade-up">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <SourceLabel label="Older scan" report={older} />
            <span className="text-gray-500">→</span>
            <SourceLabel label="Newer scan" report={newer} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Overall score</span>
            <DeltaBadge value={overallDelta} />
          </div>
        </div>
        {!sameSource && (
          <p className="mt-4 text-xs text-amber-300/80">
            Note: these scans are from different sources — comparison may not be meaningful.
          </p>
        )}
      </section>

      <section className="card animate-fade-up">
        <h3 className="mb-4 text-sm font-semibold text-white">Category scores</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div
              key={c}
              className="flex items-center justify-between rounded-xl border border-line bg-ink-950/40 px-4 py-3"
            >
              <span className="text-xs text-gray-400">{c}</span>
              <DeltaBadge value={categoryDeltas[c]} />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 animate-fade-up sm:grid-cols-2">
        <IssueColumn
          title="Resolved"
          issues={resolved}
          tone="good"
          emptyText="No issues resolved between these scans."
        />
        <IssueColumn
          title="New issues"
          issues={introduced}
          tone="bad"
          emptyText="No new issues introduced."
        />
      </div>
    </div>
  );
}
