import type { HealthReport, ReportSummary } from "../types/contract";

/** Seam #3. Persists reports, scoped to a user. */
export interface ReportStore {
  save(userId: string, report: HealthReport): Promise<void>;
  get(userId: string, id: string): Promise<HealthReport | null>;
  list(userId: string): Promise<ReportSummary[]>;
}
