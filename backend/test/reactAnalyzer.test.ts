import { describe, expect, it } from "vitest";
import { ReactAnalyzer } from "../src/analyzers/ReactAnalyzer";
import { buildContext } from "../src/context/buildContext";
import { makeFixture, registerFixtureCleanup } from "./testFixture";

registerFixtureCleanup();

describe("ReactAnalyzer deep-nesting detection", () => {
  it("counts JSX nested inside conditional expressions, not just direct JSX children", async () => {
    // 9 levels of <tag>{true && <tag>...}</tag>, each reached through a
    // JsxExpressionContainer + BinaryExpression rather than a direct JsxElement child.
    // The threshold is >8, so this must report an issue if depth is counted correctly;
    // the buggy traversal can't see past the first conditional wrapper and reports 1.
    let jsx = "<i>text</i>";
    for (let n = 0; n < 8; n++) jsx = `<div>{true && ${jsx}}</div>`;
    const dir = await makeFixture({
      "src/Deep.tsx": `export function Deep() {\n  return ${jsx};\n}\n`,
    });
    const ctx = await buildContext(dir);
    const issues = await new ReactAnalyzer().analyze(ctx);
    const deep = issues.find((i) => i.issue.startsWith("Deep component tree"));
    expect(deep).toBeTruthy();
  });
});

describe("ReactAnalyzer prop-drilling false positives", () => {
  // The file-level guard only skips files with zero JSX anywhere, so these fixtures
  // pair each non-component helper with a real component in the same file -- exactly
  // the shape of AuthContext.tsx/Inspect.tsx/UploadPanel.tsx, where the bug actually fired.
  it("does not flag a non-component helper whose first parameter is a primitive type", async () => {
    // string's resolved TS type pulls in every String.prototype member (charAt, slice,
    // trim, ...) -- typeNode.getType().getProperties() must not count those as "props",
    // and this helper isn't a component (no JSX) in the first place.
    const dir = await makeFixture({
      "src/util.tsx": [
        "export function describe(token: string | null) {",
        "  return token;",
        "}",
        "export function Comp() {",
        "  return <div>{describe(null)}</div>;",
        "}",
      ].join("\n"),
    });
    const ctx = await buildContext(dir);
    const issues = await new ReactAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.startsWith("Possible prop drilling"))).toBe(false);
  });

  it("does not flag a non-component helper whose first parameter is a DOM/array type", async () => {
    const dir = await makeFixture({
      "src/util.tsx": [
        "export function scrollTo(el: HTMLElement | null) {",
        "  el?.scrollIntoView();",
        "}",
        "export function names(files: File[]) {",
        "  return files.map((f) => f.name);",
        "}",
        "export function Comp() {",
        "  return <div>ok</div>;",
        "}",
      ].join("\n"),
    });
    const ctx = await buildContext(dir);
    const issues = await new ReactAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.startsWith("Possible prop drilling"))).toBe(false);
  });

  it("does not flag a non-component helper whose first parameter is a string-literal union", async () => {
    const dir = await makeFixture({
      "src/util.tsx": [
        'type Severity = "critical" | "high" | "medium" | "low";',
        "export function label(s: Severity) {",
        "  return s.toUpperCase();",
        "}",
        "export function Comp() {",
        "  return <div>ok</div>;",
        "}",
      ].join("\n"),
    });
    const ctx = await buildContext(dir);
    const issues = await new ReactAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.startsWith("Possible prop drilling"))).toBe(false);
  });
});

describe("ReactAnalyzer prop-drilling detection", () => {
  it("counts props from an interface declared in another file, not just the same file", async () => {
    const dir = await makeFixture({
      "src/Props.ts": [
        "export interface BigProps {",
        "  a: string; b: string; c: string; d: string;",
        "  e: string; f: string; g: string; h: string; i: string;",
        "}",
      ].join("\n"),
      "src/Big.tsx": [
        'import type { BigProps } from "./Props";',
        "export function Big(props: BigProps) {",
        "  return <div>{props.a}</div>;",
        "}",
      ].join("\n"),
    });
    const ctx = await buildContext(dir);
    const issues = await new ReactAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.startsWith("Possible prop drilling"))).toBe(true);
  });
});
