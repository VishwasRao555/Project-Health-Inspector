import type { AnalysisContext } from "../context/buildContext";
import type { Category, Issue } from "../types/contract";

/**
 * Seam #2. Every detector implements this. Ten adapters today; an AI-assisted
 * analyzer can join later with zero orchestrator changes.
 */
export interface Analyzer {
  readonly name: string;
  /** Default bucket for issues this analyzer raises (individual issues may override). */
  readonly category: Category;
  analyze(ctx: AnalysisContext): Promise<Issue[]>;
}

/** Small helper so analyzers can stamp their name and a default category onto issues. */
export function issue(
  analyzer: Analyzer,
  partial: Omit<Issue, "analyzer" | "category"> & { category?: Category }
): Issue {
  return {
    category: partial.category ?? analyzer.category,
    severity: partial.severity,
    issue: partial.issue,
    rootCause: partial.rootCause,
    impact: partial.impact,
    solution: partial.solution,
    file: partial.file,
    line: partial.line,
    analyzer: analyzer.name,
  };
}
