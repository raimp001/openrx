"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  Globe,
  Loader2,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldCheck,
  Siren,
  Volume2,
  VolumeX,
  Workflow,
} from "lucide-react"
import { cn } from "@/lib/utils"
import ResizableSplit from "@/components/care-team/resizable-split"
import RequestReviewModal from "@/components/care-team/request-review-modal"
import { useCareTeamCommandCenter } from "@/lib/hooks/use-care-team-command-center"
import { useCareTeamSession } from "@/lib/hooks/use-care-team-session"
import type { CareTeamHumanInputRequest } from "@/lib/care-team/types"

interface ActivityEntry {
  id: string
  type: "needs_input" | "status"
  title: string
  detail: string
  timestamp: string
}

const ORDER_STORAGE_KEY = "openrx:care-team-agent-order:v1"

function shortHash(hash: string): string {
  if (!hash) return "unknown"
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

function readSavedOrder(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSavedOrder(order: string[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order))
}

function agentInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function playSoftChime() {
  if (typeof window === "undefined") return
  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return

  const ctx = new AudioContextCtor()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = "sine"
  osc.frequency.value = 880
  gain.gain.value = 0.0001

  osc.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)

  osc.start(now)
  osc.stop(now + 0.28)

  setTimeout(() => {
    void ctx.close()
  }, 320)
}

export default function CareTeamCommandCenter() {
  const { session, loading: sessionLoading } = useCareTeamSession({ pollMs: 15000 })
  const {
    agents,
    openRequests,
    requestsByAgent,
    needsInputCount,
    loading,
    error,
    connected,
    resolveRequest,
    createCustomAgent,
    triggerDemo,
    refresh,
  } = useCareTeamCommandCenter()

  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [showBrowser, setShowBrowser] = useState(true)
  const [showGuide, setShowGuide] = useState(true)
  const [viewerTab, setViewerTab] = useState<"patient" | "claim" | "record">("patient")
  const [reviewTarget, setReviewTarget] = useState<CareTeamHumanInputRequest | null>(null)
  const [submittingDecision, setSubmittingDecision] = useState(false)
  const [actionError, setActionError] = useState("")
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [demoRunning, setDemoRunning] = useState(false)

  const previousNeedsInputRef = useRef(0)

  useEffect(() => {
    if (!soundEnabled) {
      previousNeedsInputRef.current = needsInputCount
      return
    }
    if (needsInputCount > previousNeedsInputRef.current) {
      playSoftChime()
    }
    previousNeedsInputRef.current = needsInputCount
  }, [needsInputCount, soundEnabled])

  useEffect(() => {
    if (agents.length === 0) return
    const saved = readSavedOrder()
    setOrderedIds(saved)
  }, [agents.length])

  const orderedAgents = useMemo(() => {
    const orderMap = new Map<string, number>()
    orderedIds.forEach((id, index) => orderMap.set(id, index))

    return [...agents].sort((a, b) => {
      const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER
      const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER
      if (ia !== ib) return ia - ib
      return a.name.localeCompare(b.name)
    })
  }, [agents, orderedIds])

  useEffect(() => {
    if (!selectedAgentId && orderedAgents.length > 0) {
      setSelectedAgentId(orderedAgents[0].id)
    }

    if (selectedAgentId && !orderedAgents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(orderedAgents[0]?.id || "")
    }
  }, [orderedAgents, selectedAgentId])

  const selectedAgent = useMemo(
    () => orderedAgents.find((agent) => agent.id === selectedAgentId) || null,
    [orderedAgents, selectedAgentId]
  )

  const selectedAgentRequests = useMemo(
    () => (selectedAgent ? requestsByAgent[selectedAgent.id] || [] : []),
    [requestsByAgent, selectedAgent]
  )

  const activeRequest = selectedAgentRequests[0] || null

  const activityFeed = useMemo(() => {
    const systemEntries: ActivityEntry[] = openRequests
      .slice(0, 10)
      .map((request) => ({
        id: request.id,
        type: "needs_input" as const,
        title: `${request.agentName} requested human input`,
        detail: `${request.context.workflow.toUpperCase()} · ${request.context.reason}`,
        timestamp: request.createdAt,
      }))

    if (selectedAgent) {
      systemEntries.unshift({
        id: `status-${selectedAgent.id}`,
        type: "status" as const,
        title:
          selectedAgent.status === "needs_input"
            ? `${selectedAgent.name} is waiting on human decision`
            : selectedAgent.status === "paused"
            ? `${selectedAgent.name} is paused`
            : `${selectedAgent.name} is running`,
        detail: `Role: ${selectedAgent.role}`,
        timestamp: selectedAgent.updatedAt,
      })
    }

    return systemEntries.slice(0, 14)
  }, [openRequests, selectedAgent])

  function reorderAgents(overId: string) {
    if (!draggingId || draggingId === overId) return
    const currentIds = orderedAgents.map((agent) => agent.id)
    const fromIndex = currentIds.indexOf(draggingId)
    const toIndex = currentIds.indexOf(overId)
    if (fromIndex === -1 || toIndex === -1) return

    const next = [...currentIds]
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, draggingId)
    setOrderedIds(next)
    writeSavedOrder(next)
  }

  async function handleModalSubmit(payload: {
    requestId: string
    decision: "approve" | "reject" | "edit"
    note?: string
    editedSuggestedAction?: string
    browserUrl?: string
  }) {
    setSubmittingDecision(true)
    setActionError("")
    try {
      await resolveRequest(payload)
      setReviewTarget(null)
    } catch (issue) {
      setActionError(issue instanceof Error ? issue.message : "Failed to process decision.")
    } finally {
      setSubmittingDecision(false)
    }
  }

  async function quickDecision(request: CareTeamHumanInputRequest, decision: "approve" | "reject") {
    setActionError("")
    try {
      await resolveRequest({
        requestId: request.id,
        decision,
      })
    } catch (issue) {
      setActionError(issue instanceof Error ? issue.message : "Failed to process quick action.")
    }
  }

  async function handleCreateCustomAgent() {
    const name = window.prompt("Custom agent name")
    if (!name?.trim()) return
    const role = window.prompt("Custom agent role", "Specialist")
    if (!role?.trim()) return

    setCreatingAgent(true)
    try {
      await createCustomAgent({ name: name.trim(), role: role.trim() })
    } catch (issue) {
      setActionError(issue instanceof Error ? issue.message : "Failed to create custom agent.")
    } finally {
      setCreatingAgent(false)
    }
  }

  async function handleDemoRun() {
    setDemoRunning(true)
    setActionError("")
    try {
      await triggerDemo()
      const timer = window.setTimeout(() => {
        setDemoRunning(false)
      }, 60000)
      window.setTimeout(() => window.clearTimeout(timer), 61000)
    } catch (issue) {
      setActionError(issue instanceof Error ? issue.message : "Failed to run demo.")
      setDemoRunning(false)
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="surface-card p-8 text-center">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-terra" />
        <p className="text-sm text-warm-600">Loading AI Care Team Command Center…</p>
      </div>
    )
  }

  if (!session?.canAccessCareTeam) {
    return (
      <div className="surface-card p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-5 w-5 text-soft-blue" />
        <p className="text-sm font-semibold text-warm-800">Care Team access is restricted to clinic operators.</p>
        <p className="mt-1 text-xs text-warm-500">
          Ask your clinic admin to grant staff/admin access before using this dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showGuide && (
        <div className="rounded-xl border border-soft-blue/35 bg-soft-blue/10 px-3 py-2 text-xs text-blue-100">
          <div className="flex items-start justify-between gap-3">
            <p>
              Supervise your AI care team like a terminal. <span className="font-semibold">Blue glow = your attention needed.</span>
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="shrink-0 rounded-md border border-soft-blue/35 px-2 py-0.5 text-[11px] hover:bg-soft-blue/15"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="surface-card overflow-hidden border-[#1a3857] bg-[#071222] text-blue-50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#244463] px-4 py-3">
          <div>
            <h2 className="text-lg text-blue-50">AI Care Team Command Center</h2>
            <p className="text-xs text-blue-200/80">
              Supervise OpenClaw agents in real time. Blue glow means a human decision is required.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((value) => !value)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#295176] bg-[#0b1b31] px-3 py-1.5 text-xs font-semibold text-blue-100 hover:border-soft-blue"
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />} Chime
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#295176] bg-[#0b1b31] px-3 py-1.5 text-xs font-semibold text-blue-100 hover:border-soft-blue"
            >
              <Workflow size={13} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleDemoRun()}
              disabled={demoRunning}
              className="inline-flex items-center gap-2 rounded-lg border border-soft-blue/40 bg-soft-blue/15 px-3 py-1.5 text-xs font-semibold text-blue-100 hover:bg-soft-blue/25 disabled:opacity-50"
            >
              <Siren size={13} /> {demoRunning ? "Demo running" : "Run 60s demo"}
            </button>
          </div>
        </div>

        <div className="h-[74vh] min-h-[680px]">
          <div className="grid h-full min-h-0 grid-cols-[280px_1fr]">
            <aside className="flex min-h-0 flex-col border-r border-[#244463] bg-[#06101d]">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">AI Specialists</p>
                <button
                  type="button"
                  onClick={() => void handleCreateCustomAgent()}
                  disabled={creatingAgent}
                  className="rounded-md border border-[#2a5579] p-1 text-blue-100 hover:border-soft-blue disabled:opacity-50"
                  aria-label="Add custom agent"
                >
                  {creatingAgent ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
                {orderedAgents.map((agent) => {
                  const needsInput = agent.status === "needs_input"
                  const isActive = selectedAgentId === agent.id
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      draggable
                      onDragStart={() => setDraggingId(agent.id)}
                      onDragOver={(event) => {
                        event.preventDefault()
                        reorderAgents(agent.id)
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => {
                        setSelectedAgentId(agent.id)
                        if (needsInput && requestsByAgent[agent.id]?.[0]) {
                          setReviewTarget(requestsByAgent[agent.id][0])
                        }
                      }}
                      className={cn(
                        "relative w-full rounded-xl border px-2.5 py-2 text-left transition",
                        isActive
                          ? "border-soft-blue/55 bg-[#0c1f35]"
                          : "border-[#1f3e5b] bg-[#081626] hover:border-[#35668f]",
                        needsInput && "care-team-needs-input"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full border border-soft-blue/40 bg-[#0f2740] text-[10px] font-bold text-soft-blue">
                          {agentInitials(agent.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-blue-50">{agent.name}</p>
                          <p className="truncate text-[10px] text-blue-200/70">{agent.role}</p>
                        </div>
                        {agent.unreadCount > 0 && (
                          <span className="rounded-full bg-soft-blue px-1.5 py-0.5 text-[9px] font-bold text-[#06101d]">
                            {agent.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center justify-between">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                            agent.status === "running" && "bg-accent/20 text-accent",
                            agent.status === "paused" && "bg-yellow-500/20 text-yellow-300",
                            agent.status === "needs_input" && "bg-soft-blue/20 text-soft-blue"
                          )}
                        >
                          {agent.status === "running" ? "running" : agent.status === "paused" ? "paused" : "needs input"}
                        </span>
                        <ChevronRight size={12} className="text-blue-200/60" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="min-h-0 min-w-0">
              <ResizableSplit
                orientation="horizontal"
                initialPercent={48}
                minPercent={30}
                maxPercent={70}
                first={
                  <div className="flex h-full min-h-0 flex-col bg-[#081626]">
                    <div className="flex items-center justify-between border-b border-[#224261] px-4 py-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Agent Log / Chat</p>
                        <p className="mt-1 text-sm font-semibold text-blue-50">
                          {selectedAgent ? `${selectedAgent.name} · ${selectedAgent.role}` : "Select an agent"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-blue-200/70">
                        {connected ? <PlayCircle size={13} className="text-accent" /> : <PauseCircle size={13} className="text-yellow-300" />}
                        {connected ? "Realtime" : "Polling fallback"}
                      </div>
                    </div>

                    {activeRequest && (
                      <div className="border-b border-red-400/30 bg-red-500/15 px-4 py-3 text-red-100 care-team-banner-pulse">
                        <p className="text-xs font-bold uppercase tracking-[0.14em]">AI Agent Needs Your Input</p>
                        <p className="mt-1 text-sm">
                          Review for Patient {shortHash(activeRequest.context.patientIdHash)} · {activeRequest.context.workflow.toUpperCase()} · {activeRequest.agentName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void quickDecision(activeRequest, "approve")}
                            className="rounded-md border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void quickDecision(activeRequest, "reject")}
                            className="rounded-md border border-red-300/40 bg-red-500/20 px-2.5 py-1 text-[11px] font-semibold text-red-100"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewTarget(activeRequest)}
                            className="rounded-md border border-soft-blue/50 bg-soft-blue/20 px-2.5 py-1 text-[11px] font-semibold text-blue-100"
                          >
                            Open Full Context
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", selectedAgent?.status === "needs_input" && "care-team-pane-needs-input")}>
                      {activityFeed.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-blue-200/70">
                          Waiting for agent activity...
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activityFeed.map((entry) => (
                            <article
                              key={entry.id}
                              className={cn(
                                "rounded-xl border px-3 py-2",
                                entry.type === "needs_input"
                                  ? "border-soft-blue/50 bg-soft-blue/10"
                                  : "border-[#224261] bg-[#0a1c30]"
                              )}
                            >
                              <p className="text-xs font-semibold text-blue-50">{entry.title}</p>
                              <p className="mt-1 text-[11px] text-blue-200/80">{entry.detail}</p>
                              <p className="mt-1 text-[10px] text-blue-200/60">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                }
                second={
                  <ResizableSplit
                    orientation="vertical"
                    initialPercent={58}
                    minPercent={35}
                    maxPercent={80}
                    first={
                      <div className={cn("flex h-full min-h-0 flex-col bg-[#071424]", selectedAgent?.status === "needs_input" && "care-team-pane-needs-input")}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#224261] px-4 py-3">
                          <div className="flex items-center gap-2">
                            {["patient", "claim", "record"].map((tab) => (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setViewerTab(tab as "patient" | "claim" | "record")}
                                className={cn(
                                  "rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase",
                                  viewerTab === tab
                                    ? "border-soft-blue/50 bg-soft-blue/20 text-blue-100"
                                    : "border-[#2a4d6d] bg-[#0a1d30] text-blue-200/70"
                                )}
                              >
                                {tab}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-blue-200/70">No PHI shown. References are hashed.</p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                          {!activeRequest ? (
                            <div className="flex h-full items-center justify-center text-sm text-blue-200/70">
                              No active request for this agent.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="rounded-xl border border-[#2a4f72] bg-[#0a1d30] p-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Patient Reference</p>
                                <p className="mt-1 text-sm text-blue-50">{shortHash(activeRequest.context.patientIdHash)}</p>
                              </div>
                              <div className="rounded-xl border border-[#2a4f72] bg-[#0a1d30] p-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Workflow</p>
                                <p className="mt-1 text-sm text-blue-50">{activeRequest.context.workflow.toUpperCase()}</p>
                              </div>
                              {activeRequest.context.claimIdHash && (
                                <div className="rounded-xl border border-[#2a4f72] bg-[#0a1d30] p-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Claim Ref</p>
                                  <p className="mt-1 text-sm text-blue-50">{shortHash(activeRequest.context.claimIdHash)}</p>
                                </div>
                              )}
                              {activeRequest.context.recordIdHash && (
                                <div className="rounded-xl border border-[#2a4f72] bg-[#0a1d30] p-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Record Ref</p>
                                  <p className="mt-1 text-sm text-blue-50">{shortHash(activeRequest.context.recordIdHash)}</p>
                                </div>
                              )}
                              <div className="rounded-xl border border-[#2a4f72] bg-[#0a1d30] p-3 md:col-span-2">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Reason</p>
                                <p className="mt-1 text-sm text-blue-50">{activeRequest.context.reason}</p>
                              </div>
                              <div className="rounded-xl border border-[#2a4f72] bg-[#0a1d30] p-3 md:col-span-2">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Suggested Resolution</p>
                                <p className="mt-1 text-sm text-blue-50">{activeRequest.context.suggestedAction}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                    second={
                      <div className={cn("flex h-full min-h-0 flex-col bg-[#06101d]", selectedAgent?.status === "needs_input" && "care-team-pane-needs-input")}
                      >
                        <div className="flex items-center justify-between border-b border-[#224261] px-4 py-2.5">
                          <div className="flex items-center gap-2 text-xs text-blue-200/80">
                            <Globe size={13} /> Embedded Browser
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowBrowser((value) => !value)}
                            className="rounded-md border border-[#2a5579] px-2 py-1 text-[11px] text-blue-100 hover:border-soft-blue"
                          >
                            {showBrowser ? "Hide" : "Show"}
                          </button>
                        </div>

                        <div className="min-h-0 flex-1 p-2">
                          {showBrowser && activeRequest?.context.browser?.url ? (
                            <div className="h-full overflow-hidden rounded-lg border border-[#2a5579] bg-[#0a1d30]">
                              <div className="flex items-center justify-between border-b border-[#2a5579] px-2 py-1.5 text-[10px] text-blue-200/70">
                                <span className="truncate">{activeRequest.context.browser.url}</span>
                                <span className="inline-flex items-center gap-1">
                                  <Monitor size={11} /> sandboxed
                                </span>
                              </div>
                              <iframe
                                title="Care Team Browser"
                                src={activeRequest.context.browser.url}
                                sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                                referrerPolicy="no-referrer"
                                className="h-[calc(100%-29px)] w-full"
                              />
                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[#2a5579] text-xs text-blue-200/70">
                              Browser pane is ready. Agents can attach portal URLs for rapid review.
                            </div>
                          )}
                        </div>
                      </div>
                    }
                  />
                }
              />
            </section>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[#2a5579] bg-[#071222] px-3 py-2 text-xs text-blue-200/80">
          <p className="font-semibold text-blue-100">Connection</p>
          <p className="mt-1 inline-flex items-center gap-2">
            {connected ? <Bot size={12} className="text-accent" /> : <AlertTriangle size={12} className="text-yellow-300" />}
            {connected ? "Realtime feed active" : "Realtime unavailable, fallback polling active"}
          </p>
        </div>
        <div className="rounded-xl border border-[#2a5579] bg-[#071222] px-3 py-2 text-xs text-blue-200/80">
          <p className="font-semibold text-blue-100">Pending Human Reviews</p>
          <p className="mt-1 text-lg font-bold text-soft-blue">{needsInputCount}</p>
        </div>
        <div className="rounded-xl border border-[#2a5579] bg-[#071222] px-3 py-2 text-xs text-blue-200/80">
          <p className="font-semibold text-blue-100">Operator Guide</p>
          <p className="mt-1">Blue glow = needs input. Use Approve / Reject / Edit to resume paused workflows.</p>
        </div>
      </div>

      {(error || actionError) && (
        <div className="rounded-xl border border-soft-red/35 bg-soft-red/10 px-3 py-2 text-xs text-red-100">
          {error || actionError}
        </div>
      )}

      <RequestReviewModal
        open={!!reviewTarget}
        request={reviewTarget}
        submitting={submittingDecision}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleModalSubmit}
      />
    </div>
  )
}
