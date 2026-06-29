import { ArrowLeft, FileText, FileZip, GithubLogo } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { Dashboard } from "../components/Dashboard";
import { LoadingBoxes } from "../components/LoadingBoxes";
import { ReportDiff } from "../components/ReportDiff";
import { SEVERITY_META, scoreColor } from "../components/brand";
import { diffReports, type ReportDiffResult } from "../lib/reportDiff";
import { SEVERITIES, type HealthReport, type ReportSummary } from "../types/contract";

type ViewMode = "list" | "detail" | "diff";

export function History() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<ViewMode>("list");
  const [activeReport, setActiveReport] = useState<HealthReport | null>(null);
  const [diff, setDiff] = useState<ReportDiffResult | null>(null);
  const [busy, setBusy] = useState(false);
  const cache = useRef<Map<string, HealthReport>>(new Map());

  useEffect(() => {
    api
      .listReports()
      .then(setReports)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length === 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  async function fetchCached(id: string): Promise<HealthReport> {
    const cached = cache.current.get(id);
    if (cached) return cached;
    const r = await api.getReport(id);
    cache.current.set(id, r);
    return r;
  }

  async function openDetail(id: string) {
    setBusy(true);
    setError(null);
    try {
      setActiveReport(await fetchCached(id));
      setMode("detail");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load report.");
    } finally {
      setBusy(false);
    }
  }

  async function openDiff() {
    if (selected.length !== 2) return;
    setBusy(true);
    setError(null);
    try {
      const [a, b] = await Promise.all(selected.map(fetchCached));
      setDiff(diffReports(a, b));
      setMode("diff");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load reports for comparison.");
    } finally {
      setBusy(false);
    }
  }

  function backToList() {
    setMode("list");
    setActiveReport(null);
    setDiff(null);
  }

  return (
    <div className="min-h-[100dvh]">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {mode !== "list" && (
          <button onClick={backToList} className="btn-ghost mb-6 !px-4 !py-2 text-xs">
            <ArrowLeft size={14} /> Back to history
          </button>
        )}

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {mode === "detail" && activeReport && <Dashboard report={activeReport} />}
        {mode === "diff" && diff && <ReportDiff diff={diff} />}

        {mode === "list" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-3xl uppercase tracking-tight text-slate-900">Scan history</h1>
              <button
                onClick={openDiff}
                disabled={selected.length !== 2 || busy}
                className="btn-primary !px-4 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <LoadingBoxes /> : `Compare selected (${selected.length}/2)`}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <LoadingBoxes />
              </div>
            ) : reports.length === 0 ? (
              <div className="card text-center text-sm text-slate-400">
                No scans yet. Run your first analysis from the dashboard.
              </div>
            ) : (
              <ul className="card divide-y divide-slate-100">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      aria-label={`Select report from ${new Date(r.createdAt).toLocaleString()}`}
                      className="h-4 w-4 shrink-0 accent-accent-cyan"
                    />

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {r.source.type === "github" ? (
                        <GithubLogo size={16} className="shrink-0 text-gray-500" />
                      ) : (
                        <FileZip size={16} className="shrink-0 text-gray-500" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-slate-800">{r.source.ref}</p>
                        <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {SEVERITIES.map((s) =>
                        r.counts[s] > 0 ? (
                          <span key={s} className="inline-flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[s].dot}`} />
                            {r.counts[s]}
                          </span>
                        ) : null
                      )}
                    </div>

                    <span className={`w-10 text-right font-display text-lg font-bold ${scoreColor(r.overallScore)}`}>
                      {r.overallScore}
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/report/${r.id}`}
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        title="Generate report"
                      >
                        <FileText size={14} weight="bold" /> Report
                      </Link>
                      <button onClick={() => openDetail(r.id)} className="btn-ghost !px-3 !py-1.5 text-xs">
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
