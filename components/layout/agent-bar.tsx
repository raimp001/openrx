"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

interface ImprovementMetrics {
  totalSuggested: number
  totalDeployed: number
  totalInProgress: number
  totalApproved: number
}

export default function AgentBar() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")
  const [expanded, setExpanded] = useState(false)
  const [metrics, setMetrics] = useState<ImprovementMetrics | null>(null)
  const [inProgressTitle, setInProgressTitle] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/openclaw/status")
      .then((response) => response.json())
      .then((data) => setStatus(data.connected ? "online" : "offline"))
      .catch(() => setStatus("offline"))
  }, [])

  useEffect(() => {
    fetch("/api/openclaw/improvements?refresh=1")
      .then((response) => response.json())
      .then((data) => {
        setMetrics(data.metrics)
        const inProgress = (data.improvements ?? []).find(
          (improvement: { status: string; title: string }) => improvement.status === "in_progress"
        )
        setInProgressTitle(inProgress?.title ?? null)
      })
      .catch(() => {})
  }, [])

  const statusMeta =
    status === "online"
      ? { label: "Live agent mesh", icon: Wifi, tone: "text-accent" }
      : status === "offline"
      ? { label: "Gateway offline", icon: WifiOff, tone: "text-soft-red" }
      : { label: "Checking gateway", icon: Sparkles, tone: "text-yellow-600" }

  return (
    <div className="px-4 pt-4 sm:px-6 lg:px-8">
      <div className="app-shell-panel overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="eyebrow-pill">
              <Bot size={11} />
              Agent runtime
            </span>
            <span className={`metric-chip ${statusMeta.tone}`}>
              <statusMeta.icon size={12} />
              {statusMeta.label}
            </span>
            <span className="text-[11px] font-medium text-warm-500">
              {OPENCLAW_CONFIG.agents.length} specialists · {OPENCLAW_CONFIG.cronJobs.length} scheduled jobs
            </span>
          </div>

          <div className="flex items-center gap-2">
            {metrics?.totalDeployed ? (
              <span className="metric-chip text-accent">
                <TrendingUp size={12} />
                {metrics.totalDeployed} deployed
              </span>
            ) : null}

            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/90 px-3 py-2 text-[11px] font-semibold text-warm-700 transition hover:border-terra/24 hover:text-warm-900"
            >
              Open agent
            </Link>

            <button
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Collapse agent status" : "Expand agent status"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/[0.07] bg-white/90 text-warm-600 transition hover:text-warm-900"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {expanded ? (
          <div className="border-t border-sand/60 px-4 py-4 lg:px-5">
            <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="surface-muted p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warm-500">Active specialists</p>
                  <span className="text-[11px] font-semibold text-warm-600">Atlas routes the handoffs</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {OPENCLAW_CONFIG.agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-[20px] border border-sand/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,240,229,0.84))] px-3 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-terra/10 text-terra">
                          <Bot size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-warm-800">{agent.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-warm-500">{agent.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-muted p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warm-500">Improvement pipeline</p>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <MetricTile label="Suggested" value={metrics?.totalSuggested ?? 0} tone="text-warm-800" />
                    <MetricTile label="Approved" value={metrics?.totalApproved ?? 0} tone="text-accent" />
                    <MetricTile label="In progress" value={metrics?.totalInProgress ?? 0} tone="text-yellow-600" />
                    <MetricTile label="Deployed" value={metrics?.totalDeployed ?? 0} tone="text-terra" />
                  </div>

                  <div className="rounded-[20px] border border-sand/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,240,229,0.84))] px-3 py-3 text-sm text-warm-600">
                    <p className="font-semibold text-warm-800">Current focus</p>
                    <p className="mt-1 leading-6">
                      {inProgressTitle || "No active self-improvement task is being tracked right now."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="rounded-[20px] border border-sand/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,240,229,0.84))] px-3 py-3 shadow-sm">
      <p className={`text-xl font-semibold leading-none ${tone}`}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-warm-500">{label}</p>
    </div>
  )
}
