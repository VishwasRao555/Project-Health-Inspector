import { Node } from "ts-morph";
import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";
import { relPath, isTestFile } from "./util";

/**
 * Detects exported declarations that are never referenced anywhere in the project,
 * and source files that are never imported (likely dead files).
 */
export class DeadCodeAnalyzer implements Analyzer {
  readonly name = "DeadCodeAnalyzer";
  readonly category = "Code Quality" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const importedFiles = new Set<string>();

    // Build set of files that are the target of some import OR re-export. Re-exports
    // (`export ... from "./x"`, common in barrel index.ts files) are a separate AST node
    // from import declarations -- without this, a file only ever reached through a
    // barrel was falsely flagged as unused.
    for (const sf of ctx.sourceFiles) {
      for (const imp of sf.getImportDeclarations()) {
        const target = imp.getModuleSpecifierSourceFile();
        if (target) importedFiles.add(target.getFilePath());
      }
      for (const exp of sf.getExportDeclarations()) {
        const target = exp.getModuleSpecifierSourceFile();
        if (target) importedFiles.add(target.getFilePath());
      }
    }

    for (const sf of ctx.sourceFiles) {
      const rel = relPath(ctx, sf.getFilePath());
      if (isTestFile(rel)) continue;

      // Unreferenced exported declarations (functions, classes, variables).
      for (const [name, decls] of sf.getExportedDeclarations()) {
        if (name === "default") continue;
        for (const decl of decls) {
          if (!Node.isReferenceFindable(decl)) continue;
          let refCount = 0;
          try {
            for (const ref of decl.findReferencesAsNodes()) {
              // Ignore the declaration site itself and re-exports.
              if (ref.getStart() !== getNameStart(decl)) refCount++;
            }
          } catch {
            continue;
          }
          if (refCount === 0) {
            issues.push(
              issue(this, {
                severity: "low",
                issue: `Unused export "${name}"`,
                rootCause: "Exported symbol is not referenced anywhere in the project.",
                impact: "Dead code increases bundle size and cognitive load.",
                solution: "Remove the export, or wire it up if it was intended for use.",
                file: rel,
                line: declLine(decl),
              })
            );
          }
        }
      }

      // Unimported, non-entry source files (heuristic: not imported and not an entry name).
      // Includes "init"/"cli" for standalone scripts invoked directly via an npm script
      // (e.g. `db/init.ts` run as `npm run db:init`) rather than imported by other code.
      const isEntry = /(^|\/)(index|main|app|server|setup|init|cli|vite\.config|next\.config)\.(ts|tsx)$/i.test(rel);
      if (!isEntry && !importedFiles.has(sf.getFilePath()) && sf.getStatements().length > 0) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: "Possibly unused file",
            rootCause: "File is never imported by any other module and is not an entry point.",
            impact: "Likely dead code that ships or confuses readers.",
            solution: "Confirm it is unused and delete it, or import it where needed.",
            file: rel,
            line: 1,
          })
        );
      }
    }

    return issues;
  }
}

function getNameStart(decl: Node): number {
  const named = decl as unknown as { getNameNode?: () => Node | undefined };
  return named.getNameNode?.()?.getStart() ?? decl.getStart();
}

function declLine(decl: Node): number {
  return decl.getStartLineNumber();
}
