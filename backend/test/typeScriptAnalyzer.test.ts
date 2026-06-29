import { describe, expect, it } from "vitest";
import { TypeScriptAnalyzer } from "../src/analyzers/TypeScriptAnalyzer";
import { buildContext } from "../src/context/buildContext";
import { makeFixture, registerFixtureCleanup } from "./testFixture";

registerFixtureCleanup();

describe("TypeScriptAnalyzer untyped-parameter detection", () => {
  it("flags untyped parameters on arrow functions, not just named function declarations", async () => {
    // sf.getFunctions() only returns top-level `function` declarations -- arrow
    // functions, the dominant style in modern TS/React code, were invisible to this check.
    const dir = await makeFixture({
      "src/math.ts": "export const add = (a, b) => a + b;\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new TypeScriptAnalyzer().analyze(ctx);
    const untyped = issues.filter((i) => i.issue.startsWith("Untyped parameter"));
    expect(untyped.length).toBe(2);
  });

  it("does not flag arrow-function parameters that already have a type annotation", async () => {
    const dir = await makeFixture({
      "src/math.ts": "export const add = (a: number, b: number) => a + b;\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new TypeScriptAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.startsWith("Untyped parameter"))).toBe(false);
  });
});

describe("TypeScriptAnalyzer @ts-ignore detection", () => {
  it("does not self-match its own explanatory comment about the directive (current wording)", async () => {
    // Mirrors the actual comment in TypeScriptAnalyzer.ts's own source -- it documents
    // the directive without writing "@ts-ignore" contiguously, specifically so the
    // analyzer scanning its own codebase doesn't flag itself.
    const dir = await makeFixture({
      "src/note.ts":
        "// Suppressed type checking via a ts-ignore/ts-nocheck/ts-expect-error directive.\nexport const x = 1;\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new TypeScriptAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.startsWith("Suppressed type checking"))).toBe(false);
  });

  it("still flags a real @ts-ignore directive", async () => {
    const dir = await makeFixture({
      "src/note.ts": "// @ts-ignore\nexport const x: number = 'bad';\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new TypeScriptAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.startsWith("Suppressed type checking"))).toBe(true);
  });
});

describe("TypeScriptAnalyzer `var` detection", () => {
  it("flags `var` declared inside a function body, not just at module scope", async () => {
    // sf.getVariableStatements() only returns top-level statements -- `var` inside any
    // function/block body was invisible to this check.
    const dir = await makeFixture({
      "src/legacy.ts": "export function run() {\n  var x = 1;\n  return x;\n}\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new TypeScriptAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue === "Use of `var` instead of `let`/`const`")).toBe(true);
  });
});
