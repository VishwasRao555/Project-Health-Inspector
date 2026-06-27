import { promises as fs } from "fs";
import path from "path";
import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";

/** Analyzes package.json for unused, heavy, and loosely-pinned (outdated-prone) dependencies. */
export class DependencyAnalyzer implements Analyzer {
  readonly name = "DependencyAnalyzer";
  readonly category = "Dependencies" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const pkg = ctx.packageJson;
    if (!pkg) return [];
    const issues: Issue[] = [];
    const deps = { ...(pkg.dependencies ?? {}) };

    const used = await this.collectImportedPackages(ctx);
    const devDeps = pkg.devDependencies ?? {};

    for (const name of Object.keys(deps)) {
      if (name in devDeps) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: `"${name}" listed in both dependencies and devDependencies`,
            rootCause: `"${name}" appears in both sections of package.json; the dependencies entry wins.`,
            impact: "Confusing and can ship a dev-only package in the production bundle.",
            solution: `Remove "${name}" from whichever section it doesn't belong in.`,
            file: "package.json",
          })
        );
      }
    }

    for (const [name, version] of Object.entries(deps)) {
      // Unused dependency: declared but never imported (skip type-only and tooling).
      if (!used.has(name) && !isImplicitlyUsed(name)) {
        issues.push(
          issue(this, {
            severity: "medium",
            issue: `Unused dependency "${name}"`,
            rootCause: `"${name}" is listed in dependencies but not imported anywhere in source.`,
            impact: "Bloats install size and the supply-chain attack surface.",
            solution: `Remove "${name}" from package.json if it is truly unused.`,
            file: "package.json",
          })
        );
      }

      // Heavy dependency.
      if (ctx.config.heavyDependencies.includes(name)) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: `Heavy dependency "${name}"`,
            rootCause: `"${name}" is known to add significant bundle weight.`,
            impact: "Larger bundles slow load times, especially on the frontend.",
            solution: "Consider a lighter alternative or import only the parts you need.",
            file: "package.json",
          })
        );
      }

      // Loose version range -> outdated-prone / non-reproducible.
      if (typeof version === "string" && /^[\^~]?0\./.test(version)) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: `Pre-1.0 dependency "${name}" (${version})`,
            rootCause: `"${name}" is pinned to a pre-1.0 version, where breaking changes are common.`,
            impact: "Minor updates may break the build unexpectedly.",
            solution: "Pin exact versions for pre-1.0 packages and review upgrades carefully.",
            file: "package.json",
          })
        );
      }
    }

    return issues;
  }

  private async collectImportedPackages(ctx: AnalysisContext): Promise<Set<string>> {
    const used = new Set<string>();
    // From ts-morph import declarations.
    for (const sf of ctx.sourceFiles) {
      for (const imp of sf.getImportDeclarations()) {
        addPkg(used, imp.getModuleSpecifierValue());
      }
    }
    // Regex fallback over JS files not parsed by ts-morph.
    const re = /(?:import\s[^'"]*from\s*|require\(\s*|import\(\s*)["']([^"']+)["']/g;
    for (const rel of ctx.allFiles) {
      if (!/\.(js|jsx|mjs|cjs)$/.test(rel)) continue;
      let content: string;
      try {
        content = await fs.readFile(path.join(ctx.rootDir, rel), "utf8");
      } catch {
        continue;
      }
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) addPkg(used, m[1]);
    }
    return used;
  }
}

function addPkg(set: Set<string>, specifier: string): void {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return; // relative import
  // Scoped package: @scope/name ; otherwise first path segment.
  const parts = specifier.split("/");
  const name = specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
  if (name) set.add(name);
}

/** Packages typically used without an explicit import (CLIs, config-driven, polyfills). */
function isImplicitlyUsed(name: string): boolean {
  return (
    /^@types\//.test(name) ||
    [
      "typescript",
      "tailwindcss",
      "postcss",
      "autoprefixer",
      "vite",
      "eslint",
      "prettier",
      "react",
      "react-dom",
    ].includes(name)
  );
}
