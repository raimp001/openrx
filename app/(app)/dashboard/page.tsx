"use client"

import {
  Calendar, Pill, CheckCircle2, Heart, Search,
  FlaskConical, Receipt, Syringe, Activity,
  ArrowRight, ChevronRight, Clock, Bot,
} from "lucide-react"
import Link from "next/link"
import { cn, formatTime, formatDate } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useWalletIdentity } from "@/lib/wallet-context"
import { useMemo } from "react"
import {
  ConnectWallet,
  Wallet,
} from "@coinbase/onchainkit/wallet"

function HealthRing({ score, size = 72 }: { score: number; size?: number }) {
  const strokeW = 6
  const r = (size - strokeW) / 2
  const circ = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(1, score / 100)) * circ
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444"
  const trackColor = "rgba(0,0,0,0.06)"
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeW} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeW} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  )
}

export default function DashboardPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const { isConnected, profile } = useWalletIdentity()
  const patientName = isConnected ? (profile?.fullName || snapshot.patient?.full_name || "") : ""
  const firstName = patientName.split(" ")[0]
  const hasData = isConnected && !!snapshot.patient

  const myRx = snapshot.prescriptions.filter((p) => p.status === "active")
  const avgAdherence = myRx.length > 0
    ? Math.round(myRx.reduce((s, rx) => s + rx.adherence_pct, 0) / myRx.length)
    : 100

  const upcomingApts = useMemo(() =>
    [...snapshot.appointments]
      .filter((a) => new Date(a.scheduled_at) >= new Date() && a.status !== "completed")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [snapshot.appointments]
  )

  const abnormalLabCount = snapshot.labResults
    .filter((l) => l.status !== "pending")
    .reduce((count, lab) => count + lab.results.filter((r) => r.flag !== "normal").length, 0)

  const dueVaccines = snapshot.vaccinations.filter((v) => v.status === "due" || v.status === "overdue")
  const deniedClaims = snapshot.claims.filter((c) => c.status === "denied")
  const lowAdherenceRx = myRx.filter((p) => p.adherence_pct < 80)

  const healthScore = useMemo(() => {
    const deductions = (abnormalLabCount * 5) + (dueVaccines.filter(v => v.status === "overdue").length * 8) + (lowAdherenceRx.length * 10)
    return Math.max(0, Math.min(100, avgAdherence - deductions))
  }, [avgAdherence, abnormalLabCount, dueVaccines, lowAdherenceRx])

  const latestVital = snapshot.vitals[0]

  const nextAction = useMemo(() => {
    if (deniedClaims.length > 0) return { icon: Receipt, label: `Claim ${deniedClaims[0].claim_number} denied`, detail: "Appeal available", href: "/billing", color: "text-soft-red" }
    if (abnormalLabCount > 0) return { icon: FlaskConical, label: `${abnormalLabCount} abnormal lab result${abnormalLabCount > 1 ? "s" : ""}`, detail: "Review with your doctor", href: "/lab-results", color: "text-soft-red" }
    if (dueVaccines.filter(v => v.status === "overdue").length > 0) return { icon: Syringe, label: `${dueVaccines[0].vaccine_name} overdue`, detail: "Schedule this vaccination", href: "/vaccinations", color: "text-amber-600" }
    if (lowAdherenceRx.length > 0) return { icon: Pill, label: `${lowAdherenceRx[0].medication_name} adherence ${lowAdherenceRx[0].adherence_pct}%`, detail: "Set a reminder", href: "/prescriptions", color: "text-amber-600" }
    if (upcomingApts.length > 0) return { icon: Calendar, label: `${upcomingApts[0].reason || "Appointment"}`, detail: `${formatDate(upcomingApts[0].scheduled_at)} at ${formatTime(upcomingApts[0].scheduled_at)}`, href: "/scheduling", color: "text-teal" }
    return null
  }, [deniedClaims, abnormalLabCount, dueVaccines, lowAdherenceRx, upcomingApts])

  const recentActivity = useMemo(() => {
    const items: { icon: React.ElementType; label: string; time: string; href: string }[] = []
    for (const lab of snapshot.labResults.filter(l => l.status !== "pending").slice(0, 1)) {
      items.push({ icon: FlaskConical, label: `${lab.test_name} result ready`, time: lab.resulted_at || lab.ordered_at, href: "/lab-results" })
    }
    for (const apt of upcomingApts.slice(0, 1)) {
      items.push({ icon: Calendar, label: `${apt.reason || "Visit"} confirmed`, time: apt.scheduled_at, href: "/scheduling" })
    }
    for (const claim of deniedClaims.slice(0, 1)) {
      items.push({ icon: Receipt, label: `Claim denied — ${claim.claim_number}`, time: claim.submitted_at, href: "/billing" })
    }
    for (const v of dueVaccines.slice(0, 1)) {
      items.push({ icon: Syringe, label: `${v.vaccine_name} ${v.status}`, time: v.next_due || new Date().toISOString(), href: "/vaccinations" })
    }
    return items.slice(0, 4)
  }, [snapshot.labResults, upcomingApts, deniedClaims, dueVaccines])

  function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    if (!Number.isFinite(diff) || diff < 0) return "Upcoming"
    if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
    if (diff < 86400000) return `${Math.max(1, Math.round(diff / 3600000))}h ago`
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  // No wallet connected
  if (!loading && !isConnected && !hasData) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-hero-fade">
        <h1 className="font-serif text-display-lg text-primary italic">
          Your health, one place.
        </h1>
        <p className="mt-4 max-w-sm text-base text-secondary">
          Connect your wallet to unlock your personalized care dashboard.
        </p>
        <div className="mt-8">
          <Wallet>
            <ConnectWallet className="!rounded-button !bg-teal !px-8 !py-3.5 !text-[15px] !font-medium !text-white !transition hover:!bg-teal-dark">
              Connect Wallet
            </ConnectWallet>
          </Wallet>
        </div>
      </div>
    )
  }

  // Wallet connected but no patient data yet
  if (!loading && isConnected && !hasData) {
    return (
      <div className="animate-hero-fade space-y-6">
        <div className="pb-2">
          <h1 className="text-2xl font-semibold text-primary tracking-tight">
            {firstName ? `Welcome, ${firstName}` : "Welcome"}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Your wallet is connected. Complete your profile to populate your care dashboard.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/onboarding" className="surface-card p-6 transition hover:shadow-card-hover group">
            <Heart size={20} className="text-teal mb-3" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-primary group-hover:text-teal transition">Complete your profile</p>
            <p className="mt-1 text-sm text-secondary">A 2-minute guided chat to set up your care team.</p>
          </Link>
          <Link href="/providers" className="surface-card p-6 transition hover:shadow-card-hover group">
            <Search size={20} className="text-teal mb-3" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-primary group-hover:text-teal transition">Find a provider</p>
            <p className="mt-1 text-sm text-secondary">Search for doctors, specialists, and care centers nearby.</p>
          </Link>
          <Link href="/chat" className="surface-card p-6 transition hover:shadow-card-hover group">
            <Bot size={20} className="text-teal mb-3" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-primary group-hover:text-teal transition">Ask the AI concierge</p>
            <p className="mt-1 text-sm text-secondary">Get answers about care, coverage, or next steps.</p>
          </Link>
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-teal" />
          <p className="mt-4 text-sm text-muted">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-hero-fade space-y-4">
      {/* Greeting */}
      <div className="pb-2">
        <h1 className="text-2xl font-semibold text-primary tracking-tight">
          {firstName ? `Hi, ${firstName}` : "Dashboard"}
        </h1>
      </div>

      {/* 3-card grid */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Next Action */}
        <div className="surface-card p-6">
          <p className="section-title mb-4">Next action</p>
          {nextAction ? (
            <Link href={nextAction.href} className="group flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-surface">
                <nextAction.icon size={18} className={nextAction.color} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-primary">{nextAction.label}</p>
                <p className="mt-0.5 text-sm text-secondary">{nextAction.detail}</p>
              </div>
              <ChevronRight size={16} className="text-muted transition group-hover:text-teal" />
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-accent" />
              <div>
                <p className="text-[15px] font-medium text-primary">You&apos;re all caught up</p>
                <p className="text-sm text-secondary">No urgent items right now.</p>
              </div>
            </div>
          )}
        </div>

        {/* Health Summary */}
        <div className="surface-card p-6">
          <p className="section-title mb-4">Health score</p>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <HealthRing score={healthScore} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn(
                  "text-lg font-semibold",
                  healthScore >= 80 ? "text-accent" : healthScore >= 60 ? "text-amber-600" : "text-soft-red"
                )}>{healthScore}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-secondary">Adherence</span>
                <span className="font-medium text-primary tabular-nums">{avgAdherence}%</span>
              </div>
              {latestVital?.systolic && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">BP</span>
                  <span className="font-medium text-primary">{latestVital.systolic}/{latestVital.diastolic}</span>
                </div>
              )}
              {latestVital?.heart_rate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">HR</span>
                  <span className="font-medium text-primary">{latestVital.heart_rate} bpm</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="surface-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <p className="section-title">Recent activity</p>
          <Link href="/timeline" className="text-xs font-medium text-teal transition hover:text-teal-dark flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        {recentActivity.length > 0 ? (
          <div className="divide-y divide-border/40">
            {recentActivity.map((item, i) => (
              <Link key={i} href={item.href} className="flex items-center gap-3 px-6 py-3.5 transition hover:bg-surface">
                <item.icon size={15} className="text-muted shrink-0" strokeWidth={1.5} />
                <span className="flex-1 text-sm font-medium text-primary">{item.label}</span>
                <span className="text-xs text-muted font-mono">{formatRelative(item.time)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-secondary">No recent activity yet.</p>
            <p className="mt-1 text-xs text-muted">Care team updates will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
