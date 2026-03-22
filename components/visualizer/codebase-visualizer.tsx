"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  Download,
  FileCode2,
  GitBranch,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow"
import { toPng, toSvg } from "html-to-image"
import { jsPDF } from "jspdf"
import MermaidRender from "@/components/visualizer/mermaid-render"
import { cn } from "@/lib/utils"
import {
  VISUALIZER_FOCUS_AREAS,
  VISUALIZER_SYSTEM_PROMPT,
} from "@/lib/codebase-visualizer/constants"
import type {
  DiagramPayload,
  VisualizerFocusArea,
  VisualizerMappingResponse,
} from "@/lib/codebase-visualizer/types"

export interface CodebaseVisualizerProps {
  repoUrl?: string
  projectId?: string
  onComplete?: (mapping: VisualizerMappingResponse) => void
  className?: string
}

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

function InsightNode({ data }: NodeProps<{ label: string; insight: string }>) {
  return (
    <div
      title={data.insight}
      className="rounded-[18px] border border-sand/80 bg-[linear-gradient(180deg,rgba(255,250,242,0.98),rgba(243,235,224,0.96))] px-3 py-2 text-[11px] text-warm-800 shadow-[0_12px_24px_rgba(17,34,30,0.08)]"
    >
      <div className="font-semibold">{data.label}</div>
      <div className="mt-1 line-clamp-2 text-[10px] text-warm-500">{data.insight}</div>
    </div>
  )
}

const nodeTypes = {
  default: InsightNode,
}

function downloadBlob(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function CodebaseVisualizer(props: CodebaseVisualizerProps) {
  const [repoUrl, setRepoUrl] = useState(props.repoUrl || "")
  const [githubToken, setGithubToken] = useState("")
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [focusAreas, setFocusAreas] = useState<VisualizerFocusArea[]>([
    "agent_interactions",
    "communication_protocols",
    "deployment_pipeline",
  ])

  const [isMapping, setIsMapping] = useState(false)
  const [mapping, setMapping] = useState<VisualizerMappingResponse | null>(null)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [activeDiagramId, setActiveDiagramId] = useState("")
  const [viewMode, setViewMode] = useState<"graph" | "mermaid">("graph")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedNodeId, setSelectedNodeId] = useState("")

  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const [improveLoading, setImproveLoading] = useState(false)

  const diagramRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    if (!mapping?.diagrams.length) return
    if (!activeDiagramId || !mapping.diagrams.some((diagram) => diagram.id === activeDiagramId)) {
      setActiveDiagramId(mapping.diagrams[0].id)
    }
  }, [mapping, activeDiagramId])

  const activeDiagram = useMemo(() => {
    if (!mapping) return null
    return mapping.diagrams.find((diagram) => diagram.id === activeDiagramId) || null
  }, [mapping, activeDiagramId])

  const visibleNodes = useMemo(() => {
    if (!activeDiagram) return [] as Node[]
    return activeDiagram.reactFlowData.nodes.map((node) => {
      const matched =
        !searchTerm ||
        node.data.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.data.insight.toLowerCase().includes(searchTerm.toLowerCase())
      return {
        ...node,
        type: "default",
        style: {
          ...(node.style || {}),
          opacity: matched ? 1 : 0.22,
        },
      }
    })
  }, [activeDiagram, searchTerm])

  const visibleEdges = useMemo(() => {
    if (!activeDiagram) return [] as Edge[]
    return activeDiagram.reactFlowData.edges as Edge[]
  }, [activeDiagram])

  const selectedNode = useMemo(() => {
    if (!activeDiagram) return null
    return activeDiagram.reactFlowData.nodes.find((node) => node.id === selectedNodeId) || null
  }, [activeDiagram, selectedNodeId])

  function toggleFocusArea(area: VisualizerFocusArea) {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((entry) => entry !== area) : [...prev, area]
    )
  }

  async function startMapping() {
    setError("")
    setMapping(null)
    setChatMessages([])
    setProgress(2)

    if (!repoUrl.trim() && !archiveFile) {
      setError("Provide a GitHub repo URL or upload a .zip file.")
      return
    }

    setIsMapping(true)
    const localThoughts = [
      "Preparing secure sandbox...",
      "Scanning repository tree and language mix...",
      "Building interaction graph...",
      "Generating Mermaid + React-Flow diagrams...",
      "Refining for clarity...",
      "Finalizing mapping payload...",
    ]

    setLogs([`Mapper prompt active: ${VISUALIZER_SYSTEM_PROMPT}`])

    let thoughtIndex = 0
    const interval = window.setInterval(() => {
      setLogs((prev) => {
        if (thoughtIndex >= localThoughts.length) return prev
        const next = [...prev, localThoughts[thoughtIndex]]
        thoughtIndex += 1
        return next
      })
      setProgress((prev) => Math.min(prev + 12, 88))
    }, 1100)

    try {
      const form = new FormData()
      if (repoUrl.trim()) form.append("repoUrl", repoUrl.trim())
      if (githubToken.trim()) form.append("githubToken", githubToken.trim())
      if (archiveFile) form.append("archive", archiveFile)
      form.append("focusAreas", JSON.stringify(focusAreas))

      const response = await fetch("/api/visualize", {
        method: "POST",
        body: form,
      })
      const data = (await response.json()) as VisualizerMappingResponse & { error?: string }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to map repository")
      }

      setMapping(data)
      setLogs((prev) => [...prev, ...data.progressLogs])
      setProgress(100)
      props.onComplete?.(data)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Mapping failed")
    } finally {
      window.clearInterval(interval)
      setIsMapping(false)
    }
  }

  async function askMapper() {
    if (!mapping || !chatInput.trim()) return
    const question = chatInput.trim()

    setChatMessages((prev) => [...prev, { role: "user", text: question }])
    setChatInput("")
    setChatLoading(true)

    try {
      const response = await fetch("/api/visualize/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mappingId: mapping.mappingId, question }),
      })
      const data = (await response.json()) as {
        error?: string
        answer?: string
        regeneratedDiagrams?: DiagramPayload[]
      }

      if (!response.ok || data.error || !data.answer) {
        throw new Error(data.error || "Ask mapper failed")
      }

      setChatMessages((prev) => [...prev, { role: "assistant", text: data.answer || "" }])
      if (data.regeneratedDiagrams && data.regeneratedDiagrams.length > 0) {
        setMapping((prev) => {
          if (!prev) return prev
          const replacement = new Map(data.regeneratedDiagrams!.map((diagram) => [diagram.id, diagram]))
          const diagrams = prev.diagrams.map((diagram) => replacement.get(diagram.id) || diagram)
          return { ...prev, diagrams }
        })
      }
    } catch (issue) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: issue instanceof Error ? issue.message : "Mapper chat failed",
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  async function improveCurrentDiagram() {
    if (!mapping || !activeDiagram) return
    setImproveLoading(true)

    try {
      const response = await fetch("/api/visualize/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mappingId: mapping.mappingId,
          diagramId: activeDiagram.id,
          instruction: "Improve readability and annotate highest-risk interactions.",
        }),
      })
      const data = (await response.json()) as { error?: string; diagram?: DiagramPayload }
      if (!response.ok || data.error || !data.diagram) {
        throw new Error(data.error || "Improve diagram failed")
      }

      setMapping((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          diagrams: prev.diagrams.map((diagram) =>
            diagram.id === data.diagram!.id ? data.diagram! : diagram
          ),
        }
      })
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not improve diagram")
    } finally {
      setImproveLoading(false)
    }
  }

  async function exportAs(format: "png" | "svg" | "pdf") {
    if (!diagramRef.current || !activeDiagram) return

    if (format === "svg") {
      const svg = await toSvg(diagramRef.current, { cacheBust: true })
      downloadBlob(`${activeDiagram.id}.svg`, svg, "image/svg+xml")
      return
    }

    const png = await toPng(diagramRef.current, { cacheBust: true, pixelRatio: 2 })
    if (format === "png") {
      downloadBlob(`${activeDiagram.id}.png`, await (await fetch(png)).blob(), "image/png")
      return
    }

    const image = new Image()
    image.src = png
    await new Promise((resolve) => {
      image.onload = resolve
    })
    const pdf = new jsPDF({
      orientation: image.width > image.height ? "landscape" : "portrait",
      unit: "px",
      format: [image.width, image.height],
    })
    pdf.addImage(png, "PNG", 0, 0, image.width, image.height)
    pdf.save(`${activeDiagram.id}.pdf`)
  }

  function exportRaw(kind: "mermaid" | "json") {
    if (!activeDiagram) return
    if (kind === "mermaid") {
      downloadBlob(`${activeDiagram.id}.mmd`, activeDiagram.mermaid, "text/plain")
      return
    }
    downloadBlob(`${activeDiagram.id}.json`, JSON.stringify(activeDiagram, null, 2), "application/json")
  }

  async function copyEmbedLink() {
    if (!mapping) return
    const url = `${window.location.origin}${window.location.pathname}?mappingId=${mapping.mappingId}`
    await navigator.clipboard.writeText(url)
    setLogs((prev) => [...prev, `Embed link copied: ${url}`])
  }

  return (
    <div className={cn("space-y-5", props.className)}>
      <div className="surface-card p-5 text-warm-800 shadow-[0_20px_48px_rgba(17,34,30,0.1)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl tracking-tight text-warm-800">AI Agent Codebase Mapper & Visualizer</h1>
            <p className="mt-1 text-sm text-warm-600">
              One-click architecture mapping with interactive diagrams, AI insights, exports, and follow-up analysis.
            </p>
          </div>
          <button
            onClick={() => void startMapping()}
            disabled={isMapping}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-terra px-4 py-2.5 text-sm font-semibold text-white hover:bg-terra-dark disabled:opacity-60"
          >
            {isMapping ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Map with AI Agent
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="text-xs font-semibold text-warm-600">
            GitHub repo URL
            <input
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/org/repo"
              className="mt-1 w-full rounded-2xl border border-sand/80 bg-white/82 px-3 py-2 text-sm text-warm-800 placeholder:text-cloudy focus:border-terra/40 focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-warm-600">
            GitHub token (optional for private repo)
            <input
              value={githubToken}
              onChange={(event) => setGithubToken(event.target.value)}
              placeholder="ghp_xxx"
              className="mt-1 w-full rounded-2xl border border-sand/80 bg-white/82 px-3 py-2 text-sm text-warm-800 placeholder:text-cloudy focus:border-terra/40 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-sand/80 bg-white/80 px-3 py-2 text-xs font-semibold text-warm-700">
            <Upload size={13} />
            Upload .zip
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setArchiveFile(file || null)
              }}
            />
          </label>
          {archiveFile && <span className="text-xs text-warm-500">{archiveFile.name}</span>}
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold text-warm-600">Focus areas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VISUALIZER_FOCUS_AREAS.map((area) => {
              const active = focusAreas.includes(area.id)
              return (
                <button
                  key={area.id}
                  onClick={() => toggleFocusArea(area.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                    active
                      ? "border-terra/35 bg-terra/10 text-terra"
                      : "border-sand/80 bg-white/78 text-warm-600 hover:border-terra/30"
                  )}
                  title={area.description}
                >
                  {area.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-sand/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,236,224,0.9))] p-3">
          <div className="flex items-center justify-between text-[11px] text-warm-500">
            <span>Agent progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-terra via-accent to-soft-blue transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div ref={logRef} className="mt-2 max-h-28 overflow-auto rounded-2xl border border-sand/75 bg-white/80 p-2 text-[11px] text-warm-500">
            {logs.length === 0 ? (
              <p>Waiting for mapper execution...</p>
            ) : (
              logs.map((log, index) => <p key={`${log}-${index}`}>• {log}</p>)
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-soft-red/40 bg-soft-red/10 p-3 text-xs text-soft-red">
            {error}
          </div>
        )}
      </div>

      {mapping && activeDiagram && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="surface-card p-4 text-warm-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cloudy">{mapping.summary.repoName}</p>
                <h2 className="text-lg font-semibold text-warm-800">{activeDiagram.title}</h2>
                <p className="text-xs text-warm-500">{activeDiagram.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setViewMode("graph")}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
                    viewMode === "graph" ? "border-terra/35 bg-terra/10 text-terra" : "border-sand/80 bg-white/75 text-warm-600"
                  )}
                >
                  Graph
                </button>
                <button
                  onClick={() => setViewMode("mermaid")}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
                    viewMode === "mermaid" ? "border-terra/35 bg-terra/10 text-terra" : "border-sand/80 bg-white/75 text-warm-600"
                  )}
                >
                  Mermaid
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mapping.diagrams.map((diagram) => (
                <button
                  key={diagram.id}
                  onClick={() => {
                    setActiveDiagramId(diagram.id)
                    setSelectedNodeId("")
                    setSearchTerm("")
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
                    activeDiagramId === diagram.id
                      ? "border-terra/35 bg-terra/10 text-terra"
                      : "border-sand/80 bg-white/75 text-warm-600"
                  )}
                >
                  {diagram.title}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-warm-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search nodes"
                  className="rounded-xl border border-sand/80 bg-white/80 py-1.5 pl-7 pr-2 text-xs text-warm-800"
                />
              </div>
              <button
                onClick={() => void improveCurrentDiagram()}
                disabled={improveLoading}
                className="inline-flex items-center gap-1 rounded-xl border border-sand/80 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-warm-700 hover:border-terra/30"
              >
                {improveLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                Improve this diagram
              </button>
              <button onClick={() => exportRaw("mermaid")} className="inline-flex items-center gap-1 rounded-xl border border-sand/80 bg-white/80 px-2.5 py-1.5 text-[11px] text-warm-700">
                <FileCode2 size={12} /> Mermaid
              </button>
              <button onClick={() => exportRaw("json")} className="inline-flex items-center gap-1 rounded-xl border border-sand/80 bg-white/80 px-2.5 py-1.5 text-[11px] text-warm-700">
                <Download size={12} /> JSON
              </button>
              <button onClick={() => void exportAs("png")} className="inline-flex items-center gap-1 rounded-xl border border-sand/80 bg-white/80 px-2.5 py-1.5 text-[11px] text-warm-700">PNG</button>
              <button onClick={() => void exportAs("svg")} className="inline-flex items-center gap-1 rounded-xl border border-sand/80 bg-white/80 px-2.5 py-1.5 text-[11px] text-warm-700">SVG</button>
              <button onClick={() => void exportAs("pdf")} className="inline-flex items-center gap-1 rounded-xl border border-sand/80 bg-white/80 px-2.5 py-1.5 text-[11px] text-warm-700">PDF</button>
              <button onClick={() => void copyEmbedLink()} className="inline-flex items-center gap-1 rounded-xl border border-sand/80 bg-white/80 px-2.5 py-1.5 text-[11px] text-warm-700">Copy embed link</button>
            </div>

            <div ref={diagramRef} className="mt-3 h-[620px] overflow-hidden rounded-[24px] border border-sand/75 bg-[linear-gradient(180deg,rgba(255,250,242,0.98),rgba(243,235,224,0.96))]">
              {viewMode === "graph" ? (
                <ReactFlow
                  nodes={visibleNodes}
                  edges={visibleEdges}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  fitView
                  proOptions={{ hideAttribution: true }}
                  nodeTypes={nodeTypes}
                  className="!bg-[#fbf5ea]"
                >
                  <MiniMap className="!bg-[#f2eadf]" />
                  <Controls className="!bg-[#fffaf2]" />
                  <Background color="#c7b595" gap={24} />
                </ReactFlow>
              ) : (
                <div className="h-full overflow-auto p-2">
                  <MermaidRender code={activeDiagram.mermaid} />
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {activeDiagram.insights.map((insight) => (
                <div key={insight} className="rounded-[18px] border border-sand/75 bg-white/80 p-2 text-[11px] text-warm-600">
                  {insight}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface-card p-4 text-warm-800">
              <h3 className="text-sm font-semibold text-warm-800">Node Inspector</h3>
              {!selectedNode ? (
                <p className="mt-2 text-xs text-warm-500">Click any node to inspect snippet + AI insight.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-sm font-semibold text-warm-800">{selectedNode.data.label}</p>
                  <p className="text-xs text-warm-600">{selectedNode.data.insight}</p>
                  {selectedNode.data.filePath && (
                    <p className="rounded-xl bg-cream px-2 py-1 text-[11px] text-terra">
                      {selectedNode.data.filePath}
                    </p>
                  )}
                  {selectedNode.data.snippet && (
                    <pre className="max-h-52 overflow-auto rounded-2xl border border-sand/75 bg-[#f9f2e7] p-2 text-[10px] text-warm-700">
                      {selectedNode.data.snippet}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="surface-card p-4 text-warm-800">
              <div className="flex items-center gap-2">
                <Bot size={14} className="text-terra" />
                <h3 className="text-sm font-semibold text-warm-800">Ask the Mapper</h3>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto rounded-2xl border border-sand/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,236,224,0.9))] p-2">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-warm-500">
                    Ask: &ldquo;focus on payment flow&rdquo;, &ldquo;show agent bottlenecks&rdquo;, or &ldquo;highlight security boundaries&rdquo;.
                  </p>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={cn(
                        "rounded-lg p-2 text-xs",
                        message.role === "user"
                          ? "bg-terra/10 text-terra"
                          : "bg-white/82 text-warm-700"
                      )}
                    >
                      <p className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-cloudy">
                        {message.role === "user" ? "You" : "Mapper"}
                      </p>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && !chatLoading && void askMapper()}
                  placeholder="Ask the mapper"
                  className="flex-1 rounded-2xl border border-sand/80 bg-white/80 px-3 py-2 text-xs text-warm-800"
                />
                <button
                  onClick={() => void askMapper()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-terra px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {chatLoading ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                  Ask
                </button>
              </div>
            </div>

            <div className="surface-card p-4 text-[11px] text-warm-600">
              <p className="font-semibold text-warm-800">Session metadata</p>
              <p className="mt-1">Commit: {mapping.summary.commitSha}</p>
              <p>Files analyzed: {mapping.summary.fileCount}</p>
              <p>Cost estimate: ${mapping.cost.estimatedUsd.toFixed(4)}</p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-sand/80 bg-white/80 px-2 py-1 text-[10px] text-warm-700">
                <GitBranch size={10} />
                Cache {mapping.cacheHit ? "hit" : "miss"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
