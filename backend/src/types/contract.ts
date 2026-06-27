/**
 * Canonical contract shared between backend and frontend.
 * This file is the single source of truth; `npm run sync-types` mirrors it to
 * frontend/src/types/contract.ts. Keep it dependency-free so both sides can import it.
 */

export type Severity = "critical" | "high" | "medium" | "low";

/** The six health-score categories from the spec. Each Issue.category is one of these. */
export type Category =
  | "Architecture"
  | "Code Quality"
  | "Security"
  | "Dependencies"
  | "Documentation"
  | "Maintainability";

export const CATEGORIES: Category[] = [
  "Architecture",
  "Code Quality",
  "Security",
  "Dependencies",
  "Documentation",
  "Maintainability",
];

/** The fixed issue shape every analyzer returns (spec: Report Format). */
export interface Issue {
  category: Category;
  severity: Severity;
  issue: string;
  rootCause: string;
  impact: string;
  solution: string;
  file: string;
  line?: number;
  /** Name of the analyzer that produced this issue (diagnostic, not in spec's shape). */
  analyzer?: string;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SourceRef {
  type: "github" | "zip";
  /** GitHub URL or original zip filename. */
  ref: string;
}

/** A React Flow-compatible architecture graph. */
export interface GraphNode {
  id: string;
  label: string;
  /** Layer bucket used for layout + colour (controller/service/repository/database/module). */
  layer: "controller" | "service" | "repository" | "database" | "module";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface HealthReport {
  id: string;
  source: SourceRef;
  createdAt: string; // ISO string
  /** 0-100 weighted overall score. */
  overallScore: number;
  /** Each of the six categories scored 0-100. */
  categoryScores: Record<Category, number>;
  counts: SeverityCounts;
  issues: Issue[];
  architectureGraph: ArchitectureGraph;
  /** Quick repo facts surfaced on the dashboard. */
  stats: {
    totalFiles: number;
    totalLines: number;
    analyzedFiles: number;
  };
}

/** Lightweight row for the "past reports" list. */
export interface ReportSummary {
  id: string;
  source: SourceRef;
  createdAt: string;
  overallScore: number;
  counts: SeverityCounts;
}

// ---------- Auth contract ----------

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}
