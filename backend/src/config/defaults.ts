import type { Category, Severity } from "../types/contract";

/** Tunable thresholds used across analyzers. */
export interface AnalysisConfig {
  maxFileLines: number;
  maxFunctionLines: number;
  maxFilesPerFolder: number;
  maxFolderDepth: number;
  maxImportChainDepth: number;
  /** % of `any` annotations over total type annotations that counts as "excessive". */
  anyUsageWarnPercent: number;
  /** Component prop count above which we flag prop drilling risk. */
  maxComponentProps: number;
  /** Heavy dependency byte threshold is approximated via a known-heavy list. */
  heavyDependencies: string[];
}

export const DEFAULT_CONFIG: AnalysisConfig = {
  maxFileLines: 1000,
  maxFunctionLines: 100,
  maxFilesPerFolder: 40,
  maxFolderDepth: 6,
  maxImportChainDepth: 6,
  anyUsageWarnPercent: 15,
  maxComponentProps: 8,
  heavyDependencies: [
    "moment",
    "lodash",
    "rxjs",
    "core-js",
    "three",
    "@material-ui/core",
    "antd",
    "jquery",
    "aws-sdk",
    "firebase",
  ],
};

/** Overall-score weights (spec: must sum to 1.0). */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  Architecture: 0.2,
  "Code Quality": 0.2,
  Security: 0.2,
  Dependencies: 0.15,
  Documentation: 0.1,
  Maintainability: 0.15,
};

/** Per-issue penalty (points subtracted from a category's 100) by severity. */
export const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 34,
  high: 20,
  medium: 11,
  low: 5,
};

/**
 * No category is allowed to read as "perfect" — real-world code always has room to
 * improve, and a flat 100 reads as the analyzer having nothing left to say.
 */
export const MAX_CATEGORY_SCORE = 96;
