import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";
import { findSpellingMistakes, lineAt } from "./util";

interface DocSection {
  label: string;
  patterns: RegExp[];
  severity: Issue["severity"];
}

const SECTIONS: DocSection[] = [
  { label: "Installation", patterns: [/##?.*\b(install|installation|getting started|setup)\b/i], severity: "medium" },
  { label: "Usage", patterns: [/##?.*\b(usage|how to use|quick start|examples?)\b/i], severity: "medium" },
  { label: "Features", patterns: [/##?.*\b(features?|what.?s included)\b/i], severity: "low" },
  { label: "Screenshots", patterns: [/##?.*\b(screenshots?|demo|preview)\b/i, /!\[[^\]]*\]\([^)]+\)/], severity: "low" },
  { label: "API Documentation", patterns: [/##?.*\b(api|reference|endpoints?|documentation)\b/i], severity: "low" },
];

/** Checks README.md for the expected sections and surfaces what's missing. */
export class DocumentationAnalyzer implements Analyzer {
  readonly name = "DocumentationAnalyzer";
  readonly category = "Documentation" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    if (!ctx.readme || ctx.readme.trim().length === 0) {
      issues.push(
        issue(this, {
          severity: "high",
          issue: "Missing or empty README.md",
          rootCause: "No README is present at the project root.",
          impact: "New contributors and users have no entry point to understand the project.",
          solution: "Add a README covering installation, usage, features, and API.",
          file: "README.md",
        })
      );
      return issues;
    }

    const readme = ctx.readme;
    for (const section of SECTIONS) {
      const found = section.patterns.some((p) => p.test(readme));
      if (!found) {
        issues.push(
          issue(this, {
            severity: section.severity,
            issue: `README missing "${section.label}" section`,
            rootCause: `The README has no recognizable ${section.label} section.`,
            impact: "Readers cannot quickly find this information.",
            solution: `Add a "${section.label}" section to README.md.`,
            file: "README.md",
          })
        );
      }
    }

    if (readme.trim().length < 200) {
      issues.push(
        issue(this, {
          severity: "low",
          issue: "Very short README",
          rootCause: "README is under 200 characters and likely a placeholder.",
          impact: "Insufficient guidance for users and contributors.",
          solution: "Expand the README with real setup and usage details.",
          file: "README.md",
        })
      );
    }

    if (/\b(lorem ipsum|todo|tbd|fill me in|coming soon)\b/i.test(readme)) {
      issues.push(
        issue(this, {
          severity: "medium",
          issue: "Placeholder text left in README",
          rootCause: "README contains placeholder copy (e.g. \"TODO\", \"Lorem ipsum\", \"coming soon\").",
          impact: "Reads as unfinished and undermines trust in the project.",
          solution: "Replace placeholder text with real content before publishing.",
          file: "README.md",
        })
      );
    }

    const misspellings = findSpellingMistakes(readme);
    const uniqueWords = new Set(misspellings.map((m) => m.word.toLowerCase()));
    for (const word of uniqueWords) {
      const hit = misspellings.find((m) => m.word.toLowerCase() === word)!;
      issues.push(
        issue(this, {
          severity: "low",
          issue: `Spelling mistake in README: "${hit.word}" → "${hit.suggestion}"`,
          rootCause: `"${hit.word}" is a common misspelling of "${hit.suggestion}".`,
          impact: "Typos in user-facing docs read as unpolished and lower trust.",
          solution: `Replace "${hit.word}" with "${hit.suggestion}".`,
          file: "README.md",
          line: lineAt(readme, hit.index),
        })
      );
    }

    return issues;
  }
}
