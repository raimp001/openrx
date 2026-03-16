"use client"

import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { Bot, Wifi, WifiOff, Zap, ChevronDown, ChevronUp, TrendingUp, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

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
  const [inProgressCount, setInProgressCount] = useState(0)
  const [approvedCount, setApprovedCount] = useState(0)
  const [inProgressTitle, setInProgressTitle] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/openclaw/status")
      .then((r) => r.json())
      .then((d) => setStatus(d.connected ? "online" : "offline"))
      .catch(() => setStatus("offline"))
  }, [])

  useEffect(() => {
    fetch("/api/openclaw/improvements?refresh=1")
      .then((r) => r.json())
      .then((d) => {
        setMetrics(d.metrics)
        setInProgressCount(d.metrics?.totalInProgress ?? 0)
        setApprovedCount(d.metrics?.totalApproved ?? 0)
        const inProg = (d.improvements ?? []).find((i: { status: string; title: string }) => i.status === "in_progress")
        setInProgressTitle(inProg?.title ?? null)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="border-b border-sand/70 bg-gradient-to-r from-pampas via-pampas to-cream/80 text-warm-700">
      <div className="flex h-10 items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-terra/20 bg-terra/10 px-2 py-0.5">
            <Bot size={11} className="text-terra" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-terra">OpenClaw</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-warm-500">
            {status === "online" ? (
              <Wifi size={10} className="text-accent" />
            ) : status === "offline" ? (
              <WifiOff size={10} className="text-terra" />
            ) : (
              <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
            )}
            <span className="font-medium">
              {status === "online" ? "Live agents" : status === "offline" ? "Gateway offline" : "Checking connection"}
            </span>
          </div>

          <div className="hidden items-center gap-2 text-[11px] text-cloudy lg:flex">
            <Zap size={10} className="text-yellow-600" />
            <span>{OPENCLAW_CONFIG.agents.length} agents active</span>
            <span>·</span>
            <span>{OPENCLAW_CONFIG.cronJobs.length} automations</span>
          </div>

        </div>

        <div className="flex items-center gap-2">
          {metrics && metrics.totalDeployed > 0 && (
            <div className="hidden items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent lg:flex">
              <TrendingUp size={9} />
              {metrics.totalDeployed} deployed
            </div>
          )}

          <Link href="/chat" className="text-[11px] font-semibold text-terra transition hover:text-terra-dark">
            Open agent
          </Link>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse agent panel" : "Expand agent panel"}
            className="rounded-md p-0.5 text-cloudy transition hover:bg-cream hover:text-warm-700"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sand/70 px-4 pb-3 lg:px-8 animate-fade-in">
          <div className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-9">
            {OPENCLAW_CONFIG.agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-sand/70 bg-pampas px-2 py-2 text-center transition hover:border-terra/25"
              >
                <div className="mx-auto mb-1 h-1.5 w-1.5 rounded-full bg-accent" />
                <p className="text-[11px] font-semibold text-warm-700">{agent.name}</p>
                <p className="text-[9px] text-cloudy">{agent.role}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-sand/70 bg-pampas p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cloudy">Agent Collaboration</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-warm-500">
                <span>{OPENCLAW_CONFIG.cronJobs.length} automations active</span>
                <span>{Object.values(OPENCLAW_CONFIG.channels).filter((c) => c.enabled).length} channels</span>
                <span>multi-agent routing enabled</span>
              </div>
              <p className="mt-1.5 text-[10px] text-cloudy">
                Atlas orchestrates cross-agent routing across {OPENCLAW_CONFIG.agents.length} specialist agents.
              </p>
            </div>

            <div className="rounded-xl border border-sand/70 bg-pampas p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cloudy">Self-Improvement Pipeline</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                {inProgressCount > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-yellow-600">
                    <Zap size={9} />
                    <span>{inProgressCount} in progress</span>
                  </div>
                )}
                {approvedCount > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-accent">
                    <CheckCircle2 size={9} />
                    <span>{approvedCount} approved</span>
                  </div>
                )}
                {metrics && (
                  <div className="flex items-center gap-1 text-[11px] text-cloudy">
                    <TrendingUp size={9} />
                    <span>{metrics.totalSuggested} total suggestions</span>
                  </div>
                )}
              </div>
              {inProgressTitle && (
                <p className="mt-1.5 truncate text-[10px] text-cloudy">Working on: {inProgressTitle}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
