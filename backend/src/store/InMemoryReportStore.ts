import type { HealthReport, ReportSummary } from "../types/contract";
import type { ReportStore } from "./ReportStore";

/** The second adapter that makes the ReportStore seam real and keeps the API testable. */
export class InMemoryReportStore implements ReportStore {
  private readonly byUser = new Map<string, Map<string, HealthReport>>();

  async save(userId: string, report: HealthReport): Promise<void> {
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Map());
    this.byUser.get(userId)!.set(report.id, report);
  }

  async get(userId: string, id: string): Promise<HealthReport | null> {
    return this.byUser.get(userId)?.get(id) ?? null;
  }

  async list(userId: string): Promise<ReportSummary[]> {
    const reports = [...(this.byUser.get(userId)?.values() ?? [])];
    return reports
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        id: r.id,
        source: r.source,
        createdAt: r.createdAt,
        overallScore: r.overallScore,
        counts: r.counts,
      }));
  }
}
