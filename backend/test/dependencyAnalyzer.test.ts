import { describe, expect, it } from "vitest";
import { DependencyAnalyzer } from "../src/analyzers/DependencyAnalyzer";
import { buildContext } from "../src/context/buildContext";
import { makeFixture, registerFixtureCleanup } from "./testFixture";

registerFixtureCleanup();

describe("DependencyAnalyzer usage detection", () => {
  it("recognizes a require() call inside a .ts file, not just ES imports", async () => {
    // ts-morph's getImportDeclarations() only sees ES `import` statements; the regex
    // fallback only scanned .js/.jsx/.mjs/.cjs, so a require() in a .ts file was
    // invisible to both paths and "left-pad" was falsely reported as unused.
    const dir = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { "left-pad": "1.0.0" } }),
      "src/index.ts": 'export const pad = require("left-pad");\n',
    });
    const ctx = await buildContext(dir);
    const issues = await new DependencyAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.includes('Unused dependency "left-pad"'))).toBe(false);
  });

  it("still flags a genuinely unused dependency", async () => {
    const dir = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { "really-unused-pkg": "1.0.0" } }),
      "src/index.ts": "export const x = 1;\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new DependencyAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.includes('Unused dependency "really-unused-pkg"'))).toBe(true);
  });
});

describe("DependencyAnalyzer version-pinning detection", () => {
  it("flags a fully wildcard/latest version as a stronger risk than pre-1.0 pinning", async () => {
    const dir = await makeFixture({
      "package.json": JSON.stringify({ dependencies: { "wild-pkg": "*", "latest-pkg": "latest" } }),
      "src/index.ts": 'import "wild-pkg";\nimport "latest-pkg";\n',
    });
    const ctx = await buildContext(dir);
    const issues = await new DependencyAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue.includes('Unpinned dependency "wild-pkg"'))).toBe(true);
    expect(issues.some((i) => i.issue.includes('Unpinned dependency "latest-pkg"'))).toBe(true);
  });
});
