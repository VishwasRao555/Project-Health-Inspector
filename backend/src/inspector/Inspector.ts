import { v4 as uuid } from "uuid";
import type { Analyzer } from "../analyzers/Analyzer";
import { createAnalyzers } from "../analyzers/registry";
import { buildContext } from "../context/buildContext";
import type { AnalysisConfig } from "../config/defaults";
import { DEFAULT_CONFIG } from "../config/defaults";
import {
  ExplanationProvider,
  StaticExplanationProvider,
} from "../explanation/ExplanationProvider";
import { buildArchitectureGraph } from "../graph/buildArchitectureGraph";
import { score } from "../scoring/HealthScorer";
import type { RepositorySource } from "../sources/RepositorySource";
import type { HealthReport, Issue, SourceRef } from "../types/contract";

export interface InspectorDeps {
  analyzers?: Analyzer[];
  explanation?: ExplanationProvider;
  config?: AnalysisConfig;
}

/**
 * The deepest module: one method hides the whole pipeline. Analyzers run in parallel
 * and are fault-isolated, so one analyzer throwing never sinks the whole report.
 */
export class Inspector {
  private readonly analyzers: Analyzer[];
  private readonly explanation: ExplanationProvider;
  private readonly config: AnalysisConfig;

  constructor(deps: InspectorDeps = {}) {
    this.analyzers = deps.analyzers ?? createAnalyzers();
    this.explanation = deps.explanation ?? new StaticExplanationProvider();
    this.config = deps.config ?? DEFAULT_CONFIG;
  }

  async inspect(source: RepositorySource, sourceRef: SourceRef): Promise<HealthReport> {
    const handle = await source.materialize();
    try {
      const ctx = await buildContext(handle.rootDir, this.config);

      const settled = await Promise.allSettled(
        this.analyzers.map((a) => a.analyze(ctx))
      );
      const issues: Issue[] = [];
      settled.forEach((res, i) => {
        if (res.status === "fulfilled") {
          issues.push(...res.value);
        } else {
          // Fault isolation: log and continue. A crashing analyzer must not fail the report.
          console.error(`[Inspector] ${this.analyzers[i].name} failed:`, res.reason);
        }
      });

      // Low-severity findings (leftover console.logs, minor nits, etc.) are real but
      // numerous enough to bury what matters in a long report; drop them before scoring
      // so neither the issue list nor the score is dominated by noise.
      const significant = issues.filter((i) => i.severity !== "low");

      const enriched = await this.explanation.enrich(significant, ctx);
      const { overall, categories, counts } = score(enriched);
      const architectureGraph = buildArchitectureGraph(ctx);

      return {
        id: uuid(),
        source: sourceRef,
        createdAt: new Date().toISOString(),
        overallScore: overall,
        categoryScores: categories,
        counts,
        issues: enriched,
        architectureGraph,
        stats: ctx.stats,
      };
    } finally {
      await handle.cleanup();
    }
  }
}
