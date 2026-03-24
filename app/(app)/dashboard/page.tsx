"use client"

import {
  Calendar, Pill, MessageSquare, Receipt,
  ArrowRight, Bot, CheckCircle2, Heart, ShieldCheck,
  FlaskConical, Activity, Syringe, AlertCircle, Search,
  Zap, ChevronRight, Clock, Stethoscope,
} from "lucide-react"
import Link from "next/link"
import { cn, formatTime, formatDate, getStatusColor } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useMemo } from "react"

// ── Sparkline ──────────────────────────────────────────────
function Sparkline({ values, color = "#1FA971", height = 28, width = 72 }: {
  values: number[]; color?: string; height?: number; width?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const padX = 2; const padY = 3
  const w = width - padX * 2; const h = height - padY * 2
  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * w
    const y = padY + h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const trend = values[values.length - 1] - values[0]
  const strokeColor = trend < -1 ? "#E85D5D" : trend > 1 ? color : "#A8BAB3"
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Health Score Ring ─────────────────────────────────────
function HealthRing({ score, size = 88 }: { score: number; size?: number }) {
  const strokeW = 7
  const r = (size - strokeW) / 2
  const circ = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(1, score / 100)) * circ
  const color = score >= 80 ? "#1FA971" : score >= 60 ? "#D97706" : "#D1495B"
  const trackColor = score >= 80 ? "rgba(31,169,113,0.12)" : score >= 60 ? "rgba(217,119,6,0.12)" : "rgba(209,73,91,0.12)"
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeW} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeW} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  )
}

// ── Adherence Mini Ring ──────────────────────────────────
function AdherenceRing({ pct, size = 34 }: { pct: number; size?: number }) {
  const sw = 3.5
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  const color = pct >= 90 ? "#1FA971" : pct >= 80 ? "#D97706" : "#D1495B"
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,35,31,0.08)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

// ── Skeleton loader ────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

export default function DashboardPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const patientName = snapshot.patient?.full_name || ""
  const firstName = patientName.split(" ")[0]
  const patientId = snapshot.patient?.id || ""
  const hasData = !!snapshot.patient

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const myApts = [...snapshot.appointments].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )
  const upcomingApts = myApts.filter(
    (a) => new Date(a.scheduled_at) >= new Date() && a.status !== "completed" && a.status !== "no-show"
  )
  const myRx = snapshot.prescriptions.filter((p) => p.status === "active")
  const myMessages = snapshot.messages
  const unreadCount = myMessages.filter((m) => !m.read).length
  const lowAdherenceRx = myRx.filter((p) => p.adherence_pct < 80)
  const myPA = snapshot.priorAuths.filter((p) => p.patient_id === patientId)
  const pendingPA = myPA.filter((p) => p.status === "pending" || p.status === "submitted")
  const myLabs = snapshot.labResults
  const resultedLabs = myLabs.filter((l) => l.status !== "pending")
  const pendingLabs = myLabs.filter((l) => l.status === "pending")
  const abnormalLabCount = resultedLabs
    .reduce((count, lab) => count + lab.results.filter((r) => r.flag !== "normal").length, 0)
  const myVitals = snapshot.vitals
  const latestVital = myVitals[0]
  const myVaccinations = snapshot.vaccinations
  const dueVaccines = myVaccinations.filter((v) => v.status === "due" || v.status === "overdue")

  // Health engagement score
  const avgAdherence = myRx.length > 0
    ? Math.round(myRx.reduce((s, rx) => s + rx.adherence_pct, 0) / myRx.length)
    : 100
  const deductions = (abnormalLabCount * 5) + (dueVaccines.filter(v => v.status === "overdue").length * 8) + (lowAdherenceRx.length * 10)
  const healthScore = Math.max(0, Math.min(100, avgAdherence - deductions))
  const healthScoreColor = healthScore >= 80 ? "text-accent" : healthScore >= 60 ? "text-yellow-600" : "text-soft-red"

  const preventiveTasksTotal = 3
  const preventiveTasksDone =
    (dueVaccines.length === 0 ? 1 : 0) +
    (upcomingApts.some((a) => /screen|wellness|annual|preventive/i.test(a.reason || "")) ? 1 : 0) +
    (pendingLabs.length === 0 ? 1 : 0)

  // Priority action items
  const actionItems = useMemo(() => {
    const items: { icon: React.ElementType; color: string; bg: string; border: string; label: string; href: string; priority: number }[] = []
    const deniedClaims = snapshot.claims.filter((c) => c.status === "denied")
    if (deniedClaims.length > 0) items.push({ icon: Receipt, color: "text-soft-red", bg: "bg-soft-red/5", border: "border-soft-red/15", label: `${deniedClaims.length} claim${deniedClaims.length > 1 ? "s" : ""} denied — appeal available`, href: "/billing", priority: 10 })
    if (abnormalLabCount > 0) items.push({ icon: FlaskConical, color: "text-soft-red", bg: "bg-soft-red/5", border: "border-soft-red/15", label: `${abnormalLabCount} abnormal lab value${abnormalLabCount > 1 ? "s" : ""} — review with your doctor`, href: "/lab-results", priority: 9 })
    const overdueVax = dueVaccines.filter((v) => v.status === "overdue")
    if (overdueVax.length > 0) items.push({ icon: Syringe, color: "text-yellow-600", bg: "bg-yellow-50/60", border: "border-yellow-200/50", label: `${overdueVax[0].vaccine_name} is overdue`, href: "/vaccinations", priority: 8 })
    const noRefills = myRx.filter((rx) => rx.refills_remaining === 0 && rx.status === "active")
    if (noRefills.length > 0) items.push({ icon: Pill, color: "text-yellow-600", bg: "bg-yellow-50/60", border: "border-yellow-200/50", label: `${noRefills[0].medication_name} — no refills remaining`, href: "/prescriptions", priority: 7 })
    if (lowAdherenceRx.length > 0) items.push({ icon: Pill, color: "text-yellow-600", bg: "bg-yellow-50/60", border: "border-yellow-200/50", label: `${lowAdherenceRx[0].medication_name} adherence at ${lowAdherenceRx[0].adherence_pct}%`, href: "/prescriptions", priority: 6 })
    if (pendingPA.length > 0) items.push({ icon: ShieldCheck, color: "text-soft-blue", bg: "bg-soft-blue/5", border: "border-soft-blue/15", label: `Prior auth pending — ${pendingPA[0].procedure_name}`, href: "/prior-auth", priority: 5 })
    if (upcomingApts.length > 0) items.push({ icon: Calendar, color: "text-terra", bg: "bg-terra/5", border: "border-terra/15", label: `${upcomingApts[0].reason || "Appointment"} — ${formatDate(upcomingApts[0].scheduled_at)}`, href: "/scheduling", priority: 4 })
    if (unreadCount > 0) items.push({ icon: MessageSquare, color: "text-warm-600", bg: "bg-sand/30", border: "border-sand/60", label: `${unreadCount} unread message${unreadCount > 1 ? "s" : ""} from your care team`, href: "/messages", priority: 3 })
    return items.sort((a, b) => b.priority - a.priority).slice(0, 4)
  }, [snapshot.claims, abnormalLabCount, dueVaccines, myRx, lowAdherenceRx, pendingPA, upcomingApts, unreadCount])

  // Insurance
  const insuranceIntel = useMemo(() => {
    const paidClaims = snapshot.claims.filter((c) => c.status === "paid" || c.status === "approved")
    const totalPatientPaid = paidClaims.reduce((s, c) => s + c.patient_responsibility, 0)
    const assumedDeductible = 2000
    const pctUsed = Math.min(100, Math.round((totalPatientPaid / assumedDeductible) * 100))
    const now = new Date()
    const daysToReset = Math.ceil((new Date(now.getFullYear() + 1, 0, 1).getTime() - now.getTime()) / 86400000)
    return { totalPatientPaid, assumedDeductible, pctUsed, daysToReset }
  }, [snapshot.claims])

  // Vital history for sparklines
  const vitalHistory = useMemo(() => {
    const sorted = [...myVitals].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-8)
    return {
      systolic: sorted.filter((v) => v.systolic).map((v) => v.systolic!),
      heartRate: sorted.filter((v) => v.heart_rate).map((v) => v.heart_rate!),
      glucose: sorted.filter((v) => v.blood_glucose).map((v) => v.blood_glucose!),
      weight: sorted.filter((v) => v.weight_lbs).map((v) => v.weight_lbs!),
    }
  }, [myVitals])

  function formatActivityTime(value: string): string {
    const diff = Date.now() - new Date(value).getTime()
    if (!Number.isFinite(diff) || diff < 0) return "Upcoming"
    if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
    if (diff < 86400000) return `${Math.max(1, Math.round(diff / 3600000))}h ago`
    return new Date(value).toLocaleDateString()
  }

  // ── No database / not connected state ─────────────────────
  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-terra/10 to-terra/5 flex items-center justify-center">
          <Heart size={36} className="text-terra" />
        </div>
        <div>
          <h1 className="text-3xl font-serif text-warm-800">Welcome to OpenRx</h1>
          <p className="text-warm-500 mt-2 max-w-md mx-auto leading-relaxed">
            Connect your health records to unlock your personalized care dashboard — appointments, medications, labs, and your AI care team.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/onboarding"
            className="px-6 py-3 bg-terra text-white text-sm font-semibold rounded-xl hover:bg-terra-dark transition shadow-sm"
          >
            Get Started
          </Link>
          <Link
            href="/providers"
            className="px-6 py-3 border border-sand text-warm-700 text-sm font-semibold rounded-xl hover:border-terra/30 hover:text-terra transition"
          >
            Find Providers
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 w-full max-w-2xl">
          {[
            { icon: Calendar, label: "Smart Scheduling" },
            { icon: Pill, label: "Medication Manager" },
            { icon: FlaskConical, label: "Lab Results" },
            { icon: Bot, label: "AI Care Team" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="surface-card p-4 text-center">
              <Icon size={20} className="text-terra mx-auto mb-2" />
              <p className="text-xs font-semibold text-warm-700">{label}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Loading skeleton ───────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-slide-up space-y-5">
        <div className="surface-card p-6 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-warm-500">
            Loading command center
          </p>
          <h1 className="text-4xl leading-[1.02] text-warm-800">
            {greeting}
          </h1>
          <p className="max-w-xl text-sm leading-7 text-warm-500">
            Pulling appointments, medications, labs, messages, and care-team priorities into one view.
          </p>
          <div className="space-y-2 pt-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="surface-card p-5"><Skeleton className="h-16 w-full" /></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 surface-card p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
          <div className="space-y-4">
            <div className="surface-card p-4 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-5">

      {/* ── Hero section ────────────────────────────────── */}
      <section className="surface-card relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-0 h-56 w-56 rounded-full bg-terra/8 blur-3xl" />
          <div className="absolute bottom-[-4rem] left-[-2rem] h-40 w-40 rounded-full bg-accent/6 blur-3xl" />
        </div>
        <div className="relative grid gap-5 px-5 py-5 lg:grid-cols-[1.4fr_0.6fr] lg:px-7 lg:py-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-warm-500">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="mt-3 max-w-3xl text-[clamp(2.2rem,3.8vw,4.2rem)] font-semibold leading-[0.96] tracking-[-0.07em] text-warm-800">
              {greeting}
              {firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-warm-600">
              {actionItems.length > 0
                ? `${actionItems.length} priority item${actionItems.length > 1 ? "s" : ""} need attention today. OpenRx keeps the next clinical, operational, and preventive steps in one view.`
                : "You are caught up today. OpenRx keeps prevention, follow-up, and logistics visible before they become urgent."}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-black/[0.06] bg-white/84 px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Upcoming</p>
                <p className="mt-3 text-2xl font-semibold leading-none text-warm-800">{upcomingApts.length}</p>
                <p className="mt-2 text-[11px] leading-5 text-warm-600">
                  {upcomingApts[0]
                    ? `${formatDate(upcomingApts[0].scheduled_at)} · ${formatTime(upcomingApts[0].scheduled_at)}`
                    : "No visits booked yet"}
                </p>
              </div>
              <div className="rounded-[24px] border border-black/[0.06] bg-white/84 px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Prevention</p>
                <p className="mt-3 text-2xl font-semibold leading-none text-warm-800">
                  {preventiveTasksDone}/{preventiveTasksTotal}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-warm-600">
                  {dueVaccines.length > 0 ? `${dueVaccines.length} vaccine item${dueVaccines.length > 1 ? "s" : ""} due` : "No overdue preventive items"}
                </p>
              </div>
              <div className="rounded-[24px] border border-black/[0.06] bg-white/84 px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Inbox</p>
                <p className="mt-3 text-2xl font-semibold leading-none text-warm-800">{unreadCount}</p>
                <p className="mt-2 text-[11px] leading-5 text-warm-600">
                  {unreadCount > 0 ? "Messages waiting from your care team" : "No new conversations"}
                </p>
              </div>
            </div>
          </div>

          <div className="surface-muted p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Health signal</p>
                <p className="mt-2 text-sm font-semibold text-warm-800">Current prevention posture</p>
                <p className="mt-2 text-[12px] leading-6 text-warm-600">
                  Adherence, labs, vaccines, and follow-up are condensed into one directional score for the day.
                </p>
              </div>
              <div className="relative shrink-0">
                <HealthRing score={healthScore} size={84} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("text-lg font-bold leading-none", healthScoreColor)}>{healthScore}</span>
                  <span className="text-[8px] uppercase tracking-[0.16em] text-cloudy">score</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-warm-600">
                <span>Preventive plan</span>
                <span className="font-semibold text-warm-700">
                  {preventiveTasksDone} of {preventiveTasksTotal} complete
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand/50">
                <div
                  className="h-full rounded-full bg-terra transition-all duration-700"
                  style={{ width: `${Math.round((preventiveTasksDone / preventiveTasksTotal) * 100)}%` }}
                />
              </div>
              <div className="grid gap-2">
                <QuickHeroLink href="/screening" icon={Heart} label="Run screening" detail="Risk, prevention, hereditary review" />
                <QuickHeroLink href="/providers" icon={Search} label="Find care" detail="Locate the next clinician or center" />
                <QuickHeroLink href="/chat" icon={Bot} label="Ask AI concierge" detail="Turn questions into next actions" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-black/[0.06] px-5 py-5 lg:px-7">
          <div className="mb-3 flex items-center gap-2">
            <Zap size={12} className="text-terra" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-warm-500">Priorities today</span>
          </div>
          {actionItems.length > 0 ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {actionItems.map((item, i) => {
                const Icon = item.icon
                return (
                  <Link
                    key={i}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-[22px] border border-black/[0.06] bg-white/84 px-4 py-3 transition-all hover:border-terra/18 hover:bg-white"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f6f2ea]">
                      <Icon size={14} className={item.color} />
                    </div>
                    <span className="flex-1 text-[12px] font-medium leading-6 text-warm-700 group-hover:text-warm-900">
                      {item.label}
                    </span>
                    <ChevronRight size={13} className="text-cloudy shrink-0 group-hover:text-terra transition-colors" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-[20px] border border-accent/12 bg-white/82 px-4 py-3">
              <CheckCircle2 size={14} className="text-accent shrink-0" />
              <span className="text-xs font-semibold text-warm-700">No urgent items right now.</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            href: "/scheduling", icon: Calendar, color: "text-terra", accentBg: "bg-terra", accent8: "bg-terra/8",
            value: upcomingApts.length, label: "Upcoming Visits", sub: upcomingApts[0] ? formatDate(upcomingApts[0].scheduled_at) : "None scheduled",
            accentBorder: "hover:border-terra/25",
          },
          {
            href: "/prescriptions", icon: Pill, color: "text-accent", accentBg: "bg-accent", accent8: "bg-accent/8",
            value: myRx.length, label: "Active Medications",
            sub: myRx.length > 0 ? `Avg ${avgAdherence}% adherence` : "No active Rx",
            accentBorder: "hover:border-accent/25",
          },
          {
            href: "/lab-results", icon: FlaskConical, color: "text-soft-blue", accentBg: "bg-soft-blue", accent8: "bg-soft-blue/8",
            value: myLabs.length, label: "Lab Tests",
            sub: abnormalLabCount > 0 ? `${abnormalLabCount} abnormal` : pendingLabs.length > 0 ? `${pendingLabs.length} pending` : "All normal",
            accentBorder: "hover:border-soft-blue/25",
          },
          {
            href: "/messages", icon: MessageSquare, color: "text-yellow-600", accentBg: "bg-yellow-400", accent8: "bg-yellow-50",
            value: unreadCount, label: "Unread Messages",
            sub: unreadCount > 0 ? "From your care team" : "No new messages",
            accentBorder: "hover:border-yellow-300/50",
          },
        ].map((card) => (
          <Link key={card.label} href={card.href}
            className={cn("surface-card relative overflow-hidden p-4 transition-all", card.accentBorder)}>
            <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center mb-4", card.accent8)}>
              <card.icon size={16} className={card.color} />
            </div>
            <div className="text-2xl font-semibold text-warm-800 leading-none">{card.value}</div>
            <div className="mt-2 text-xs font-semibold text-warm-700">{card.label}</div>
            <div className="mt-1 text-[10px] leading-5 text-cloudy">{card.sub}</div>
          </Link>
        ))}
      </div>

      {/* ── Main content grid ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Upcoming Appointments */}
        <div className="lg:col-span-2 surface-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-sand/60">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-terra" />
              <h2 className="text-sm font-bold text-warm-800">Upcoming Visits</h2>
            </div>
            <Link href="/scheduling" className="text-xs font-semibold text-terra flex items-center gap-1 hover:gap-1.5 transition-all">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-sand/40">
            {upcomingApts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sand/30 flex items-center justify-center">
                  <Calendar size={20} className="text-cloudy" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-warm-600">No upcoming appointments</p>
                  <Link href="/providers" className="text-xs text-terra font-semibold mt-1 inline-flex items-center gap-0.5 hover:gap-1 transition-all">
                    Find a doctor <ArrowRight size={10} />
                  </Link>
                </div>
              </div>
            )}
            {upcomingApts.slice(0, 5).map((apt) => {
              const physician = getPhysician(apt.physician_id)
              const aptDate = new Date(apt.scheduled_at)
              const isToday = aptDate.toDateString() === new Date().toDateString()
              return (
                <div key={apt.id} className="flex items-center gap-4 px-5 py-4 hover:bg-cream/40 transition group">
                  {/* Date badge */}
                  <div className={cn(
                    "flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 border",
                    isToday ? "bg-terra text-white border-terra" : "bg-cream/60 border-sand text-warm-700"
                  )}>
                    <span className="text-[9px] font-bold uppercase leading-none">
                      {aptDate.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="text-base font-bold leading-tight">
                      {aptDate.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-warm-800">
                        {physician?.full_name || "Your Doctor"}
                      </span>
                      {physician?.specialty && (
                        <span className="text-[10px] text-warm-500">{physician.specialty}</span>
                      )}
                    </div>
                    <p className="text-xs text-warm-500 mt-0.5 truncate">{apt.reason}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-cloudy">{formatTime(apt.scheduled_at)}</span>
                      {apt.copay > 0 && (
                        <span className="text-[10px] text-cloudy">&middot; ${apt.copay} copay</span>
                      )}
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide",
                        getStatusColor(apt.status)
                      )}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-sand group-hover:text-terra transition-colors shrink-0" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Latest Vitals */}
          {latestVital ? (
            <Link href="/vitals" className="block surface-card p-4 hover:border-terra/25 transition group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-accent" />
                  <span className="text-xs font-bold text-warm-800">Latest Vitals</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-cloudy">
                  <Clock size={9} />
                  {new Date(latestVital.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {latestVital.systolic && (
                  <div className="space-y-1">
                    <div className="flex items-end justify-between gap-1">
                      <p className={cn("text-base font-bold leading-none", latestVital.systolic >= 140 ? "text-soft-red" : "text-warm-800")}>
                        {latestVital.systolic}/{latestVital.diastolic}
                      </p>
                      <Sparkline values={vitalHistory.systolic} color={latestVital.systolic >= 140 ? "#D1495B" : "#1FA971"} />
                    </div>
                    <p className="text-[9px] text-cloudy">Blood Pressure mmHg</p>
                  </div>
                )}
                {latestVital.heart_rate && (
                  <div className="space-y-1">
                    <div className="flex items-end justify-between gap-1">
                      <p className="text-base font-bold text-warm-800 leading-none">{latestVital.heart_rate}</p>
                      <Sparkline values={vitalHistory.heartRate} />
                    </div>
                    <p className="text-[9px] text-cloudy">Heart Rate bpm</p>
                  </div>
                )}
                {latestVital.blood_glucose && (
                  <div className="space-y-1">
                    <div className="flex items-end justify-between gap-1">
                      <p className={cn("text-base font-bold leading-none", latestVital.blood_glucose > 130 ? "text-yellow-600" : "text-warm-800")}>
                        {latestVital.blood_glucose}
                      </p>
                      <Sparkline values={vitalHistory.glucose} color={latestVital.blood_glucose > 130 ? "#D97706" : "#1FA971"} />
                    </div>
                    <p className="text-[9px] text-cloudy">Glucose mg/dL</p>
                  </div>
                )}
                {latestVital.weight_lbs && (
                  <div className="space-y-1">
                    <div className="flex items-end justify-between gap-1">
                      <p className="text-base font-bold text-warm-800 leading-none">{latestVital.weight_lbs}</p>
                      <Sparkline values={vitalHistory.weight} color="#6C7D75" />
                    </div>
                    <p className="text-[9px] text-cloudy">Weight lbs</p>
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <Link href="/vitals" className="block surface-card p-4 hover:border-terra/25 transition">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} className="text-accent" />
                <span className="text-xs font-bold text-warm-800">Vitals</span>
              </div>
              <div className="flex flex-col items-center py-4 text-center gap-2">
                <Activity size={20} className="text-sand" />
                <p className="text-xs text-warm-500">No vitals recorded yet</p>
              </div>
            </Link>
          )}

          {/* Medications */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-sand/60">
              <div className="flex items-center gap-2">
                <Pill size={14} className="text-accent" />
                <h3 className="text-xs font-bold text-warm-800">Active Medications</h3>
              </div>
              <Link href="/prescriptions" className="text-[10px] font-semibold text-terra hover:text-terra-dark transition">
                View all
              </Link>
            </div>
            {myRx.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center gap-2">
                <Pill size={20} className="text-sand" />
                <p className="text-xs text-warm-500">No active medications</p>
              </div>
            ) : (
              <div className="divide-y divide-sand/40">
                {myRx.slice(0, 4).map((rx) => (
                  <div key={rx.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream/40 transition">
                    <AdherenceRing pct={rx.adherence_pct} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-warm-800 truncate">{rx.medication_name} <span className="text-warm-500 font-normal">{rx.dosage}</span></p>
                      <p className="text-[10px] text-cloudy truncate">{rx.frequency}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold shrink-0",
                      rx.adherence_pct >= 90 ? "text-accent" : rx.adherence_pct >= 80 ? "text-yellow-600" : "text-soft-red"
                    )}>
                      {rx.adherence_pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insurance Deductible */}
          <div className="surface-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-soft-blue" />
                <span className="text-xs font-bold text-warm-800">
                  {snapshot.patient?.insurance_provider ? snapshot.patient.insurance_provider.split("/")[0].trim() : "Insurance"}
                </span>
              </div>
              <Link href="/billing" className="text-[10px] font-semibold text-terra hover:text-terra-dark transition">Claims</Link>
            </div>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-[10px] text-cloudy">Annual Deductible</span>
              <span className="text-[10px] font-bold text-warm-700">
                ${insuranceIntel.totalPatientPaid.toFixed(0)} / ${insuranceIntel.assumedDeductible.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full bg-sand/40 rounded-full overflow-hidden">
              <div className={cn(
                "h-full rounded-full transition-all duration-700",
                insuranceIntel.pctUsed >= 80 ? "bg-accent" : insuranceIntel.pctUsed >= 50 ? "bg-yellow-400" : "bg-soft-blue"
              )} style={{ width: `${insuranceIntel.pctUsed}%` }} />
            </div>
            <p className="text-[9px] text-cloudy mt-1.5">{insuranceIntel.pctUsed}% used · resets in {insuranceIntel.daysToReset} days</p>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-2">
            <Link href="/emergency-card" className="surface-card p-3 hover:border-soft-red/25 transition">
              <AlertCircle size={14} className="text-soft-red mb-2" />
              <p className="text-xs font-bold text-warm-800">Emergency Card</p>
              <p className="text-[10px] text-cloudy mt-0.5">Allergies & contacts</p>
            </Link>
            <Link href="/chat" className="surface-card p-3 hover:border-terra/25 transition">
              <Bot size={14} className="text-terra mb-2" />
              <p className="text-xs font-bold text-warm-800">Ask Atlas</p>
              <p className="text-[10px] text-cloudy mt-0.5">Your AI coordinator</p>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Care Team Activity ────────────────────────────── */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sand/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-terra/8 flex items-center justify-center">
              <Bot size={14} className="text-terra" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-warm-800">AI Care Team</h3>
              <p className="text-[10px] text-cloudy">Atlas, Ivy, Cal, Vera &amp; more</p>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-accent/20 bg-accent/8 px-2 py-0.5 text-[9px] font-bold text-accent ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> LIVE
            </span>
          </div>
          <Link href="/chat" className="text-xs font-semibold text-terra flex items-center gap-1 hover:gap-1.5 transition-all">
            Talk to them <ArrowRight size={12} />
          </Link>
        </div>
        <div className="divide-y divide-sand/40">
          {[
            ...resultedLabs.slice(0, 1).map((lab) => ({
              icon: FlaskConical, color: "text-soft-blue", bg: "bg-soft-blue/8",
              action: "Lab result available", detail: `${lab.test_name} is ready for review`,
              source: "Labs", time: formatActivityTime(lab.resulted_at || lab.ordered_at),
            })),
            ...upcomingApts.slice(0, 1).map((a) => ({
              icon: Calendar, color: "text-terra", bg: "bg-terra/8",
              action: "Appointment confirmed", detail: `${a.reason || "Consultation"} — ${formatDate(a.scheduled_at)} at ${formatTime(a.scheduled_at)}`,
              source: "Cal", time: "Scheduling",
            })),
            ...lowAdherenceRx.slice(0, 1).map((rx) => ({
              icon: Pill, color: "text-yellow-600", bg: "bg-yellow-50",
              action: "Adherence alert", detail: `${rx.medication_name} adherence is ${rx.adherence_pct}% — set a reminder`,
              source: "Maya", time: formatActivityTime(rx.last_filled),
            })),
            ...snapshot.claims.filter((c) => c.status === "denied").slice(0, 1).map((claim) => ({
              icon: Receipt, color: "text-soft-red", bg: "bg-soft-red/8",
              action: "Claim denied", detail: `${claim.claim_number}${claim.denial_reason ? ` — ${claim.denial_reason}` : ""}`,
              source: "Vera", time: formatActivityTime(claim.submitted_at),
            })),
            ...dueVaccines.slice(0, 1).map((v) => ({
              icon: Syringe, color: "text-yellow-600", bg: "bg-yellow-50",
              action: "Vaccine due", detail: `${v.vaccine_name} — ${v.status}`,
              source: "Ivy", time: v.next_due ? formatActivityTime(v.next_due) : "Due",
            })),
          ].slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-cream/30 transition">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                <item.icon size={14} className={item.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-warm-800">{item.action}</span>
                  <span className="text-[9px] font-bold text-terra bg-terra/8 px-1.5 py-0.5 rounded">{item.source}</span>
                </div>
                <p className="text-[11px] text-warm-500 mt-0.5 truncate">{item.detail}</p>
              </div>
              <span className="text-[10px] text-cloudy shrink-0">{item.time}</span>
            </div>
          ))}
          {resultedLabs.length === 0 && upcomingApts.length === 0 && lowAdherenceRx.length === 0 && snapshot.claims.filter(c => c.status === "denied").length === 0 && (
            <div className="flex flex-col items-center py-10 text-center gap-2">
              <Stethoscope size={20} className="text-sand" />
              <p className="text-xs text-warm-500">Your AI care team is standing by</p>
              <p className="text-[10px] text-cloudy max-w-xs">Activity from appointments, labs, and medications will appear here in real time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuickHeroLink({
  href,
  icon: Icon,
  label,
  detail,
}: {
  href: string
  icon: React.ElementType
  label: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[20px] border border-black/[0.06] bg-white/84 px-3.5 py-3 transition hover:border-terra/18 hover:bg-white"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f6f2ea]">
        <Icon size={14} className="text-terra" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-warm-800">{label}</p>
        <p className="mt-1 truncate text-[10px] text-warm-500">{detail}</p>
      </div>
      <ChevronRight size={13} className="text-cloudy" />
    </Link>
  )
}
