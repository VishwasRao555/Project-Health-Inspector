import path from "path";
import type { AnalysisContext } from "../context/buildContext";
import type { ArchitectureGraph, GraphEdge, GraphNode } from "../types/contract";
import { relPath } from "../analyzers/util";

type Layer = GraphNode["layer"];

/** Classify a file into an architectural layer by name/path conventions. */
function classify(rel: string): Layer {
  const base = path.basename(rel).toLowerCase();
  const full = rel.toLowerCase();
  if (/(controller|route|router|handler|\bapi\b|endpoint)/.test(full)) return "controller";
  if (/(service|usecase|use-case|domain|manager)/.test(full)) return "service";
  if (/(repository|repo|dao|store|model|entity)/.test(full)) return "repository";
  if (/(db|database|prisma|mongoose|sequelize|knex|migration|schema)/.test(full) || base === "db.ts")
    return "database";
  return "module";
}

/**
 * Build a React Flow-compatible graph. To keep the graph readable we aggregate by
 * top-level folder + layer rather than drawing every file, and connect layers via
 * observed cross-layer imports.
 */
export function buildArchitectureGraph(ctx: AnalysisContext): ArchitectureGraph {
  const fileSet = new Set(ctx.sourceFiles.map((sf) => sf.getFilePath()));

  // node id -> node ; node id is "<topFolder>:<layer>"
  const nodes = new Map<string, GraphNode>();
  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];

  const nodeIdFor = (rel: string): string => {
    const top = rel.split("/")[0] || ".";
    const layer = classify(rel);
    const id = `${top}:${layer}`;
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: `${top}/${layer}`, layer });
    }
    return id;
  };

  for (const sf of ctx.sourceFiles) {
    const fromRel = relPath(ctx, sf.getFilePath());
    const fromId = nodeIdFor(fromRel);
    for (const imp of sf.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile();
      if (!target || !fileSet.has(target.getFilePath())) continue;
      const toRel = relPath(ctx, target.getFilePath());
      const toId = nodeIdFor(toRel);
      if (fromId === toId) continue;
      const key = `${fromId}->${toId}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ id: `e-${edges.length}`, source: fromId, target: toId });
    }
  }

  // If we found no nodes (e.g. non-TS project), synthesize a canonical layered diagram
  // so the dashboard always has something meaningful to show.
  if (nodes.size === 0) {
    return {
      nodes: [
        { id: "controller", label: "Controller", layer: "controller" },
        { id: "service", label: "Service", layer: "service" },
        { id: "repository", label: "Repository", layer: "repository" },
        { id: "database", label: "Database", layer: "database" },
      ],
      edges: [
        { id: "e0", source: "controller", target: "service" },
        { id: "e1", source: "service", target: "repository" },
        { id: "e2", source: "repository", target: "database" },
      ],
    };
  }

  return { nodes: [...nodes.values()], edges };
}
