import CodebaseVisualizer from "@/components/visualizer/codebase-visualizer"
import { AppPageHeader } from "@/components/layout/app-page"

export default function ProjectVisualizerPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { repoUrl?: string }
}) {
  return (
    <div className="space-y-4">
      <AppPageHeader
        title="Project AI Visualizer"
        description={
          <>
            Project <span className="font-semibold text-primary">{params.id}</span>: map architecture, agent
            interactions, communication, deployments, and dependencies with one click.
          </>
        }
      />
      <CodebaseVisualizer repoUrl={searchParams?.repoUrl || ""} projectId={params.id} />
    </div>
  )
}
