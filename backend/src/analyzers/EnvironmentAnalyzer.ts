import { promises as fs } from "fs";
import path from "path";
import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";

/** Parses .env / .env.example and flags missing, duplicate, and unused variables. */
export class EnvironmentAnalyzer implements Analyzer {
  readonly name = "EnvironmentAnalyzer";
  readonly category = "Security" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const env = ctx.envFiles.find((f) => f.name === ".env");
    const example = ctx.envFiles.find(
      (f) => f.name === ".env.example" || f.name === ".env.sample"
    );

    if (env) {
      const ignoreLines = (ctx.gitignore ?? "").split("\n").map((l) => l.trim());
      const isIgnored = ignoreLines.some((l) => l === ".env" || l === "*.env" || l === ".env*");
      if (!isIgnored) {
        issues.push(
          issue(this, {
            severity: "high",
            issue: ".env is not excluded by .gitignore",
            rootCause: ctx.gitignore
              ? "No .gitignore rule matches .env, so it can be committed alongside source."
              : "The project has no .gitignore at all, so .env can be committed as-is.",
            impact: "Secrets and credentials in .env risk being pushed to the repository history.",
            solution: 'Add ".env" to .gitignore and rotate any secret already committed.',
            file: ".gitignore",
          })
        );
      }
    }

    // Duplicate variable definitions within a single file.
    for (const file of ctx.envFiles) {
      const seen = new Map<string, number>();
      file.content.split("\n").forEach((raw, idx) => {
        const key = parseKey(raw);
        if (!key) return;
        if (seen.has(key)) {
          issues.push(
            issue(this, {
              severity: "low",
              issue: `Duplicate variable "${key}" in ${file.name}`,
              rootCause: `"${key}" is defined more than once; the last definition silently wins.`,
              impact: "Confusing configuration; the intended value may be overwritten.",
              solution: "Remove the duplicate definition.",
              file: file.name,
              line: idx + 1,
            })
          );
        } else {
          seen.set(key, idx + 1);
        }
      });
    }

    // Missing variables: present in .env.example but not in .env.
    if (env && example) {
      const envKeys = new Set(keysOf(env.content));
      for (const { key, line } of keysWithLines(example.content)) {
        if (!envKeys.has(key)) {
          issues.push(
            issue(this, {
              severity: "medium",
              issue: `Missing environment variable "${key}"`,
              rootCause: `"${key}" is documented in ${example.name} but absent from .env.`,
              impact: "App may crash or misbehave at runtime due to undefined configuration.",
              solution: `Add "${key}" to your .env file.`,
              file: ".env",
              line,
            })
          );
        }
      }
    }

    // Unused variables: defined in .env but never referenced in source as process.env.X.
    if (env) {
      const referenced = await this.collectReferencedEnvVars(ctx);
      for (const { key, line } of keysWithLines(env.content)) {
        if (!referenced.has(key)) {
          issues.push(
            issue(this, {
              severity: "low",
              issue: `Unused environment variable "${key}"`,
              rootCause: `"${key}" is defined in .env but never read via process.env.`,
              impact: "Dead configuration that misleads readers and operators.",
              solution: "Remove it, or wire it up where it is needed.",
              file: ".env",
              line,
            })
          );
        }
      }
    }

    return issues;
  }

  private async collectReferencedEnvVars(ctx: AnalysisContext): Promise<Set<string>> {
    const refs = new Set<string>();
    // Var names aren't restricted to UPPER_SNAKE_CASE at runtime -- match any case so a
    // legitimately-referenced camelCase var (e.g. process.env.apiKey) isn't missed and
    // then falsely reported as "unused".
    const re = /process\.env\.([A-Za-z0-9_]+)|process\.env\[["']([A-Za-z0-9_]+)["']\]|import\.meta\.env\.([A-Za-z0-9_]+)/g;
    for (const rel of ctx.allFiles) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)) continue;
      let content: string;
      try {
        content = await fs.readFile(path.join(ctx.rootDir, rel), "utf8");
      } catch {
        continue;
      }
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        refs.add(m[1] || m[2] || m[3]);
      }
    }
    return refs;
  }
}

function parseKey(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  return trimmed.slice(0, eq).trim();
}

function keysOf(content: string): string[] {
  return content
    .split("\n")
    .map(parseKey)
    .filter((k): k is string => k !== null);
}

function keysWithLines(content: string): { key: string; line: number }[] {
  const out: { key: string; line: number }[] = [];
  content.split("\n").forEach((raw, idx) => {
    const key = parseKey(raw);
    if (key) out.push({ key, line: idx + 1 });
  });
  return out;
}
