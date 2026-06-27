import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";

/** Detects huge folders, excessive nesting, and disorganized roots. */
export class ProjectStructureAnalyzer implements Analyzer {
  readonly name = "ProjectStructureAnalyzer";
  readonly category = "Architecture" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { maxFilesPerFolder, maxFolderDepth } = ctx.config;

    // Count direct files per folder and track max nesting depth.
    const filesPerFolder = new Map<string, number>();
    let deepest = { path: "", depth: 0 };

    for (const rel of ctx.allFiles) {
      const segments = rel.split("/");
      const folder = segments.slice(0, -1).join("/") || ".";
      filesPerFolder.set(folder, (filesPerFolder.get(folder) ?? 0) + 1);

      const depth = segments.length - 1; // folder depth
      if (depth > deepest.depth) deepest = { path: rel, depth };
    }

    for (const [folder, count] of filesPerFolder) {
      if (count > maxFilesPerFolder) {
        issues.push(
          issue(this, {
            severity: count > maxFilesPerFolder * 3 ? "high" : "medium",
            issue: `Huge folder (${count} files): ${folder}`,
            rootCause: `"${folder}" holds ${count} files directly, exceeding the ${maxFilesPerFolder}-file threshold.`,
            impact: "Hard to locate files; signals missing sub-structure.",
            solution: "Group related files into feature- or domain-based subfolders.",
            file: folder === "." ? "." : `${folder}/`,
          })
        );
      }
    }

    if (deepest.depth > maxFolderDepth) {
      issues.push(
        issue(this, {
          severity: "low",
          issue: `Excessive nesting (depth ${deepest.depth})`,
          rootCause: `Path "${deepest.path}" nests ${deepest.depth} folders deep, beyond the ${maxFolderDepth} threshold.`,
          impact: "Deep paths are awkward to import and reason about.",
          solution: "Flatten the hierarchy; prefer shallow, feature-oriented folders.",
          file: deepest.path,
        })
      );
    }

    if (ctx.gitignore === undefined) {
      issues.push(
        issue(this, {
          severity: "medium",
          issue: "Missing .gitignore",
          rootCause: "The project has no .gitignore file at the root.",
          impact: "Build output, dependencies, and local env files can be committed by accident.",
          solution: "Add a .gitignore covering node_modules, build output, and local env files.",
          file: ".gitignore",
        })
      );
    }

    // Poor organization: many source files sitting at the repo root.
    const rootSourceFiles = ctx.allFiles.filter(
      (f) => !f.includes("/") && /\.(ts|tsx|js|jsx)$/.test(f)
    );
    if (rootSourceFiles.length > 10) {
      issues.push(
        issue(this, {
          severity: "low",
          issue: `Poor organization (${rootSourceFiles.length} source files at repo root)`,
          rootCause: "Many source files live at the top level instead of in a src/ tree.",
          impact: "Unclear project layout; harder onboarding.",
          solution: "Move source into a structured src/ directory with clear subfolders.",
          file: ".",
        })
      );
    }

    return issues;
  }
}
