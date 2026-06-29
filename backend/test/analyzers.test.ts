import { describe, expect, it } from "vitest";
import { CodeQualityAnalyzer } from "../src/analyzers/CodeQualityAnalyzer";
import { EnvironmentAnalyzer } from "../src/analyzers/EnvironmentAnalyzer";
import { SecurityAnalyzer } from "../src/analyzers/SecurityAnalyzer";
import { buildContext } from "../src/context/buildContext";
import { makeFixture, registerFixtureCleanup } from "./testFixture";

registerFixtureCleanup();

describe("SecurityAnalyzer", () => {
  it("does not flag eval()/new Function() inside its own rule-definition source", async () => {
    // Mirrors backend/src/analyzers/SecurityAnalyzer.ts: a regex literal and a message
    // string both contain the text "eval(" / "new Function(" without calling either.
    const dir = await makeFixture({
      "src/analyzers/FakeAnalyzer.ts": [
        `const EVAL_USAGE = /\\beval\\s*\\(|new\\s+Function\\s*\\(/;`,
        `export const MESSAGE = "Use of eval() / new Function()";`,
      ].join("\n"),
    });
    const ctx = await buildContext(dir);
    const issues = await new SecurityAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.includes("eval"))).toBe(false);
  });

  it("still flags real eval() usage in ordinary application source", async () => {
    const dir = await makeFixture({
      "src/app.ts": `export function run(input: string) {\n  return eval(input);\n}\n`,
    });
    const ctx = await buildContext(dir);
    const issues = await new SecurityAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.includes("eval"))).toBe(true);
  });

  it("does not flag plain English sentences containing SQL keywords in a template literal", async () => {
    // Mirrors the false positives from frontend/src/pages/History.tsx: "selected" contains
    // "select", and "Select report from ${x}" reads as an ordinary UI string, not SQL.
    const dir = await makeFixture({
      "src/Component.tsx": [
        `export function Label({ n, name }: { n: number; name: string }) {`,
        `  return <span>{\`Compare selected (\${n}/2)\`}<em>{\`Select report from \${name}\`}</em></span>;`,
        `}`,
      ].join("\n"),
    });
    const ctx = await buildContext(dir);
    const issues = await new SecurityAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue === "Possible SQL injection")).toBe(false);
  });

  it("still flags a real template-literal SQL injection passed to a query call", async () => {
    const dir = await makeFixture({
      "src/db.ts": "export function find(id: string) {\n  return db.query(`SELECT * FROM users WHERE id=${id}`);\n}\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new SecurityAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue === "Possible SQL injection")).toBe(true);
  });
});

describe("EnvironmentAnalyzer", () => {
  it("recognizes a camelCase env var reference as used, not unused", async () => {
    // .env defines "apiKey" (legal, if non-conventional); code reads it via
    // process.env.apiKey. The old [A-Z0-9_]+ regex couldn't capture lowercase letters,
    // so it never saw this reference and falsely reported "Unused environment variable".
    const dir = await makeFixture({
      ".env": "apiKey=secret123\n",
      "src/config.ts": "export const key = process.env.apiKey;\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new EnvironmentAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.includes('Unused environment variable "apiKey"'))).toBe(false);
  });

  it("still flags a genuinely unused env var", async () => {
    const dir = await makeFixture({
      ".env": "REALLY_UNUSED=1\n",
      "src/config.ts": "export const x = 1;\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new EnvironmentAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.includes('Unused environment variable "REALLY_UNUSED"'))).toBe(true);
  });
});

describe("CodeQualityAnalyzer duplicate detection", () => {
  it("reports one issue for a contiguous duplicated block, not one per shifted window", async () => {
    // Distinct prefix/suffix lines stop a window from matching once it crosses the
    // duplicated region's boundary, so the 12-line shared block is unambiguous.
    const block = Array.from({ length: 12 }, (_, i) => `  const line${i} = ${i};`).join("\n");
    const dir = await makeFixture({
      "src/a.ts": `const ONLY_IN_A = "a-prefix";\n${block}\nconst ALSO_ONLY_IN_A = "a-suffix";\n`,
      "src/b.ts": `const ONLY_IN_B = "b-prefix";\n${block}\nconst ALSO_ONLY_IN_B = "b-suffix";\n`,
    });
    const ctx = await buildContext(dir);
    const issues = await new CodeQualityAnalyzer().analyze(ctx);
    const dupes = issues.filter((i) => i.issue.startsWith("Duplicate code block"));
    expect(dupes.length).toBe(1);
    expect(dupes[0].issue).toBe("Duplicate code block (12 lines)");
  });
});
