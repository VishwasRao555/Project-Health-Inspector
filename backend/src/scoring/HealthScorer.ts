import { CATEGORY_WEIGHTS, MAX_CATEGORY_SCORE, SEVERITY_PENALTY } from "../config/defaults";
import {
  CATEGORIES,
  type Category,
  type Issue,
  type SeverityCounts,
} from "../types/contract";

export interface ScoreResult {
  overall: number;
  categories: Record<Category, number>;
  counts: SeverityCounts;
}

/**
 * Pure scorer. Each category starts at 100 and loses points per issue by severity
 * (floored at 0). Overall is the weighted sum. No side effects, fully testable.
 */
export function score(issues: Issue[]): ScoreResult {
  const categories = {} as Record<Category, number>;
  for (const c of CATEGORIES) categories[c] = MAX_CATEGORY_SCORE;

  for (const i of issues) {
    categories[i.category] = Math.max(0, categories[i.category] - SEVERITY_PENALTY[i.severity]);
  }

  let overall = 0;
  for (const c of CATEGORIES) overall += categories[c] * CATEGORY_WEIGHTS[c];

  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const i of issues) counts[i.severity]++;

  return {
    overall: Math.round(overall),
    categories,
    counts,
  };
}
