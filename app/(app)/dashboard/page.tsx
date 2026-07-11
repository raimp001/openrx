"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  MessageSquare,
  Pill,
  Receipt,
  Search,
  ShieldCheck,
  Syringe,
  ClipboardList,
} from "lucide-react"
import { CareAskPanel, dashboardCareAskSuggestions } from "@/components/care-ask-panel"
import { AppPageHeader } from "@/components/layout/app-page"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"
import { useCarePlans } from "@/lib/hooks/use-care-plans"
import { advanceCarePlanStatus } from "@/lib/care-plan"
import { useWalletIdentity } from "@/lib/wallet-context"
import { cn, formatDate, formatTime } from "@/lib/utils"

export default function DashboardPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const { isConnected, profile } = useWalletIdentity()
  const scrollRef = useScrollReveal()
  const { plans, setRecommendationStatus } = useCarePlans()

  const patientName = profile?.fullName || snapshot.patient?.full_name || ""
  const firstName = patientName.split(" ")[0]
  const hasData = !!snapshot.patient

  const activeRx = snapshot.prescriptions.filter((p) => p.status === "active")
  const upcomingAppointments = useMemo(
    () =>
      [...snapshot.appointments]
        .filter((a) => new Date(a.scheduled_at) >= new Date() && a.status !== "completed")
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [snapshot.appointments]
  )

  const abnormalLabCount = snapshot.labResults.flatMap((lab) => lab.results.filter((result) => result.flag !== "normal")).length
  const dueVaccines = snapshot.vaccinations.filter((v) => v.status === "due" || v.status === "overdue")
  const overdueVaccines = dueVaccines.filter((v) => v.status === "overdue")
  const deniedClaims = snapshot.claims.filter((c) => c.status === "denied")
  const lowAdherenceRx = activeRx.filter((p) => p.adherence_pct < 80)
  const unreadMessages = snapshot.messages.filter((message) => !message.read).length
  const attentionCount = deniedClaims.length + abnormalLabCount + overdueVaccines.length + lowAdherenceRx.length + unreadMessages

  const nextAction = useMemo(() => {
    if (deniedClaims.length > 0) {
      return {
        icon: Receipt,
        label: `Appeal ${deniedClaims[0].claim_number}`,
        detail: "Coverage denial needs review.",
        href: `/chat?topic=billing&prompt=${encodeURIComponent(`Help me understand and prepare next steps for denied claim ${deniedClaims[0].claim_number}. Do not claim approval or submission.`)}`,
        tone: "critical" as const,
      }
    }
    if (abnormalLabCount > 0) {
      return {
        icon: FlaskConical,
        label: `${abnormalLabCount} lab result${abnormalLabCount > 1 ? "s" : ""}`,
        detail: "Flagged results are ready for review.",
        href: `/chat?topic=coordinator&prompt=${encodeURIComponent("Help me understand what to ask my clinician about my flagged lab results.")}`,
        tone: "critical" as const,
      }
    }
    if (overdueVaccines.length > 0) {
      return {
        icon: Syringe,
        label: `${overdueVaccines[0].vaccine_name} overdue`,
        detail: "A prevention gap is open.",
        href: `/chat?topic=wellness&prompt=${encodeURIComponent(`Help me understand whether ${overdueVaccines[0].vaccine_name} is due and what to ask before getting it.`)}`,
        tone: "warning" as const,
      }
    }
    if (lowAdherenceRx.length > 0) {
      return {
        icon: Pill,
        label: `${lowAdherenceRx[0].medication_name} follow-up`,
        detail: "Adherence or refill risk needs attention.",
        href: `/chat?topic=rx&prompt=${encodeURIComponent(`Help me think through medication access or adherence for ${lowAdherenceRx[0].medication_name}.`)}`,
        tone: "warning" as const,
      }
    }
    if (upcomingAppointments.length > 0) {
      return {
        icon: Calendar,
        label: upcomingAppointments[0].reason || "Upcoming visit",
        detail: `${formatDate(upcomingAppointments[0].scheduled_at)} at ${formatTime(upcomingAppointments[0].scheduled_at)}`,
        href: `/chat?topic=scheduling&prompt=${encodeURIComponent(`Help me prepare for my upcoming visit: ${upcomingAppointments[0].reason || "appointment"}.`)}`,
        tone: "calm" as const,
      }
    }

    return null
  }, [abnormalLabCount, deniedClaims, lowAdherenceRx, overdueVaccines, upcomingAppointments])

  const todayPlan = useMemo(() => {
    const items: Array<{ label: string; detail: string; href: string }> = []
    if (nextAction) items.push({ label: nextAction.label, detail: nextAction.detail, href: nextAction.href })
    if (unreadMessages > 0) items.push({ label: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`, detail: "Reply before follow-up stalls.", href: "/messages" })
    if (upcomingAppointments.length > 0) items.push({ label: upcomingAppointments[0].reason || "Upcoming visit", detail: `${formatDate(upcomingAppointments[0].scheduled_at)} at ${formatTime(upcomingAppointments[0].scheduled_at)}`, href: "/scheduling" })
    return items.slice(0, 3)
  }, [nextAction, unreadMessages, upcomingAppointments])

  const recentActivity = useMemo(() => {
    const items: Array<{ label: string; detail: string; href: string }> = []
    const lab = snapshot.labResults.find((item) => item.status !== "pending")
    if (lab) items.push({ label: `${lab.test_name} ready`, detail: "New result in the chart.", href: "/lab-results" })
    const appointment = upcomingAppointments[0]
    if (appointment) {
      const physician = getPhysician(appointment.physician_id)
      items.push({ label: appointment.reason || "Visit", detail: physician?.full_name || "Care team", href: "/scheduling" })
    }
    const claim = deniedClaims[0]
    if (claim) items.push({ label: `Claim ${claim.claim_number}`, detail: "Appeal work is ready.", href: "/billing" })
    return items.slice(0, 3)
  }, [deniedClaims, getPhysician, snapshot.labResults, upcomingAppointments])

  if (loading) {
    // Content-shaped skeleton instead of a lone spinner, so the page doesn't
    // swap from blank to fully-populated on every visit.
    return (
      <div className="space-y-6" data-testid="dashboard-skeleton" aria-busy="true" aria-label="Loading your care summary">
        <div className="space-y-3">
          <div className="orx-skeleton h-4 w-24 rounded-full" />
          <div className="orx-skeleton h-8 w-72 max-w-full rounded-[10px]" />
          <div className="orx-skeleton h-4 w-96 max-w-full rounded-full" />
        </div>
        <div className="orx-skeleton h-28 w-full rounded-[22px]" />
        <div className="grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="orx-skeleton h-24 rounded-[18px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="orx-skeleton h-56 rounded-[22px]" />
          <div className="grid gap-4">
            <div className="orx-skeleton h-[104px] rounded-[22px]" />
            <div className="orx-skeleton h-[104px] rounded-[22px]" />
          </div>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div ref={scrollRef} className="mx-auto max-w-4xl animate-hero-fade space-y-6">
        <AppPageHeader
          eyebrow={isConnected ? "Finish setup" : "Start"}
          title={isConnected && firstName ? `${firstName}, set up your care.` : "Set up your care."}
          description="Answer a few questions so OpenRx can personalize screenings, visits, medications, messages, and billing help."
        />
        <CareAskPanel
          compact
          title="You can ask first."
          description="Setup helps personalization. Chat helps orientation now."
          placeholder="Example: What should I do first?"
          suggestions={dashboardCareAskSuggestions}
        />
        <ActiveCarePlans plans={plans} onAdvance={setRecommendationStatus} />
        <div className="flex flex-wrap gap-3">
          <Link href="/onboarding" className="control-button-primary">
            Complete setup
          </Link>
          <Link href="/chat" className="control-button-secondary">
            Ask a question
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="animate-hero-fade space-y-6">
      <AppPageHeader
        eyebrow="My care"
        title={firstName ? `${firstName}, what needs attention.` : "What needs attention."}
        description="One brief. One question box. The rest stays out of the way."
        meta={
          <>
            <span className="metric-chip"><Calendar size={11} /> {upcomingAppointments.length} visits</span>
            <span className="metric-chip"><MessageSquare size={11} /> {unreadMessages} unread</span>
            <span className="metric-chip"><Pill size={11} /> {activeRx.length} meds</span>
          </>
        }
      />

      <CareAskPanel
        compact
        title="Ask OpenRx."
        description="Describe the problem. OpenRx answers first, then gives phone numbers or next steps only when needed."
        placeholder="Example: What should I handle first today?"
        suggestions={dashboardCareAskSuggestions}
      />

      <ActiveCarePlans plans={plans} onAdvance={setRecommendationStatus} />

      <section className="grid gap-3 md:grid-cols-4">
        <CareMetric label="Needs attention" value={attentionCount} />
        <CareMetric label="Labs flagged" value={abnormalLabCount} />
        <CareMetric label="Vaccines due" value={dueVaccines.length} />
        <CareMetric label="Claims denied" value={deniedClaims.length} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="section-title">Next</p>
            <Link href="/chat" className="text-xs font-semibold text-primary">Ask</Link>
          </div>
          {nextAction ? (
            <Link href={nextAction.href} className="mt-4 flex items-start gap-4 rounded-[18px] border border-white/10 bg-white/[0.055] p-4 transition hover:bg-white/[0.09]">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", nextAction.tone === "critical" ? "bg-red-400/12 text-red-200" : nextAction.tone === "warning" ? "bg-amber-300/12 text-amber-200" : "bg-cyan-200/10 text-cyan-200")}>
                <nextAction.icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary">{nextAction.label}</p>
                <p className="mt-1 text-sm text-secondary">{nextAction.detail}</p>
              </div>
              <ChevronRight size={16} className="mt-1 text-muted" />
            </Link>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.055] p-4">
              <CheckCircle2 size={18} className="text-teal" />
              <p className="text-sm font-medium text-primary">Nothing urgent right now.</p>
            </div>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <QuickLink href="/chat?topic=scheduling&prompt=Help%20me%20find%20care.%20Ask%20for%20my%20ZIP%20code%20first%20if%20it%20is%20missing%2C%20then%20return%20public%20clinic%20phone%20numbers." icon={Search} label="Find care" />
            <QuickLink href="/chat?topic=screening&prompt=What%20screening%20is%20due%20for%20me%3F%20Answer%20in%20chat%20and%20ask%20one%20follow-up%20only%20if%20needed." icon={ShieldCheck} label="Screenings" />
            <QuickLink href="/chat?topic=coordinator&prompt=Help%20me%20write%20or%20understand%20a%20care-team%20message." icon={MessageSquare} label="Messages" />
          </div>
        </div>

        <div className="grid gap-4">
          <ListCard title="Today" items={todayPlan} empty="No open agenda." />
          <ListCard title="Recent" items={recentActivity} empty="No recent activity." />
        </div>
      </section>
    </div>
  )
}

function ActiveCarePlans({
  plans,
  onAdvance,
}: {
  plans: ReturnType<typeof useCarePlans>["plans"]
  onAdvance: ReturnType<typeof useCarePlans>["setRecommendationStatus"]
}) {
  const openItems = plans
    .flatMap((plan) => plan.recommendations.map((item) => ({ plan, item })))
    .filter(({ item }) => item.status !== "completed" && item.status !== "deferred")
    .slice(0, 5)

  if (!plans.length) return null

  return (
    <section className="surface-card p-5 sm:p-6" data-testid="active-care-plans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-title">Care Plan</p>
          <h2 className="mt-2 text-xl font-semibold text-primary">Your saved next steps</h2>
        </div>
        <span className="metric-chip">{openItems.length} active</span>
      </div>
      {openItems.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {openItems.map(({ plan, item }) => (
            <article key={`${plan.id}-${item.id}`} className="rounded-[18px] border border-white/10 bg-white/[0.055] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} className="text-teal" />
                  <h3 className="text-sm font-semibold text-primary">{item.title}</h3>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {item.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-secondary">{item.nextAction}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted">{item.sourceLabel}</span>
                <button
                  type="button"
                  onClick={() => onAdvance(plan.id, item.id, advanceCarePlanStatus(item.status))}
                  className="control-button-secondary px-3 py-2 text-xs"
                >
                  Mark next step
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-secondary">All saved steps are complete or deferred.</p>
      )}
      <p className="mt-4 text-xs text-muted">Demo mode stores these care tasks in this browser only.</p>
    </section>
  )
}

function CareMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.055] p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none text-primary">{value}</p>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Bot; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-sm font-semibold text-primary transition hover:bg-white/[0.09]">
      <Icon size={14} />
      {label}
    </Link>
  )
}

function ListCard({
  title,
  items,
  empty,
}: {
  title: string
  items: Array<{ label: string; detail: string; href: string }>
  empty: string
}) {
  return (
    <section className="surface-card p-5">
      <p className="section-title">{title}</p>
      <div className="mt-3 space-y-1">
        {items.length ? (
          items.map((item) => (
            <Link key={`${item.href}-${item.label}`} href={item.href} className="flex items-start justify-between gap-3 rounded-[16px] px-3 py-3 transition hover:bg-white/[0.075]">
              <div>
                <p className="text-sm font-semibold text-primary">{item.label}</p>
                <p className="mt-1 text-[12px] text-secondary">{item.detail}</p>
              </div>
              <ChevronRight size={14} className="mt-1 text-muted" />
            </Link>
          ))
        ) : (
          <p className="px-3 py-3 text-sm text-secondary">{empty}</p>
        )}
      </div>
    </section>
  )
}
