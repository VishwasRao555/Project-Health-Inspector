import { describe, expect, it } from "vitest";
import { DeadCodeAnalyzer } from "../src/analyzers/DeadCodeAnalyzer";
import { buildContext } from "../src/context/buildContext";
import { makeFixture, registerFixtureCleanup } from "./testFixture";

registerFixtureCleanup();

describe("DeadCodeAnalyzer possibly-unused-file detection", () => {
  it("does not flag a file only reached through a barrel re-export", async () => {
    // getImportDeclarations() doesn't see `export ... from` re-exports, so a file only
    // ever reached through a barrel index.ts was falsely flagged as unused.
    const dir = await makeFixture({
      "src/utils/helper.ts": "export function helper() {\n  return 1;\n}\n",
      "src/utils/index.ts": 'export * from "./helper";\n',
      "src/main.ts": 'import { helper } from "./utils";\nhelper();\n',
    });
    const ctx = await buildContext(dir);
    const issues = await new DeadCodeAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue === "Possibly unused file" && i.file === "src/utils/helper.ts")).toBe(
      false
    );
  });

  it("still flags a file that's genuinely never imported or re-exported", async () => {
    const dir = await makeFixture({
      "src/orphan.ts": "export function orphan() {\n  return 1;\n}\n",
      "src/main.ts": "export const x = 1;\n",
    });
    const ctx = await buildContext(dir);
    const issues = await new DeadCodeAnalyzer().analyze(ctx);
    expect(issues.some((i) => i.issue === "Possibly unused file" && i.file === "src/orphan.ts")).toBe(true);
  });
});
