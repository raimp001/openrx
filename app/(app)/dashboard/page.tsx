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
} from "lucide-react"
import { CareAskPanel, dashboardCareAskSuggestions } from "@/components/care-ask-panel"
import { AppPageHeader } from "@/components/layout/app-page"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"
import { useWalletIdentity } from "@/lib/wallet-context"
import { cn, formatDate, formatTime } from "@/lib/utils"

export default function DashboardPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const { isConnected, profile } = useWalletIdentity()
  const scrollRef = useScrollReveal()

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
        href: "/billing",
        tone: "critical" as const,
      }
    }
    if (abnormalLabCount > 0) {
      return {
        icon: FlaskConical,
        label: `${abnormalLabCount} lab result${abnormalLabCount > 1 ? "s" : ""}`,
        detail: "Flagged results are ready for review.",
        href: "/lab-results",
        tone: "critical" as const,
      }
    }
    if (overdueVaccines.length > 0) {
      return {
        icon: Syringe,
        label: `${overdueVaccines[0].vaccine_name} overdue`,
        detail: "A prevention gap is open.",
        href: "/vaccinations",
        tone: "warning" as const,
      }
    }
    if (lowAdherenceRx.length > 0) {
      return {
        icon: Pill,
        label: `${lowAdherenceRx[0].medication_name} follow-up`,
        detail: "Adherence or refill risk needs attention.",
        href: "/prescriptions",
        tone: "warning" as const,
      }
    }
    if (upcomingAppointments.length > 0) {
      return {
        icon: Calendar,
        label: upcomingAppointments[0].reason || "Upcoming visit",
        detail: `${formatDate(upcomingAppointments[0].scheduled_at)} at ${formatTime(upcomingAppointments[0].scheduled_at)}`,
        href: "/scheduling",
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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-teal" />
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
        description="Describe the problem. OpenRx routes the next step."
        placeholder="Example: What should I handle first today?"
        suggestions={dashboardCareAskSuggestions}
      />

      {!isConnected ? (
        <div
          data-testid="dashboard-demo-banner"
          className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800"
        >
          <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900">
            Demo
          </span>
          You’re viewing example data. Connect an account to see your live care brief.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <CareMetric label={isConnected ? "Needs attention" : "Needs attention (demo)"} value={attentionCount} />
        <CareMetric label={isConnected ? "Labs flagged" : "Labs flagged (demo)"} value={abnormalLabCount} />
        <CareMetric label={isConnected ? "Vaccines due" : "Vaccines due (demo)"} value={dueVaccines.length} />
        <CareMetric label={isConnected ? "Claims denied" : "Claims denied (demo)"} value={deniedClaims.length} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="section-title">Next</p>
            <Link href="/chat" className="text-xs font-semibold text-primary">Ask</Link>
          </div>
          {nextAction ? (
            <Link href={nextAction.href} className="mt-4 flex items-start gap-4 rounded-[18px] bg-white/64 p-4 transition hover:bg-white">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", nextAction.tone === "critical" ? "bg-red-50 text-red-600" : nextAction.tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-teal/10 text-teal")}>
                <nextAction.icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary">{nextAction.label}</p>
                <p className="mt-1 text-sm text-secondary">{nextAction.detail}</p>
              </div>
              <ChevronRight size={16} className="mt-1 text-muted" />
            </Link>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-white/64 p-4">
              <CheckCircle2 size={18} className="text-teal" />
              <p className="text-sm font-medium text-primary">Nothing urgent right now.</p>
            </div>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <QuickLink href="/providers" icon={Search} label="Find care" />
            <QuickLink href="/screening" icon={ShieldCheck} label="Screenings" />
            <QuickLink href="/messages" icon={MessageSquare} label="Messages" />
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

function CareMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/56 p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl leading-none text-primary">{value}</p>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Bot; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-full bg-white/64 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-white">
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
            <Link key={`${item.href}-${item.label}`} href={item.href} className="flex items-start justify-between gap-3 rounded-[16px] px-3 py-3 transition hover:bg-white/72">
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
