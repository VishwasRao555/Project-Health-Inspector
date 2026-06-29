import path from "path";
import { describe, expect, it } from "vitest";
import { Inspector } from "../src/inspector/Inspector";
import type { RepoHandle, RepositorySource } from "../src/sources/RepositorySource";
import { CATEGORIES } from "../src/types/contract";

/** Points the Inspector at the on-disk fixture without cloning/extracting. */
class FixtureSource implements RepositorySource {
  constructor(private readonly dir: string) {}
  async materialize(): Promise<RepoHandle> {
    return { rootDir: this.dir, cleanup: async () => {} };
  }
}

const fixtureDir = path.join(__dirname, "fixtures", "sample");

describe("Inspector (full pipeline)", () => {
  it("produces a complete HealthReport with planted issues", async () => {
    const inspector = new Inspector();
    const report = await inspector.inspect(new FixtureSource(fixtureDir), {
      type: "zip",
      ref: "sample.zip",
    });

    // Report shape
    expect(report.id).toBeTruthy();
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    for (const c of CATEGORIES) {
      expect(report.categoryScores[c]).toBeGreaterThanOrEqual(0);
      expect(report.categoryScores[c]).toBeLessThanOrEqual(100);
    }
    expect(report.architectureGraph.nodes.length).toBeGreaterThan(0);

    // Planted issues are detected
    const titles = report.issues.map((i) => i.issue.toLowerCase());
    expect(titles.some((t) => t.includes("password"))).toBe(true);
    expect(titles.some((t) => t.includes("sql injection"))).toBe(true);
    expect(report.issues.some((i) => i.category === "Security")).toBe(true);
    expect(report.issues.some((i) => i.category === "Documentation")).toBe(true);
    expect(report.issues.some((i) => i.category === "Dependencies")).toBe(true);
  });

  it("drops low-severity issues so the report isn't dominated by noise", async () => {
    const inspector = new Inspector();
    const report = await inspector.inspect(new FixtureSource(fixtureDir), {
      type: "zip",
      ref: "sample.zip",
    });
    expect(report.issues.some((i) => i.severity === "low")).toBe(false);
    expect(report.counts.low).toBe(0);
  });
});
