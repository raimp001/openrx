"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Loader2,
  RefreshCcw,
  Sparkles,
  WalletCards,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { OpsBadge, OpsEmptyState } from "@/components/ui/ops-primitives"

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

function scoreLabel(score: number) {
  if (score >= 90) return "Demo ready"
  if (score >= 70) return "Needs review"
  return "Operational risk"
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
  const attentionCount = payload.checks.length - readyCount
  const generatedAt = payload.generatedAt && payload.generatedAt !== new Date(0).toISOString()
    ? new Date(payload.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "not loaded"

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
      <section className="surface-card overflow-hidden">
        <div className="flex items-center gap-3 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/80 text-teal">
            <Loader2 size={18} className="animate-spin" />
          </div>
          <div>
            <div className="section-title">Platform readiness</div>
            <p className="mt-1 text-sm text-secondary">Loading live production checks...</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="border-b border-[rgba(82,108,139,0.12)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] p-5 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-title text-white/55">Platform readiness</div>
              <div className="mt-4 flex items-end gap-3">
                <div className="text-5xl font-semibold tracking-[-0.06em]">{payload.readinessScore}%</div>
                <div className="pb-2 text-sm font-medium text-white/60">{scoreLabel(payload.readinessScore)}</div>
              </div>
            </div>
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/72 transition hover:bg-white/[0.1] disabled:opacity-60"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              Refresh
            </button>
          </div>

          <p className="mt-4 max-w-md text-sm leading-7 text-white/68">
            Live health across care search, onboarding, screening, payments, and database runtime. Check this before
            a demo or production walkthrough.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <ReadinessMiniStat label="Ready checks" value={`${readyCount}/${payload.checks.length}`} icon={CheckCircle2} />
            <ReadinessMiniStat label="Needs attention" value={String(attentionCount)} icon={AlertTriangle} />
            <ReadinessMiniStat label="Pending verify" value={String(payload.operations.pendingVerification)} icon={WalletCards} />
            <ReadinessMiniStat label="Updated" value={generatedAt} icon={Clock3} />
          </div>
        </div>

        <div className="p-5">
          {error ? (
            <div className="mb-4 rounded-[20px] border border-soft-red/20 bg-soft-red/5 p-4 text-sm leading-6 text-soft-red">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-teal" />
                <h2 className="text-lg font-semibold text-primary">Readiness lanes</h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-secondary">
                Click a lane to inspect the workflow behind the check.
              </p>
            </div>
            <OpsBadge tone={payload.readinessScore >= 90 ? "accent" : "gold"}>
              {payload.readinessScore >= 90 ? "ready" : "review"}
            </OpsBadge>
          </div>

          {payload.checks.length === 0 ? (
            <OpsEmptyState
              icon={Database}
              title="No readiness checks returned"
              description="The readiness endpoint responded, but it did not provide workflow checks."
              className="mt-5"
            />
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {payload.checks.map((check) => (
                <Link
                  key={check.id}
                  href={check.href}
                  className="group rounded-[22px] border border-[rgba(82,108,139,0.12)] bg-white/78 p-4 transition hover:-translate-y-0.5 hover:border-teal/18 hover:shadow-[0_16px_32px_rgba(8,24,46,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">{check.title}</p>
                      <p className="mt-2 text-xs leading-5 text-secondary">{check.description}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        check.status === "ready" ? "bg-accent/9 text-accent" : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {check.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[rgba(82,108,139,0.10)] pt-3">
                    <span className="text-[11px] font-semibold text-teal">{check.metric}</span>
                    <span className="text-[11px] font-medium text-muted transition group-hover:text-primary">Open lane</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            <OpsStat label="Applications" value={String(payload.operations.pendingApplications)} />
            <OpsStat label="Admin alerts" value={String(payload.operations.unreadNotifications)} />
            <OpsStat label="Open refunds" value={String(payload.operations.openRefunds)} />
            <OpsStat label="Verified $" value={payload.operations.verifiedVolume} />
          </div>
        </div>
      </div>
    </section>
  )
}

function ReadinessMiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof CheckCircle2
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3">
      <div className="flex items-center gap-2 text-white/55">
        <Icon size={13} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">{value}</p>
    </div>
  )
}

function OpsStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-[rgba(239,246,255,0.72)] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-primary">{value}</p>
    </div>
  )
}
