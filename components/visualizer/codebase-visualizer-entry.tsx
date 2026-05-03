"use client"

import dynamic from "next/dynamic"

const CodebaseVisualizer = dynamic(() => import("@/components/visualizer/codebase-visualizer"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="surface-card min-h-[720px] px-6 py-6">
        <div className="mb-6 h-8 w-56 animate-pulse rounded-full bg-border/60" />
        <div className="h-[560px] animate-pulse rounded-[28px] border border-border/60 bg-white/70" />
      </div>
      <div className="space-y-4">
        <div className="surface-card h-56 animate-pulse" />
        <div className="surface-card h-72 animate-pulse" />
      </div>
    </div>
  ),
})

export default function CodebaseVisualizerEntry({
  repoUrl,
  projectId,
}: {
  repoUrl?: string
  projectId?: string
}) {
  return <CodebaseVisualizer repoUrl={repoUrl} projectId={projectId} />
}
