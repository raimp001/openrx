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
  const clamped = Math.max(0, Math.min(100, score))
  const filled = (clamped / 100) * circ
  const color = clamped >= 80 ? "#10B981" : clamped >= 60 ? "#F59E0B" : "#EF4444"
  const label = clamped >= 80 ? "Good" : clamped >= 60 ? "Fair" : "Needs attention"
  const trackColor = "rgba(0,0,0,0.06)"
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Health score: ${clamped} out of 100. ${label}.`}
    >
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
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-teal shadow-glow-teal">
          <Heart size={32} className="text-white" strokeWidth={1.5} />
        </div>
        <h1 className="font-serif text-display-lg text-primary italic">
          Your health, one place.
        </h1>
        <p className="mt-4 max-w-sm text-base text-secondary leading-relaxed">
          Connect your wallet to unlock your personalized care dashboard powered by 12 AI agents.
        </p>
        <div className="mt-8">
          <Wallet>
            <ConnectWallet className="ock-wallet-connect-primary px-8 py-3.5 text-[15px]">
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
          {[
            { href: "/onboarding", icon: Heart, color: "from-teal-50 to-teal-100", iconColor: "text-teal", title: "Complete your profile", desc: "A 2-minute guided chat to set up your care team." },
            { href: "/providers", icon: Search, color: "from-violet-50 to-violet-50/50", iconColor: "text-violet", title: "Find a provider", desc: "Search for doctors, specialists, and care centers nearby." },
            { href: "/chat", icon: Bot, color: "from-teal-50 to-blue-50/50", iconColor: "text-teal-dark", title: "Ask the AI concierge", desc: "Get answers about care, coverage, or next steps." },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="surface-card-interactive p-6 group">
              <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}>
                <item.icon size={18} className={item.iconColor} strokeWidth={1.5} />
              </div>
              <p className="text-[15px] font-semibold text-primary group-hover:text-teal transition">{item.title}</p>
              <p className="mt-1 text-sm text-secondary">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-teal/20 border-t-teal animate-spin" />
          <p className="mt-4 text-sm text-muted">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-hero-fade space-y-5">
      {/* Greeting */}
      <div className="pb-1">
        <h1 className="text-2xl font-semibold text-primary tracking-tight">
          {firstName ? `Hi, ${firstName}` : "Dashboard"}
        </h1>
        <p className="mt-0.5 text-sm text-muted">Here&apos;s what needs your attention.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Medications", value: String(myRx.length), icon: Pill, color: "text-teal" },
          { label: "Adherence", value: `${avgAdherence}%`, icon: Activity, color: avgAdherence >= 80 ? "text-accent" : "text-amber-600" },
          { label: "Due vaccines", value: String(dueVaccines.length), icon: Syringe, color: dueVaccines.length > 0 ? "text-amber-600" : "text-accent" },
          { label: "Open claims", value: String(deniedClaims.length), icon: Receipt, color: deniedClaims.length > 0 ? "text-soft-red" : "text-accent" },
        ].map((stat) => (
          <div key={stat.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <stat.icon size={14} className="text-muted" strokeWidth={1.5} />
              <span className={cn("text-lg font-bold tabular-nums", stat.color)}>{stat.value}</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-muted uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Next Action */}
        <div className="surface-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40">
            <p className="section-title">Priority action</p>
          </div>
          <div className="p-6">
            {nextAction ? (
              <Link href={nextAction.href} className="group flex items-center gap-4">
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  nextAction.color === "text-soft-red" ? "bg-red-50" :
                  nextAction.color === "text-amber-600" ? "bg-amber-50" : "bg-teal-50"
                )}>
                  <nextAction.icon size={20} className={nextAction.color} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-primary">{nextAction.label}</p>
                  <p className="mt-0.5 text-sm text-secondary">{nextAction.detail}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface group-hover:bg-teal-50 transition">
                  <ChevronRight size={16} className="text-muted group-hover:text-teal transition" />
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <CheckCircle2 size={20} className="text-accent" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-primary">You&apos;re all caught up</p>
                  <p className="text-sm text-secondary">No urgent items right now.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Health Summary */}
        <div className="surface-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40">
            <p className="section-title">Health score</p>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <HealthRing score={healthScore} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-xl font-bold tabular-nums",
                    healthScore >= 80 ? "text-accent" : healthScore >= 60 ? "text-amber-600" : "text-soft-red"
                  )}>{healthScore}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-secondary">Adherence</span>
                  <span className="font-semibold text-primary tabular-nums">{avgAdherence}%</span>
                </div>
                {latestVital?.systolic && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">BP</span>
                    <span className="font-semibold text-primary">{latestVital.systolic}/{latestVital.diastolic}</span>
                  </div>
                )}
                {latestVital?.heart_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">HR</span>
                    <span className="font-semibold text-primary">{latestVital.heart_rate} bpm</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <p className="section-title">Recent activity</p>
          <Link href="/timeline" className="text-xs font-semibold text-teal transition hover:text-teal-dark flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        {recentActivity.length > 0 ? (
          <div className="divide-y divide-border/30">
            {recentActivity.map((item, i) => (
              <Link key={i} href={item.href} className="flex items-center gap-3 px-6 py-4 transition hover:bg-teal-50/30 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface group-hover:bg-white transition">
                  <item.icon size={14} className="text-muted" strokeWidth={1.5} />
                </div>
                <span className="flex-1 text-sm font-medium text-primary">{item.label}</span>
                <span className="text-[11px] text-muted font-mono tabular-nums">{formatRelative(item.time)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface mb-3">
              <Clock size={20} className="text-muted" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-secondary">No recent activity yet</p>
            <p className="mt-1 text-xs text-muted">Care team updates will appear here.</p>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/scheduling", icon: Calendar, label: "Scheduling", color: "text-violet" },
          { href: "/prescriptions", icon: Pill, label: "Prescriptions", color: "text-teal" },
          { href: "/lab-results", icon: FlaskConical, label: "Lab Results", color: "text-soft-blue" },
          { href: "/chat", icon: Bot, label: "AI Concierge", color: "text-teal-dark" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="surface-card-interactive flex items-center gap-3 p-4 group"
          >
            <link.icon size={16} className={cn(link.color, "shrink-0")} strokeWidth={1.5} />
            <span className="text-sm font-medium text-primary group-hover:text-teal transition">{link.label}</span>
            <ArrowRight size={12} className="ml-auto text-muted group-hover:text-teal transition" />
          </Link>
        ))}
      </div>
    </div>
  )
}
