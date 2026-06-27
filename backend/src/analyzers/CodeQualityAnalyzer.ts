import { Node, SourceFile, SyntaxKind } from "ts-morph";
import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";
import { commentsOf, findSpellingMistakes, isTestFile, lineAt, looksLikeCode, relPath } from "./util";

/** Detects large files, large functions, and duplicated code blocks. */
export class CodeQualityAnalyzer implements Analyzer {
  readonly name = "CodeQualityAnalyzer";
  readonly category = "Code Quality" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { maxFileLines, maxFunctionLines } = ctx.config;

    for (const sf of ctx.sourceFiles) {
      const rel = relPath(ctx, sf.getFilePath());
      const lineCount = sf.getEndLineNumber();

      if (lineCount > maxFileLines) {
        issues.push(
          issue(this, {
            severity: lineCount > maxFileLines * 2 ? "high" : "medium",
            issue: `Large file (${lineCount} lines)`,
            rootCause: `File exceeds the ${maxFileLines}-line threshold, usually meaning it holds several unrelated responsibilities.`,
            impact: "Hard to navigate, review, and test; raises merge-conflict risk.",
            solution: "Split into smaller cohesive modules grouped by responsibility.",
            file: rel,
            line: 1,
          })
        );
      }

      // Large functions / methods / arrow functions assigned to declarations.
      const fnLikes = [
        ...sf.getFunctions(),
        ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ];
      for (const fn of fnLikes) {
        const start = fn.getStartLineNumber();
        const end = fn.getEndLineNumber();
        const len = end - start + 1;
        if (len > maxFunctionLines) {
          issues.push(
            issue(this, {
              severity: len > maxFunctionLines * 2 ? "high" : "medium",
              issue: `Large function (${len} lines)${nameOf(fn) ? `: ${nameOf(fn)}` : ""}`,
              rootCause: `Function exceeds the ${maxFunctionLines}-line threshold and likely does too many things.`,
              impact: "Difficult to understand and unit-test; hides bugs.",
              solution: "Extract helper functions; isolate side effects from pure logic.",
              file: rel,
              line: start,
            })
          );
        }
      }

      issues.push(...this.scanComments(sf, rel));
      issues.push(...this.scanDebugStatements(sf, rel));
    }

    issues.push(...this.detectDuplicates(ctx));
    return issues;
  }

  /** Flags leftover TODO/FIXME markers, commented-out code, and spelling mistakes in comments. */
  private scanComments(sf: SourceFile, rel: string): Issue[] {
    const issues: Issue[] = [];
    if (isTestFile(rel)) return issues;

    for (const comment of commentsOf(sf)) {
      const body = comment.text.replace(/^\/\/|^\/\*|\*\/$/g, "").trim();
      if (!body) continue;

      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(comment.text)) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: `Unresolved "${comment.text.match(/\b(TODO|FIXME|HACK|XXX)\b/)?.[0]}" comment`,
            rootCause: "A TODO/FIXME-style marker was left in the code instead of being tracked and resolved.",
            impact: "Known gaps or shortcuts go untracked and are easy to forget.",
            solution: "Resolve it, or convert it into a tracked issue and reference the ticket.",
            file: rel,
            line: comment.line,
          })
        );
      }

      if (comment.text.startsWith("//") && looksLikeCode(body) && body.length > 6) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: "Commented-out code",
            rootCause: "A line comment contains what looks like disabled code rather than an explanation.",
            impact: "Clutters the file and confuses readers about whether the code is meant to run.",
            solution: "Delete dead code (git history keeps it) instead of commenting it out.",
            file: rel,
            line: comment.line,
          })
        );
      }

      for (const hit of findSpellingMistakes(body)) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: `Spelling mistake in comment: "${hit.word}" → "${hit.suggestion}"`,
            rootCause: `"${hit.word}" is a common misspelling of "${hit.suggestion}".`,
            impact: "Typos in comments read as careless and slow down reviewers.",
            solution: `Replace "${hit.word}" with "${hit.suggestion}".`,
            file: rel,
            line: comment.line + lineAt(body, hit.index) - 1,
          })
        );
      }
    }
    return issues;
  }

  /** Flags console.log/debugger statements left in non-test source. */
  private scanDebugStatements(sf: SourceFile, rel: string): Issue[] {
    const issues: Issue[] = [];
    if (isTestFile(rel)) return issues;

    for (const stmt of sf.getDescendantsOfKind(SyntaxKind.DebuggerStatement)) {
      issues.push(
        issue(this, {
          severity: "medium",
          issue: "Leftover debugger statement",
          rootCause: "A `debugger;` statement was left in shipped code.",
          impact: "Pauses execution in any browser/Node devtools session that hits this line.",
          solution: "Remove the `debugger;` statement.",
          file: rel,
          line: stmt.getStartLineNumber(),
        })
      );
    }

    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (
        Node.isPropertyAccessExpression(expr) &&
        Node.isIdentifier(expr.getExpression()) &&
        expr.getExpression().getText() === "console"
      ) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: `Leftover console.${expr.getName()}() call`,
            rootCause: "Console logging statements were left in source rather than removed or routed through a logger.",
            impact: "Noisy output in production and a sign the code wasn't cleaned up before shipping.",
            solution: "Remove debug logging or replace it with a proper logger gated by environment.",
            file: rel,
            line: call.getStartLineNumber(),
          })
        );
      }
    }
    return issues;
  }

  /**
   * Cheap duplicate-block detection: hash normalized 6-line windows across files and
   * report windows that appear in 2+ distinct locations.
   */
  private detectDuplicates(ctx: AnalysisContext): Issue[] {
    const WINDOW = 6;
    const seen = new Map<string, { file: string; line: number }>();
    const reported = new Set<string>();
    const issues: Issue[] = [];

    for (const sf of ctx.sourceFiles) {
      const rel = relPath(ctx, sf.getFilePath());
      const lines = sf.getFullText().split("\n").map(normalize);
      for (let i = 0; i + WINDOW <= lines.length; i++) {
        const block = lines.slice(i, i + WINDOW);
        if (block.filter((l) => l.length > 0).length < WINDOW - 1) continue; // skip mostly-blank
        const key = block.join("");
        const prev = seen.get(key);
        if (prev && !reported.has(key)) {
          reported.add(key);
          issues.push(
            issue(this, {
              severity: "low",
              issue: `Duplicate code block (${WINDOW} lines)`,
              rootCause: `Identical block also appears at ${prev.file}:${prev.line}.`,
              impact: "Changes must be made in multiple places; bugs get fixed inconsistently.",
              solution: "Extract the shared logic into a reusable function or module.",
              file: rel,
              line: i + 1,
            })
          );
        } else if (!prev) {
          seen.set(key, { file: rel, line: i + 1 });
        }
      }
    }
    return issues;
  }
}

function normalize(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

function nameOf(node: Node): string {
  const named = node.asKind(SyntaxKind.FunctionDeclaration) ?? node.asKind(SyntaxKind.MethodDeclaration);
  if (named && typeof (named as { getName?: () => string }).getName === "function") {
    return (named as { getName: () => string }).getName() ?? "";
  }
  return "";
}
