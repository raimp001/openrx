"use client"

import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node, type NodeProps } from "reactflow"

function InsightNode({ data }: NodeProps<{ label: string; insight: string }>) {
  return (
    <div
      title={data.insight}
      className="rounded-[18px] border border-border/80 bg-white px-3 py-2 text-[11px] text-primary shadow-[0_12px_24px_rgba(8,24,46,0.08)]"
    >
      <div className="font-semibold">{data.label}</div>
      <div className="mt-1 line-clamp-2 text-[10px] text-muted">{data.insight}</div>
    </div>
  )
}

const nodeTypes = {
  default: InsightNode,
}

export default function ReactFlowCanvas({
  nodes,
  edges,
  onNodeSelect,
}: {
  nodes: Node[]
  edges: Edge[]
  onNodeSelect: (nodeId: string) => void
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={(_, node) => onNodeSelect(node.id)}
      fitView
      proOptions={{ hideAttribution: true }}
      nodeTypes={nodeTypes}
      className="!bg-zinc-50"
    >
      <MiniMap className="!bg-white" />
      <Controls className="!bg-white" />
      <Background color="#d4d4d8" gap={24} />
    </ReactFlow>
  )
}
