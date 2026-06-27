import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { ArchitectureGraph as Graph, GraphNode } from "../types/contract";

const LAYER_ORDER: GraphNode["layer"][] = [
  "controller",
  "service",
  "repository",
  "database",
  "module",
];

const LAYER_COLOR: Record<GraphNode["layer"], string> = {
  controller: "#38bdf8",
  service: "#818cf8",
  repository: "#34d399",
  database: "#fbbf24",
  module: "#94a3b8",
};

/** Lays nodes out in horizontal bands by architectural layer and renders the import edges. */
export function ArchitectureGraph({ graph }: { graph: Graph }) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph]);

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h3 className="text-sm font-semibold text-white">Architecture map</h3>
        <span className="text-xs text-gray-500">{graph.nodes.length} modules · {graph.edges.length} links</span>
      </div>
      <div className="h-[420px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          minZoom={0.2}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.08)" />
          <Controls showInteractive={false} className="!border-line !bg-ink-800" />
        </ReactFlow>
      </div>
    </div>
  );
}

function layout(graph: Graph): { nodes: Node[]; edges: Edge[] } {
  const byLayer = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    if (!byLayer.has(n.layer)) byLayer.set(n.layer, []);
    byLayer.get(n.layer)!.push(n);
  }

  const nodes: Node[] = [];
  let row = 0;
  for (const layer of LAYER_ORDER) {
    const group = byLayer.get(layer);
    if (!group || group.length === 0) continue;
    group.forEach((n, col) => {
      nodes.push({
        id: n.id,
        position: { x: col * 230 + 40, y: row * 130 + 30 },
        data: { label: n.label },
        style: {
          background: "#11141d",
          color: "#e5e7eb",
          border: `1px solid ${LAYER_COLOR[layer]}66`,
          borderRadius: 12,
          fontSize: 12,
          padding: "8px 12px",
          boxShadow: `0 0 22px -10px ${LAYER_COLOR[layer]}`,
          width: 190,
        },
      });
    });
    row++;
  }

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: "rgba(56,189,248,0.35)", strokeWidth: 1.5 },
  }));

  return { nodes, edges };
}
