/**
 * Mirror of backend/src/types/contract.ts (single source of truth).
 * Keep in sync; the backend file is canonical.
 */

export type Severity = "critical" | "high" | "medium" | "low";

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

export interface Issue {
  category: Category;
  severity: Severity;
  issue: string;
  rootCause: string;
  impact: string;
  solution: string;
  file: string;
  line?: number;
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
  ref: string;
}

export interface GraphNode {
  id: string;
  label: string;
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
  createdAt: string;
  overallScore: number;
  categoryScores: Record<Category, number>;
  counts: SeverityCounts;
  issues: Issue[];
  architectureGraph: ArchitectureGraph;
  stats: {
    totalFiles: number;
    totalLines: number;
    analyzedFiles: number;
  };
}

export interface ReportSummary {
  id: string;
  source: SourceRef;
  createdAt: string;
  overallScore: number;
  counts: SeverityCounts;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}
