import { CATEGORIES } from "../types/contract";
import type { Category, HealthReport, Issue } from "../types/contract";

function issueKey(issue: Issue): string {
  return `${issue.category}|${issue.issue}|${issue.file}|${issue.line ?? ""}`;
}

export interface ReportDiffResult {
  older: HealthReport;
  newer: HealthReport;
  overallDelta: number;
  categoryDeltas: Record<Category, number>;
  resolved: Issue[];
  introduced: Issue[];
}

export function diffReports(a: HealthReport, b: HealthReport): ReportDiffResult {
  const [older, newer] =
    new Date(a.createdAt).getTime() <= new Date(b.createdAt).getTime() ? [a, b] : [b, a];

  const olderKeys = new Set(older.issues.map(issueKey));
  const newerKeys = new Set(newer.issues.map(issueKey));

  return {
    older,
    newer,
    overallDelta: newer.overallScore - older.overallScore,
    categoryDeltas: Object.fromEntries(
      CATEGORIES.map((c) => [c, newer.categoryScores[c] - older.categoryScores[c]])
    ) as Record<Category, number>,
    resolved: older.issues.filter((i) => !newerKeys.has(issueKey(i))),
    introduced: newer.issues.filter((i) => !olderKeys.has(issueKey(i))),
  };
}
