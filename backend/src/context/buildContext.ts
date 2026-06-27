import { promises as fs } from "fs";
import path from "path";
import { Project, SourceFile } from "ts-morph";
import type { AnalysisConfig } from "../config/defaults";
import { DEFAULT_CONFIG } from "../config/defaults";

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * The shared dependency every analyzer receives (Seam #2 input).
 * Built once over a materialized repo; analyzers never touch the filesystem
 * or parse TS themselves.
 */
export interface AnalysisContext {
  rootDir: string;
  project: Project;
  sourceFiles: SourceFile[];
  /** Every file path (relative to rootDir, posix style), including non-TS files. */
  allFiles: string[];
  packageJson?: PackageJson;
  readme?: string;
  gitignore?: string;
  envFiles: { name: string; content: string }[];
  config: AnalysisConfig;
  stats: { totalFiles: number; totalLines: number; analyzedFiles: number };
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "vendor",
]);

const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

/** Recursively walks a directory, returning posix-relative paths (skipping noise dirs). */
async function walk(dir: string, rootDir: string, acc: string[] = []): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env" && entry.name !== ".env.example") {
      // allow .env files through, skip other dotfiles/dirs like .git
      if (entry.isDirectory()) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await walk(full, rootDir, acc);
    } else {
      acc.push(path.relative(rootDir, full).split(path.sep).join("/"));
    }
  }
  return acc;
}

async function readIfExists(rootDir: string, ...names: string[]): Promise<string | undefined> {
  for (const name of names) {
    try {
      return await fs.readFile(path.join(rootDir, name), "utf8");
    } catch {
      /* try next */
    }
  }
  return undefined;
}

export async function buildContext(
  rootDir: string,
  config: AnalysisConfig = DEFAULT_CONFIG
): Promise<AnalysisContext> {
  const allFiles = await walk(rootDir, rootDir);

  // Parse all TS/TSX files once into a single ts-morph Project (no type-checker program
  // needed for our syntactic rules; useInMemoryFileSystem off so we read from disk).
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: false, jsx: 4 /* ReactJSX */ },
  });

  const tsRelPaths = allFiles.filter((f) => TS_EXTENSIONS.includes(path.extname(f)));
  const sourceFiles: SourceFile[] = [];
  for (const rel of tsRelPaths) {
    try {
      const sf = project.addSourceFileAtPath(path.join(rootDir, rel));
      sourceFiles.push(sf);
    } catch {
      /* skip files ts-morph can't parse */
    }
  }

  // package.json
  let packageJson: PackageJson | undefined;
  const pkgRaw = await readIfExists(rootDir, "package.json");
  if (pkgRaw) {
    try {
      packageJson = JSON.parse(pkgRaw) as PackageJson;
    } catch {
      /* malformed package.json -> leave undefined */
    }
  }

  // README (case-insensitive-ish common variants)
  const readme = await readIfExists(rootDir, "README.md", "readme.md", "Readme.md", "README.MD");

  // .gitignore (used to flag secrets that aren't actually ignored)
  const gitignore = await readIfExists(rootDir, ".gitignore");

  // env files
  const envFiles: { name: string; content: string }[] = [];
  for (const name of [".env", ".env.example", ".env.sample", ".env.local"]) {
    const content = await readIfExists(rootDir, name);
    if (content !== undefined) envFiles.push({ name, content });
  }

  // stats
  let totalLines = 0;
  for (const sf of sourceFiles) {
    totalLines += sf.getEndLineNumber();
  }

  return {
    rootDir,
    project,
    sourceFiles,
    allFiles,
    packageJson,
    readme,
    gitignore,
    envFiles,
    config,
    stats: {
      totalFiles: allFiles.length,
      totalLines,
      analyzedFiles: sourceFiles.length,
    },
  };
}
