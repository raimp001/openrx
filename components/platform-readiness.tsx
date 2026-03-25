"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, Loader2, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReadinessCheck {
  id: string
  title: string
  description: string
  status: "ready" | "attention"
  metric: string
  href: string
}

interface ReadinessPayload {
  generatedAt: string
  readinessScore: number
  checks: ReadinessCheck[]
  operations: {
    pendingApplications: number
    approvedApplications: number
    rejectedApplications: number
    unreadNotifications: number
    pendingVerification: number
    openRefunds: number
    verifiedVolume: string
    refundedVolume: string
  }
}

function defaultPayload(): ReadinessPayload {
  return {
    generatedAt: new Date(0).toISOString(),
    readinessScore: 0,
    checks: [],
    operations: {
      pendingApplications: 0,
      approvedApplications: 0,
      rejectedApplications: 0,
      unreadNotifications: 0,
      pendingVerification: 0,
      openRefunds: 0,
      verifiedVolume: "0.00",
      refundedVolume: "0.00",
    },
  }
}

export default function PlatformReadiness() {
  const [payload, setPayload] = useState<ReadinessPayload>(defaultPayload())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const readyCount = useMemo(
    () => payload.checks.filter((item) => item.status === "ready").length,
    [payload.checks]
  )

  async function load(isRefresh?: boolean) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/platform/readiness")
      const data = (await response.json()) as ReadinessPayload
      if (!response.ok) throw new Error("Failed to load readiness.")
      setPayload(data)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to load readiness.")
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-5 text-sm text-muted">
        <Loader2 size={14} className="animate-spin inline mr-2" />
        Loading readiness checks...
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-teal" />
            <h2 className="text-sm font-bold text-primary">Platform Readiness</h2>
          </div>
          <p className="text-xs text-muted mt-1">
            Coverage status across care search, onboarding, screening, and payment compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-bold px-3 py-1 rounded-full border",
              payload.readinessScore >= 90
                ? "bg-accent/10 border-accent/20 text-accent"
                : "bg-yellow-100/20 border-yellow-300/30 text-yellow-600"
            )}
          >
            Score {payload.readinessScore}%
          </span>
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-primary hover:border-teal/30 transition disabled:opacity-60"
          >
            {refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-soft-red/20 bg-soft-red/5 p-3 text-xs text-soft-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {payload.checks.map((check) => (
          <Link
            key={check.id}
            href={check.href}
            className="rounded-xl border border-border/70 bg-surface/30 p-3 hover:border-teal/25 transition"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">{check.title}</p>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                  check.status === "ready"
                    ? "bg-accent/10 text-accent"
                    : "bg-yellow-100/20 text-yellow-600"
                )}
              >
                {check.status}
              </span>
            </div>
            <p className="text-xs text-muted mt-1">{check.description}</p>
            <p className="text-[10px] font-semibold text-teal mt-2">{check.metric}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <OpsStat label="Pending Applications" value={String(payload.operations.pendingApplications)} />
        <OpsStat label="Unread Admin Alerts" value={String(payload.operations.unreadNotifications)} />
        <OpsStat label="Pending Verification" value={String(payload.operations.pendingVerification)} />
        <OpsStat label="Open Refunds" value={String(payload.operations.openRefunds)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 size={11} className="text-accent" />
          Ready checks: {readyCount}/{payload.checks.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldAlert size={11} className="text-teal" />
          Verified volume ${payload.operations.verifiedVolume}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 size={11} className="text-muted" />
          Updated {new Date(payload.generatedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}

function OpsStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface px-3 py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-sm font-semibold text-primary">{value}</p>
    </div>
  )
}
