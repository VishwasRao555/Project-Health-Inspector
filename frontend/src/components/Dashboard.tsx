import { FileCode, GithubLogo, FileZip, Files } from "@phosphor-icons/react";
import type { HealthReport, Severity } from "../types/contract";
import { ArchitectureGraph } from "./ArchitectureGraph";
import { CategoryScores } from "./CategoryScores";
import { IssueList } from "./IssueList";
import { ScoreGauge } from "./ScoreGauge";
import { SEVERITY_META } from "./brand";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export function Dashboard({ report }: { report: HealthReport }) {
  return (
    <div className="space-y-6">
      {/* Overview: gauge + severity counts + repo facts */}
      <section className="card animate-fade-up">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center">
          <ScoreGauge score={report.overallScore} />

          <div className="flex-1">
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
              {report.source.type === "github" ? <GithubLogo size={16} /> : <FileZip size={16} />}
              <span className="truncate font-mono text-xs text-gray-400">{report.source.ref}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SEVERITIES.map((s) => (
                <div key={s} className="rounded-xl border border-line bg-ink-950/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${SEVERITY_META[s].dot}`} />
                    <span className="text-xs text-gray-400">{SEVERITY_META[s].label}</span>
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-white">
                    {report.counts[s]}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
              <Stat icon={<Files size={14} />} label="files" value={report.stats.totalFiles} />
              <Stat icon={<FileCode size={14} />} label="analyzed" value={report.stats.analyzedFiles} />
              <Stat icon={<FileCode size={14} />} label="lines" value={report.stats.totalLines.toLocaleString()} />
            </div>
          </div>
        </div>
      </section>

      <section className="animate-fade-up">
        <CategoryScores scores={report.categoryScores} />
      </section>

      <section className="animate-fade-up">
        <ArchitectureGraph graph={report.architectureGraph} />
      </section>

      <section className="animate-fade-up">
        <IssueList issues={report.issues} />
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span className="font-mono text-gray-300">{value}</span> {label}
    </span>
  );
}
