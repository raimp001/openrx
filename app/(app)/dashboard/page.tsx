"use client"

import {
  Calendar, Pill, CheckCircle2, Heart, Search,
  FlaskConical, Receipt, Syringe, Activity,
  ArrowRight, ChevronRight, Clock, Bot,
  Shield, Eye, AlertTriangle, Sparkles,
  FileText, MapPin, CircleDot,
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

/* ─── Health ring ─── */
function HealthRing({ score, size = 80 }: { score: number; size?: number }) {
  const strokeW = 5
  const r = (size - strokeW) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, score))
  const filled = (clamped / 100) * circ
  const color = clamped >= 80 ? "#10B981" : clamped >= 60 ? "#F59E0B" : "#EF4444"
  const label = clamped >= 80 ? "Good" : clamped >= 60 ? "Fair" : "Needs attention"
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Health score: ${clamped}. ${label}.`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth={strokeW} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  )
}

/* ─── Empty state hero for disconnected users ─── */
function DisconnectedHero() {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center text-center animate-hero-fade px-6">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-teal shadow-glow-teal">
        <Heart size={32} className="text-white" strokeWidth={1.5} />
      </div>
      <h1 className="font-serif text-display text-primary">
        Your care,{" "}
        <span className="italic text-gradient-teal">one place</span>
      </h1>
      <p className="mt-4 max-w-md text-body-lg text-secondary">
        Appointments, medications, labs, claims, and preventive screenings — coordinated by your AI care team.
      </p>
      <div className="mt-8">
        <Wallet>
          <ConnectWallet className="ock-wallet-connect-primary px-8 py-3.5 text-[15px]">
            Connect Wallet to Start
          </ConnectWallet>
        </Wallet>
      </div>
      <p className="mt-4 text-[12px] text-muted">
        Or <Link href="/onboarding" className="font-medium text-teal hover:underline">explore in demo mode</Link> — no setup required.
      </p>

      {/* Preview of what you get */}
      <div className="mt-16 w-full max-w-2xl">
        <p className="section-title mb-4">What you&apos;ll see here</p>
        <div className="grid gap-3 sm:grid-cols-3 text-left">
          {[
            { icon: CircleDot, label: "Next steps", desc: "Priority actions surfaced daily" },
            { icon: Eye, label: "Prevention", desc: "Screening reminders by age & risk" },
            { icon: Activity, label: "Care timeline", desc: "Labs, visits, claims in one view" },
          ].map((item) => (
            <div key={item.label} className="surface-card p-4">
              <item.icon size={16} className="text-teal mb-2" strokeWidth={1.5} />
              <p className="text-[13px] font-semibold text-primary">{item.label}</p>
              <p className="text-[12px] text-muted mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Empty state for new users ─── */
function NewUserOnboarding({ firstName }: { firstName: string }) {
  return (
    <div className="animate-hero-fade space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary tracking-tight">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="mt-1 text-[15px] text-secondary">
          Let&apos;s build your care profile. This takes about 2 minutes and unlocks your full dashboard.
        </p>
      </div>

      {/* Primary CTA */}
      <Link href="/onboarding" className="group surface-card-interactive block overflow-hidden">
        <div className="flex items-center gap-5 p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-teal shadow-glow-sm">
            <Heart size={24} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-semibold text-primary group-hover:text-teal transition">
              Complete your care profile
            </p>
            <p className="mt-0.5 text-sm text-secondary">
              Find your PCP, pharmacy, and medications in a guided 2-minute chat with Sage.
            </p>
          </div>
          <ArrowRight size={18} className="text-muted group-hover:text-teal transition" />
        </div>
        <div className="h-1 bg-gradient-to-r from-teal via-teal-light to-teal-50" />
      </Link>

      {/* Secondary options */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/providers",
            icon: Search,
            title: "Find a provider",
            desc: "Search 6M+ providers by specialty, location, or insurance.",
          },
          {
            href: "/chat",
            icon: Bot,
            title: "Ask the AI concierge",
            desc: "\"What screening am I due for?\" — Atlas can help even now.",
          },
          {
            href: "/screening",
            icon: Eye,
            title: "Run a preventive check",
            desc: "Enter age and sex to see which screenings you may need.",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="surface-card-interactive p-5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50/60 mb-3">
              <item.icon size={16} className="text-teal" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-primary group-hover:text-teal transition">{item.title}</p>
            <p className="mt-1 text-[13px] text-secondary leading-relaxed">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-3 rounded-xl bg-teal-50/30 border border-teal/[0.06] p-4">
        <Shield size={16} className="text-teal shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="text-[13px] font-medium text-primary">Your data stays with you</p>
          <p className="text-[12px] text-secondary mt-0.5">
            Profile data is stored locally until you choose to persist it. Nothing is shared with third parties.
            <Link href="/privacy-explained" className="text-teal font-medium ml-1 hover:underline">Learn more</Link>
          </p>
        </div>
      </div>
    </div>
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
  const overdueVaccines = dueVaccines.filter(v => v.status === "overdue")
  const deniedClaims = snapshot.claims.filter((c) => c.status === "denied")
  const lowAdherenceRx = myRx.filter((p) => p.adherence_pct < 80)

  const healthScore = useMemo(() => {
    if (myRx.length === 0 && abnormalLabCount === 0 && overdueVaccines.length === 0) return null
    const deductions = (abnormalLabCount * 5) + (overdueVaccines.length * 8) + (lowAdherenceRx.length * 10)
    return Math.max(0, Math.min(100, avgAdherence - deductions))
  }, [myRx.length, avgAdherence, abnormalLabCount, overdueVaccines, lowAdherenceRx])

  const latestVital = snapshot.vitals[0]

  // Build ordered action items (not just "next action" — show the full list)
  const actionItems = useMemo(() => {
    const items: { icon: React.ElementType; label: string; detail: string; href: string; priority: "urgent" | "soon" | "routine" }[] = []
    for (const c of deniedClaims) {
      items.push({ icon: Receipt, label: `Claim ${c.claim_number} denied`, detail: "Appeal available", href: "/billing", priority: "urgent" })
    }
    if (abnormalLabCount > 0) {
      items.push({ icon: FlaskConical, label: `${abnormalLabCount} abnormal lab result${abnormalLabCount > 1 ? "s" : ""}`, detail: "Review with your doctor", href: "/lab-results", priority: "urgent" })
    }
    for (const v of overdueVaccines) {
      items.push({ icon: Syringe, label: `${v.vaccine_name} overdue`, detail: "Schedule this vaccination", href: "/vaccinations", priority: "soon" })
    }
    for (const rx of lowAdherenceRx) {
      items.push({ icon: Pill, label: `${rx.medication_name} adherence ${rx.adherence_pct}%`, detail: "Set a reminder or adjust schedule", href: "/prescriptions", priority: "soon" })
    }
    for (const v of dueVaccines.filter(dv => dv.status === "due")) {
      items.push({ icon: Syringe, label: `${v.vaccine_name} due`, detail: "Schedule when convenient", href: "/vaccinations", priority: "routine" })
    }
    if (upcomingApts.length > 0) {
      const apt = upcomingApts[0]
      items.push({ icon: Calendar, label: apt.reason || "Upcoming appointment", detail: `${formatDate(apt.scheduled_at)} at ${formatTime(apt.scheduled_at)}`, href: "/scheduling", priority: "routine" })
    }
    return items
  }, [deniedClaims, abnormalLabCount, overdueVaccines, lowAdherenceRx, dueVaccines, upcomingApts])

  const recentActivity = useMemo(() => {
    const items: { icon: React.ElementType; label: string; time: string; href: string }[] = []
    for (const lab of snapshot.labResults.filter(l => l.status !== "pending").slice(0, 1)) {
      items.push({ icon: FlaskConical, label: `${lab.test_name} result ready`, time: lab.resulted_at || lab.ordered_at, href: "/lab-results" })
    }
    for (const apt of snapshot.appointments.filter(a => new Date(a.scheduled_at).getTime() <= Date.now()).slice(0, 1)) {
      items.push({ icon: Calendar, label: `${apt.reason || "Visit"} completed`, time: apt.scheduled_at, href: "/scheduling" })
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

  // ── Loading ──
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

  // ── Disconnected ──
  if (!isConnected && !hasData) return <DisconnectedHero />

  // ── Connected but no data ──
  if (isConnected && !hasData) return <NewUserOnboarding firstName={firstName} />

  // ── Full dashboard ──
  return (
    <div className="animate-hero-fade space-y-5">
      {/* ─── Greeting ─── */}
      <div>
        <h1 className="text-2xl font-semibold text-primary tracking-tight">
          {firstName ? `Hi, ${firstName}` : "Dashboard"}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {actionItems.length > 0
            ? `${actionItems.length} item${actionItems.length > 1 ? "s" : ""} need${actionItems.length === 1 ? "s" : ""} your attention.`
            : "You're all caught up. Nice work."
          }
        </p>
      </div>

      {/* ─── Action rail — the core of the Care OS ─── */}
      {actionItems.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/30">
            <p className="section-title">What to do next</p>
          </div>
          <div className="divide-y divide-border/20">
            {actionItems.slice(0, 5).map((item, i) => (
              <Link
                key={`${item.label}-${i}`}
                href={item.href}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-teal-50/20 group"
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  item.priority === "urgent" ? "bg-red-50" :
                  item.priority === "soon" ? "bg-amber-50" : "bg-teal-50/60"
                )}>
                  <item.icon size={16} className={cn(
                    item.priority === "urgent" ? "text-red-500" :
                    item.priority === "soon" ? "text-amber-600" : "text-teal"
                  )} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-primary truncate">{item.label}</p>
                    <span className={cn(
                      item.priority === "urgent" ? "priority-urgent" :
                      item.priority === "soon" ? "priority-soon" : "priority-routine"
                    )}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-secondary">{item.detail}</p>
                </div>
                <ChevronRight size={16} className="text-muted group-hover:text-teal transition shrink-0" />
              </Link>
            ))}
          </div>
          {actionItems.length > 5 && (
            <div className="border-t border-border/20 px-5 py-3 text-center">
              <Link href="/dashboard" className="text-[12px] font-medium text-teal hover:text-teal/80 transition">
                View all {actionItems.length} items
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ─── Caught up state ─── */}
      {actionItems.length === 0 && (
        <div className="surface-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 mb-4">
            <CheckCircle2 size={24} className="text-emerald-500" strokeWidth={1.5} />
          </div>
          <p className="text-[16px] font-semibold text-primary">All clear</p>
          <p className="mt-1 text-sm text-secondary">No urgent items, overdue screenings, or pending actions right now.</p>
          <Link href="/chat" className="btn-ghost mt-4 inline-flex text-teal">
            <Bot size={14} />
            Ask your AI care team
          </Link>
        </div>
      )}

      {/* ─── Stats + Health ring ─── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Active meds", value: String(myRx.length), icon: Pill, color: "text-teal" },
            { label: "Adherence", value: `${avgAdherence}%`, icon: Activity, color: avgAdherence >= 80 ? "text-emerald-600" : "text-amber-600" },
            { label: "Due vaccines", value: String(dueVaccines.length), icon: Syringe, color: dueVaccines.length > 0 ? "text-amber-600" : "text-emerald-600" },
            { label: "Open claims", value: String(deniedClaims.length), icon: Receipt, color: deniedClaims.length > 0 ? "text-red-500" : "text-emerald-600" },
          ].map((stat) => (
            <div key={stat.label} className="surface-card p-4">
              <div className="flex items-center justify-between">
                <stat.icon size={14} className="text-muted/60" strokeWidth={1.5} />
                <span className={cn("text-xl font-bold tabular-nums", stat.color)}>{stat.value}</span>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-muted uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="surface-card p-5 flex items-center gap-4 min-w-[200px]">
          <div className="relative shrink-0">
            <HealthRing score={healthScore ?? 0} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn(
                "text-xl font-bold tabular-nums",
                healthScore === null ? "text-muted" : healthScore >= 80 ? "text-emerald-600" : healthScore >= 60 ? "text-amber-600" : "text-red-500"
              )}>{healthScore ?? "—"}</span>
            </div>
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-medium text-muted uppercase tracking-wider">Health score</p>
            {latestVital?.systolic && (
              <p className="text-[12px] text-secondary">BP {latestVital.systolic}/{latestVital.diastolic}</p>
            )}
            {latestVital?.heart_rate && (
              <p className="text-[12px] text-secondary">HR {latestVital.heart_rate} bpm</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Activity timeline ─── */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
          <p className="section-title">Recent activity</p>
          <Link href="/timeline" className="text-[11px] font-semibold text-teal transition hover:text-teal-dark flex items-center gap-1">
            View all <ArrowRight size={10} />
          </Link>
        </div>
        {recentActivity.length > 0 ? (
          <div className="divide-y divide-border/20">
            {recentActivity.map((item, i) => (
              <Link key={i} href={item.href} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-teal-50/20 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface group-hover:bg-white transition">
                  <item.icon size={14} className="text-muted" strokeWidth={1.5} />
                </div>
                <span className="flex-1 text-[13px] font-medium text-primary">{item.label}</span>
                <span className="text-[11px] text-muted tabular-nums">{formatRelative(item.time)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <Clock size={18} className="text-muted mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-[13px] text-secondary">No recent activity yet</p>
            <p className="text-[11px] text-muted mt-0.5">Care team updates will appear here.</p>
          </div>
        )}
      </div>

      {/* ─── Quick links ─── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/scheduling", icon: Calendar, label: "Scheduling" },
          { href: "/prescriptions", icon: Pill, label: "Prescriptions" },
          { href: "/lab-results", icon: FlaskConical, label: "Lab Results" },
          { href: "/chat", icon: Bot, label: "AI Concierge" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="surface-card-interactive flex items-center gap-3 p-4 group"
          >
            <link.icon size={15} className="text-teal shrink-0" strokeWidth={1.5} />
            <span className="text-[13px] font-medium text-primary group-hover:text-teal transition">{link.label}</span>
            <ArrowRight size={11} className="ml-auto text-muted group-hover:text-teal transition" />
          </Link>
        ))}
      </div>
    </div>
  )
}
