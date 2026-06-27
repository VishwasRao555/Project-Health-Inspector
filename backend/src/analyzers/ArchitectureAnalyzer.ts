import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";
import { relPath } from "./util";

/**
 * Detects circular dependencies and excessively deep import chains by building a
 * file-to-file import graph from ts-morph (resolved, intra-project edges only).
 */
export class ArchitectureAnalyzer implements Analyzer {
  readonly name = "ArchitectureAnalyzer";
  readonly category = "Architecture" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Build adjacency list keyed by relative path.
    const graph = new Map<string, string[]>();
    const fileSet = new Set(ctx.sourceFiles.map((sf) => sf.getFilePath()));
    for (const sf of ctx.sourceFiles) {
      const from = relPath(ctx, sf.getFilePath());
      const targets: string[] = [];
      for (const imp of sf.getImportDeclarations()) {
        const target = imp.getModuleSpecifierSourceFile();
        if (target && fileSet.has(target.getFilePath())) {
          targets.push(relPath(ctx, target.getFilePath()));
        }
      }
      graph.set(from, targets);
    }

    issues.push(...this.detectCycles(graph, ctx));
    issues.push(...this.detectDeepChains(graph, ctx));
    return issues;
  }

  private detectCycles(graph: Map<string, string[]>, ctx: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const reportedCycles = new Set<string>();
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const stack: string[] = [];

    const visit = (node: string): void => {
      color.set(node, GRAY);
      stack.push(node);
      for (const next of graph.get(node) ?? []) {
        const c = color.get(next) ?? WHITE;
        if (c === GRAY) {
          // Found a back-edge -> cycle from `next` to current node.
          const start = stack.indexOf(next);
          const cycle = stack.slice(start).concat(next);
          const canonical = canonicalCycle(cycle);
          if (!reportedCycles.has(canonical)) {
            reportedCycles.add(canonical);
            issues.push(
              issue(this, {
                severity: "high",
                issue: `Circular dependency: ${cycle.join(" → ")}`,
                rootCause: "These modules import each other in a cycle.",
                impact: "Initialization-order bugs, tight coupling, and hard-to-test units.",
                solution: "Break the cycle by extracting shared code into a third module or inverting a dependency.",
                file: next,
              })
            );
          }
        } else if (c === WHITE) {
          visit(next);
        }
      }
      stack.pop();
      color.set(node, BLACK);
    };

    for (const node of graph.keys()) {
      if ((color.get(node) ?? WHITE) === WHITE) visit(node);
    }
    return issues;
  }

  private detectDeepChains(graph: Map<string, string[]>, ctx: AnalysisContext): Issue[] {
    const issues: Issue[] = [];
    const max = ctx.config.maxImportChainDepth;
    const memo = new Map<string, number>();
    const inProgress = new Set<string>();

    // Longest acyclic chain length starting at `node`.
    const longest = (node: string): number => {
      if (memo.has(node)) return memo.get(node)!;
      if (inProgress.has(node)) return 0; // cycle guard
      inProgress.add(node);
      let best = 0;
      for (const next of graph.get(node) ?? []) {
        best = Math.max(best, 1 + longest(next));
      }
      inProgress.delete(node);
      memo.set(node, best);
      return best;
    };

    let worst = { node: "", depth: 0 };
    for (const node of graph.keys()) {
      const d = longest(node);
      if (d > worst.depth) worst = { node, depth: d };
    }

    if (worst.depth > max) {
      issues.push(
        issue(this, {
          severity: worst.depth > max * 2 ? "high" : "medium",
          issue: `Deep import chain (depth ${worst.depth})`,
          rootCause: `The dependency chain starting at "${worst.node}" is ${worst.depth} levels deep, beyond the ${max} threshold.`,
          impact: "Long chains indicate tight layering coupling and slow incremental builds.",
          solution: "Flatten dependencies; introduce clear layer boundaries and interfaces.",
          file: worst.node,
        })
      );
    }

    return issues;
  }
}

/** Rotation-invariant key so the same cycle reported from different entry points dedupes. */
function canonicalCycle(cycle: string[]): string {
  const nodes = cycle.slice(0, -1); // drop repeated tail
  const minIdx = nodes.reduce((mi, n, i, arr) => (n < arr[mi] ? i : mi), 0);
  return nodes.slice(minIdx).concat(nodes.slice(0, minIdx)).join(">");
}
