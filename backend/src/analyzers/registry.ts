import type { Analyzer } from "./Analyzer";
import { ArchitectureAnalyzer } from "./ArchitectureAnalyzer";
import { CodeQualityAnalyzer } from "./CodeQualityAnalyzer";
import { DeadCodeAnalyzer } from "./DeadCodeAnalyzer";
import { DependencyAnalyzer } from "./DependencyAnalyzer";
import { DocumentationAnalyzer } from "./DocumentationAnalyzer";
import { EnvironmentAnalyzer } from "./EnvironmentAnalyzer";
import { ProjectStructureAnalyzer } from "./ProjectStructureAnalyzer";
import { ReactAnalyzer } from "./ReactAnalyzer";
import { SecurityAnalyzer } from "./SecurityAnalyzer";
import { TypeScriptAnalyzer } from "./TypeScriptAnalyzer";

/** The full set of analyzers run by the Inspector. Add a new analyzer here only. */
export function createAnalyzers(): Analyzer[] {
  return [
    new ArchitectureAnalyzer(),
    new ProjectStructureAnalyzer(),
    new CodeQualityAnalyzer(),
    new DeadCodeAnalyzer(),
    new TypeScriptAnalyzer(),
    new ReactAnalyzer(),
    new SecurityAnalyzer(),
    new EnvironmentAnalyzer(),
    new DependencyAnalyzer(),
    new DocumentationAnalyzer(),
  ];
}
