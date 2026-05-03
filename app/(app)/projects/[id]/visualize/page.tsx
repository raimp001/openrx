import { AppPageHeader } from "@/components/layout/app-page"
import CodebaseVisualizerEntry from "@/components/visualizer/codebase-visualizer-entry"
import { Bot, GitBranch, ShieldCheck } from "lucide-react"

export default function ProjectVisualizerPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { repoUrl?: string }
}) {
  return (
    <div className="space-y-6">
      <AppPageHeader
        eyebrow="Engineering intelligence"
        title="Project AI Visualizer"
        description={
          <>
            Project <span className="font-semibold text-primary">{params.id}</span>: generate a navigable architecture briefing that highlights system shape, agent interactions, deployment flow, and technical risk.
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-secondary ring-1 ring-border">
              repo intelligence
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-secondary ring-1 ring-border">
              exportable diagrams
            </span>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card px-5 py-5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-primary text-white shadow-soft-card">
            <GitBranch size={18} />
          </div>
          <h2 className="mt-4 text-base font-serif text-primary">Map the real system</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Turn a repository or zip archive into interaction diagrams, architecture summaries, and deploy-aware dependency views.
          </p>
        </div>
        <div className="surface-card px-5 py-5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-accent text-white shadow-soft-card">
            <Bot size={18} />
          </div>
          <h2 className="mt-4 text-base font-serif text-primary">Ask the mapper</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Ask focused questions about risk boundaries, agent bottlenecks, payment flow, or deployment weak points after the map is built.
          </p>
        </div>
        <div className="surface-card px-5 py-5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-accent text-white shadow-soft-card">
            <ShieldCheck size={18} />
          </div>
          <h2 className="mt-4 text-base font-serif text-primary">Share a clean briefing</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Export diagrams as PNG, SVG, PDF, Mermaid, or raw JSON for engineering reviews, demo decks, and follow-up architecture work.
          </p>
        </div>
      </div>
      <CodebaseVisualizerEntry repoUrl={searchParams?.repoUrl || ""} projectId={params.id} />
    </div>
  )
}
