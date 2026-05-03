"use client"

import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatTime } from "@/lib/utils"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsBriefCard, OpsEmptyState, OpsTabButton } from "@/components/ui/ops-primitives"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Calendar,
  Pill,
  FlaskConical,
  Activity,
  MessageSquare,
  Syringe,
  ArrowRightCircle,
  Receipt,
  Clock,
  ChevronRight,
} from "lucide-react"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

type EventCategory =
  | "all"
  | "appointments"
  | "medications"
  | "labs"
  | "vitals"
  | "messages"
  | "vaccinations"
  | "referrals"
  | "billing"

interface TimelineEvent {
  id: string
  date: string
  category: Exclude<EventCategory, "all">
  title: string
  subtitle: string
  detail?: string
  status?: string
  href: string
  urgent?: boolean
}

const CATEGORY_META: Record<
  Exclude<EventCategory, "all">,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  appointments: { label: "Appointments", icon: Calendar, color: "text-teal", bg: "bg-teal/10", border: "border-teal/20" },
  medications: { label: "Medications", icon: Pill, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
  labs: { label: "Labs", icon: FlaskConical, color: "text-soft-blue", bg: "bg-soft-blue/10", border: "border-soft-blue/20" },
  vitals: { label: "Vitals", icon: Activity, color: "text-accent", bg: "bg-accent/8", border: "border-accent/15" },
  messages: { label: "Messages", icon: MessageSquare, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200/50" },
  vaccinations: { label: "Vaccinations", icon: Syringe, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200/50" },
  referrals: { label: "Referrals", icon: ArrowRightCircle, color: "text-soft-blue", bg: "bg-soft-blue/8", border: "border-soft-blue/15" },
  billing: { label: "Billing", icon: Receipt, color: "text-secondary", bg: "bg-border/40", border: "border-border/80" },
}

const FILTER_TABS: { key: EventCategory; label: string }[] = [
  { key: "all", label: "All Events" },
  { key: "appointments", label: "Appointments" },
  { key: "medications", label: "Medications" },
  { key: "labs", label: "Labs" },
  { key: "vitals", label: "Vitals" },
  { key: "messages", label: "Messages" },
  { key: "vaccinations", label: "Vaccinations" },
  { key: "referrals", label: "Referrals" },
  { key: "billing", label: "Billing" },
]

export default function TimelinePage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const [activeFilter, setActiveFilter] = useState<EventCategory>("all")

  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = []

    for (const apt of snapshot.appointments) {
      const physician = getPhysician(apt.physician_id)
      all.push({
        id: `apt-${apt.id}`,
        date: apt.scheduled_at,
        category: "appointments",
        title: apt.reason || "Appointment",
        subtitle: physician?.full_name ? `${physician.full_name} · ${physician.specialty}` : apt.type,
        detail: apt.copay > 0 ? `Est. copay $${apt.copay}` : undefined,
        status: apt.status,
        href: "/scheduling",
        urgent: apt.status === "pending",
      })
    }

    for (const rx of snapshot.prescriptions) {
      all.push({
        id: `rx-${rx.id}`,
        date: rx.start_date,
        category: "medications",
        title: `${rx.medication_name} ${rx.dosage}`,
        subtitle: `${rx.frequency} · ${rx.pharmacy}`,
        detail: `${rx.adherence_pct}% adherence · ${rx.refills_remaining} refills left`,
        status: rx.status,
        href: "/prescriptions",
        urgent: rx.adherence_pct < 80,
      })
    }

    for (const lab of snapshot.labResults) {
      const hasAbnormal = lab.results.some((r) => r.flag !== "normal")
      all.push({
        id: `lab-${lab.id}`,
        date: lab.resulted_at || lab.ordered_at,
        category: "labs",
        title: lab.test_name,
        subtitle: lab.lab_facility,
        detail: hasAbnormal ? "Abnormal values detected" : `${lab.results.length} markers reviewed`,
        status: lab.status,
        href: "/lab-results",
        urgent: hasAbnormal,
      })
    }

    for (const vital of snapshot.vitals) {
      const parts: string[] = []
      if (vital.systolic) parts.push(`BP ${vital.systolic}/${vital.diastolic}`)
      if (vital.heart_rate) parts.push(`${vital.heart_rate} bpm`)
      if (vital.blood_glucose) parts.push(`Glucose ${vital.blood_glucose}`)
      if (vital.weight_lbs) parts.push(`${vital.weight_lbs} lbs`)
      all.push({
        id: `vital-${vital.id}`,
        date: vital.recorded_at,
        category: "vitals",
        title: "Vital Signs Recorded",
        subtitle: parts.join(" · ") || "No measurements",
        detail: `Source: ${vital.source}`,
        href: "/vitals",
        urgent: !!(vital.systolic && vital.systolic >= 140),
      })
    }

    for (const msg of snapshot.messages) {
      all.push({
        id: `msg-${msg.id}`,
        date: msg.created_at,
        category: "messages",
        title: msg.sender_type === "patient" ? "You sent a message" : "Message received",
        subtitle: msg.content.length > 80 ? `${msg.content.slice(0, 80)}…` : msg.content,
        detail: `via ${msg.channel}`,
        status: msg.read ? "read" : "unread",
        href: "/messages",
        urgent: !msg.read && msg.sender_type !== "patient",
      })
    }

    for (const vax of snapshot.vaccinations) {
      const date = vax.administered_at || vax.due_at || vax.next_due
      if (!date) continue
      all.push({
        id: `vax-${vax.id}`,
        date,
        category: "vaccinations",
        title: vax.vaccine_name,
        subtitle: vax.administered_at ? `Dose ${vax.dose_number}/${vax.total_doses} · ${vax.facility}` : `Due — ${vax.status}`,
        detail: vax.administered_at ? undefined : "Contact your provider to schedule",
        status: vax.status,
        href: "/vaccinations",
        urgent: vax.status === "overdue",
      })
    }

    for (const ref of snapshot.referrals) {
      all.push({
        id: `ref-${ref.id}`,
        date: ref.appointment_at || ref.created_at,
        category: "referrals",
        title: `${ref.specialist_specialty} Referral`,
        subtitle: ref.specialist_name || ref.reason,
        detail: `Urgency: ${ref.urgency} · ${ref.insurance_authorized ? "Auth approved" : "Awaiting auth"}`,
        status: ref.status,
        href: "/referrals",
        urgent: ref.urgency === "stat" || ref.status === "pending",
      })
    }

    for (const claim of snapshot.claims) {
      all.push({
        id: `claim-${claim.id}`,
        date: claim.submitted_at,
        category: "billing",
        title: `Claim ${claim.claim_number}`,
        subtitle: `$${claim.total_amount.toFixed(2)} total · Patient owes $${claim.patient_responsibility.toFixed(2)}`,
        detail: claim.denial_reason ? `Denied: ${claim.denial_reason}` : undefined,
        status: claim.status,
        href: "/billing",
        urgent: claim.status === "denied",
      })
    }

    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [snapshot, getPhysician])

  const filtered = useMemo(
    () => (activeFilter === "all" ? events : events.filter((event) => event.category === activeFilter)),
    [events, activeFilter]
  )

  const grouped = useMemo(() => {
    const groups: { label: string; events: TimelineEvent[] }[] = []
    let current: { label: string; events: TimelineEvent[] } | null = null

    for (const event of filtered) {
      const date = new Date(event.date)
      const label = Number.isNaN(date.getTime())
        ? "Unknown"
        : date.toLocaleDateString("en-US", { month: "long", year: "numeric" })

      if (!current || current.label !== label) {
        current = { label, events: [] }
        groups.push(current)
      }

      current.events.push(event)
    }

    return groups
  }, [filtered])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length }
    for (const event of events) counts[event.category] = (counts[event.category] || 0) + 1
    return counts
  }, [events])

  const urgentCount = events.filter((event) => event.urgent).length
  const latestUrgent = events.find((event) => event.urgent) || null
  const latestEvent = events[0] || null

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl border border-border/70 bg-white/60 p-4">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Longitudinal record"
        title="Health Timeline"
        description="One chronological record across appointments, medications, labs, vitals, referrals, billing, and messages so the care story stays coherent."
        className="surface-card p-4 sm:p-5"
        leading={
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal/10">
            <Clock size={18} className="text-teal" />
          </div>
        }
        meta={
          <>
            <OpsBadge tone="terra">{urgentCount} attention item{urgentCount !== 1 ? "s" : ""}</OpsBadge>
            <OpsBadge tone="blue">{events.length} total event{events.length !== 1 ? "s" : ""}</OpsBadge>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <OpsBriefCard
          label="Latest urgent signal"
          title={latestUrgent ? latestUrgent.title : "No urgent event currently surfaced"}
          detail={
            latestUrgent
              ? `${latestUrgent.subtitle} · ${latestUrgent.detail || "Open the linked workflow for details."}`
              : "The timeline does not currently have an urgent event flag."
          }
          tone="terra"
        />
        <OpsBriefCard
          label="Most recent record"
          title={latestEvent ? latestEvent.title : "No event history yet"}
          detail={latestEvent ? `${latestEvent.subtitle} · ${latestEvent.status || "No status label"}` : "Health activity will populate here as records sync in."}
          tone="blue"
        />
        <OpsBriefCard
          label="Filter strategy"
          title={activeFilter === "all" ? "Use category filters to reduce noise" : `Focused on ${activeFilter}`}
          detail="The timeline stays chronological, but the category tabs let you isolate one care stream when you are investigating a specific issue."
          tone="accent"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map(({ key, label }) => (
          <OpsTabButton key={key} active={activeFilter === key} onClick={() => setActiveFilter(key)}>
            {label}
            {categoryCounts[key] !== undefined ? (
              <span className={cn("ml-1.5 text-[10px]", activeFilter === key ? "text-white/70" : "text-muted")}>
                {categoryCounts[key]}
              </span>
            ) : null}
          </OpsTabButton>
        ))}
      </div>

      {grouped.length === 0 ? (
        <OpsEmptyState
          icon={Clock}
          title="No events found"
          description="Your cross-cutting health history will appear here as appointments, labs, medications, and messages are added."
        />
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">{group.label}</span>
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[10px] text-muted">
                  {group.events.length} event{group.events.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="relative">
                <div className="absolute bottom-4 left-[18px] top-4 w-px bg-border/60" />

                <div className="space-y-3">
                  {group.events.map((event) => {
                    const meta = CATEGORY_META[event.category]
                    const Icon = meta.icon
                    const date = new Date(event.date)
                    const isValidDate = !Number.isNaN(date.getTime())

                    return (
                      <Link
                        key={event.id}
                        href={event.href}
                        className={cn(
                          "relative flex items-start gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
                          event.urgent
                            ? "border-soft-red/15 bg-soft-red/3 hover:border-soft-red/25"
                            : "border-border/70 bg-white/60 hover:border-teal/20 hover:bg-white/80"
                        )}
                      >
                        <div className={cn("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", meta.bg, meta.border)}>
                          <Icon size={14} className={meta.color} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold leading-tight text-primary">{event.title}</span>
                                {event.urgent ? (
                                  <span className="rounded-full bg-soft-red/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-soft-red">
                                    Needs attention
                                  </span>
                                ) : null}
                                {event.status ? (
                                  <span
                                    className={cn(
                                      "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                      event.status === "completed" || event.status === "paid" || event.status === "active"
                                        ? "bg-accent/10 text-accent"
                                        : event.status === "denied" || event.status === "overdue"
                                          ? "bg-soft-red/10 text-soft-red"
                                          : event.status === "pending" || event.status === "submitted"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : "bg-border/60 text-secondary"
                                    )}
                                  >
                                    {event.status}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted">{event.subtitle}</p>
                              {event.detail ? <p className="mt-0.5 text-[11px] text-muted">{event.detail}</p> : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] font-medium text-muted">
                                {isValidDate ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                              </p>
                              <p className="text-[10px] text-muted">{isValidDate ? formatTime(event.date) : ""}</p>
                            </div>
                          </div>
                        </div>

                        <ChevronRight size={14} className="shrink-0 self-center text-muted" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <p className="pb-4 text-center text-xs text-muted">
          Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""} across your health history
        </p>
      ) : null}
    </div>
  )
}
