import type { RowDataPacket } from "mysql2";
import { getPool } from "../db/mysql";
import type { HealthReport, ReportSummary } from "../types/contract";
import type { ReportStore } from "./ReportStore";

/** Stores the full report JSON plus indexed summary columns for fast listing. */
export class MySqlReportStore implements ReportStore {
  async save(userId: string, report: HealthReport): Promise<void> {
    await getPool().query(
      `INSERT INTO reports (id, user_id, source_type, source_ref, overall_score, counts_json, report_json)
       VALUES (:id, :userId, :sourceType, :sourceRef, :overallScore, :counts, :report)`,
      {
        id: report.id,
        userId,
        sourceType: report.source.type,
        sourceRef: report.source.ref,
        overallScore: report.overallScore,
        counts: JSON.stringify(report.counts),
        report: JSON.stringify(report),
      }
    );
  }

  async get(userId: string, id: string): Promise<HealthReport | null> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT report_json FROM reports WHERE id = :id AND user_id = :userId LIMIT 1`,
      { id, userId }
    );
    if (rows.length === 0) return null;
    return parseJson<HealthReport>(rows[0].report_json);
  }

  async list(userId: string): Promise<ReportSummary[]> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, source_type, source_ref, overall_score, counts_json, created_at
       FROM reports WHERE user_id = :userId ORDER BY created_at DESC LIMIT 100`,
      { userId }
    );
    return rows.map((r) => ({
      id: r.id,
      source: { type: r.source_type, ref: r.source_ref },
      createdAt: new Date(r.created_at).toISOString(),
      overallScore: r.overall_score,
      counts: parseJson(r.counts_json),
    }));
  }
}

/** mysql2 returns JSON columns already parsed; tolerate both string and object. */
function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
