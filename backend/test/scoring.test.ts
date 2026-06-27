import { describe, expect, it } from "vitest";
import { score } from "../src/scoring/HealthScorer";
import type { Issue } from "../src/types/contract";

function issue(category: Issue["category"], severity: Issue["severity"]): Issue {
  return {
    category,
    severity,
    issue: "x",
    rootCause: "x",
    impact: "x",
    solution: "x",
    file: "x.ts",
  };
}

describe("HealthScorer", () => {
  it("never awards a perfect score, even with no issues", () => {
    const r = score([]);
    expect(r.overall).toBe(96);
    expect(r.categories.Security).toBe(96);
    expect(r.overall).toBeLessThan(100);
    expect(r.counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it("subtracts severity penalties per category and floors at 0", () => {
    const r = score([
      issue("Security", "critical"), // 96 - 34 = 62
      issue("Security", "critical"), // 62 - 34 = 28
      issue("Documentation", "low"), // 96 - 5 = 91
    ]);
    expect(r.categories.Security).toBe(28);
    expect(r.categories.Documentation).toBe(91);
    expect(r.counts).toEqual({ critical: 2, high: 0, medium: 0, low: 1 });
  });

  it("computes the weighted overall score", () => {
    // Only Documentation drops (one medium = -11 -> 85). Overall = sum of weighted.
    const r = score([issue("Documentation", "medium")]);
    // Documentation 85 * 0.10 + others 96 * 0.90 = 8.5 + 86.4 = 94.9 -> rounded 95
    expect(r.overall).toBe(95);
  });
});
