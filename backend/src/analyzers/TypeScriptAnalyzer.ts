import { SyntaxKind, VariableDeclarationKind } from "ts-morph";
import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";
import { relPath, isTestFile } from "./util";

/** Detects excessive `any`, exported objects/functions lacking interfaces, and weak typing. */
export class TypeScriptAnalyzer implements Analyzer {
  readonly name = "TypeScriptAnalyzer";
  readonly category = "Code Quality" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    let totalAnnotations = 0;
    let anyCount = 0;
    const anyLocations: { file: string; line: number }[] = [];

    for (const sf of ctx.sourceFiles) {
      const rel = relPath(ctx, sf.getFilePath());
      if (isTestFile(rel)) continue;

      // Count `any` keyword usages in type positions.
      const anyKeywords = sf.getDescendantsOfKind(SyntaxKind.AnyKeyword);
      anyCount += anyKeywords.length;
      for (const k of anyKeywords) {
        anyLocations.push({ file: rel, line: k.getStartLineNumber() });
      }

      // Rough denominator: type references + primitive keyword type nodes.
      totalAnnotations +=
        sf.getDescendantsOfKind(SyntaxKind.TypeReference).length +
        sf.getDescendantsOfKind(SyntaxKind.StringKeyword).length +
        sf.getDescendantsOfKind(SyntaxKind.NumberKeyword).length +
        sf.getDescendantsOfKind(SyntaxKind.BooleanKeyword).length +
        anyKeywords.length;

      // Function parameters with no type annotation and no default = weak typing.
      for (const fn of sf.getFunctions()) {
        for (const param of fn.getParameters()) {
          if (!param.getTypeNode() && !param.hasInitializer() && !param.isRestParameter()) {
            issues.push(
              issue(this, {
                severity: "low",
                issue: `Untyped parameter "${param.getName()}" in ${fn.getName() ?? "function"}`,
                rootCause: "Parameter has no type annotation, so it falls back to implicit any.",
                impact: "Loses type-safety guarantees and editor assistance.",
                solution: "Add an explicit parameter type.",
                file: rel,
                line: param.getStartLineNumber(),
              })
            );
          }
        }
      }

      // Suppressed type checking: @ts-ignore / @ts-nocheck / @ts-expect-error.
      const text = sf.getFullText();
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        const m = line.match(/@ts-(ignore|nocheck|expect-error)/);
        if (m) {
          issues.push(
            issue(this, {
              severity: m[1] === "nocheck" ? "high" : "medium",
              issue: `Suppressed type checking (@ts-${m[1]})`,
              rootCause: "A type-checking suppression directive hides a real type error instead of fixing it.",
              impact: "The suppressed line (or whole file) loses TypeScript's safety net silently.",
              solution: "Fix the underlying type error instead of suppressing the check.",
              file: rel,
              line: idx + 1,
            })
          );
        }
      });

      // `var` usage instead of block-scoped let/const.
      for (const decl of sf.getVariableStatements()) {
        if (decl.getDeclarationKind() === VariableDeclarationKind.Var) {
          issues.push(
            issue(this, {
              severity: "low",
              issue: "Use of `var` instead of `let`/`const`",
              rootCause: "`var` is function-scoped and hoisted, which is rarely the intended behavior.",
              impact: "Can leak variables outside the intended block and cause subtle bugs.",
              solution: "Replace `var` with `let` or `const`.",
              file: rel,
              line: decl.getStartLineNumber(),
            })
          );
        }
      }
    }

    // Excessive `any` usage relative to annotation volume.
    const pct = totalAnnotations === 0 ? 0 : (anyCount / totalAnnotations) * 100;
    if (anyCount > 0 && pct >= ctx.config.anyUsageWarnPercent) {
      const first = anyLocations[0];
      issues.push(
        issue(this, {
          severity: pct >= ctx.config.anyUsageWarnPercent * 2 ? "high" : "medium",
          issue: `Excessive 'any' usage (${anyCount} occurrences, ~${pct.toFixed(0)}% of annotations)`,
          rootCause: "Frequent use of `any` opts large parts of the code out of type checking.",
          impact: "TypeScript can no longer catch type errors; refactors become risky.",
          solution: "Replace `any` with precise types, generics, or `unknown` + narrowing.",
          file: first?.file ?? "tsconfig.json",
          line: first?.line,
        })
      );
    }

    return issues;
  }
}
