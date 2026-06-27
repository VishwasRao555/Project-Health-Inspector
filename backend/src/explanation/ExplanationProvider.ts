import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";

/**
 * Seam #4 — the future AI hook. Today the static adapter passes issues through
 * unchanged (analyzers already fill rootCause/impact/solution). A future
 * LLMExplanationProvider can enrich the same issues without any analyzer changes.
 *
 * AI must NEVER detect issues — it only enriches what analyzers already found.
 */
export interface ExplanationProvider {
  enrich(issues: Issue[], ctx: AnalysisContext): Promise<Issue[]>;
}

export class StaticExplanationProvider implements ExplanationProvider {
  async enrich(issues: Issue[]): Promise<Issue[]> {
    return issues;
  }
}
