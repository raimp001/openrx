"use client"

import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatDate, formatTime } from "@/lib/utils"
import Link from "next/link"
import { useState, useMemo } from "react"
import {
  Calendar, Pill, FlaskConical, Activity, MessageSquare,
  Syringe, ArrowRightCircle, Receipt, ShieldCheck, Heart,
  Clock, ChevronRight,
} from "lucide-react"

type EventCategory = "all" | "appointments" | "medications" | "labs" | "vitals" | "messages" | "vaccinations" | "referrals" | "billing"

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

const CATEGORY_META: Record<Exclude<EventCategory, "all">, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  appointments: { label: "Appointments", icon: Calendar, color: "text-terra", bg: "bg-terra/10", border: "border-terra/20" },
  medications:  { label: "Medications",  icon: Pill, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
  labs:         { label: "Labs",         icon: FlaskConical, color: "text-soft-blue", bg: "bg-soft-blue/10", border: "border-soft-blue/20" },
  vitals:       { label: "Vitals",       icon: Activity, color: "text-accent", bg: "bg-accent/8", border: "border-accent/15" },
  messages:     { label: "Messages",     icon: MessageSquare, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200/50" },
  vaccinations: { label: "Vaccinations", icon: Syringe, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200/50" },
  referrals:    { label: "Referrals",    icon: ArrowRightCircle, color: "text-soft-blue", bg: "bg-soft-blue/8", border: "border-soft-blue/15" },
  billing:      { label: "Billing",      icon: Receipt, color: "text-warm-600", bg: "bg-sand/40", border: "border-sand/80" },
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
  const { snapshot, getPhysician } = useLiveSnapshot()
  const [activeFilter, setActiveFilter] = useState<EventCategory>("all")

  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = []

    // Appointments
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

    // Medications (use start_date)
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

    // Labs
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

    // Vitals
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

    // Messages
    for (const msg of snapshot.messages) {
      all.push({
        id: `msg-${msg.id}`,
        date: msg.created_at,
        category: "messages",
        title: msg.sender_type === "patient" ? "You sent a message" : "Message received",
        subtitle: msg.content.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content,
        detail: `via ${msg.channel}`,
        status: msg.read ? "read" : "unread",
        href: "/messages",
        urgent: !msg.read && msg.sender_type !== "patient",
      })
    }

    // Vaccinations
    for (const vax of snapshot.vaccinations) {
      const date = vax.administered_at || vax.due_at || vax.next_due
      if (!date) continue
      all.push({
        id: `vax-${vax.id}`,
        date,
        category: "vaccinations",
        title: vax.vaccine_name,
        subtitle: vax.administered_at
          ? `Dose ${vax.dose_number}/${vax.total_doses} · ${vax.facility}`
          : `Due — ${vax.status}`,
        detail: vax.administered_at ? undefined : `Contact your provider to schedule`,
        status: vax.status,
        href: "/vaccinations",
        urgent: vax.status === "overdue",
      })
    }

    // Referrals
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

    // Billing claims
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
    () => activeFilter === "all" ? events : events.filter((e) => e.category === activeFilter),
    [events, activeFilter]
  )

  // Group by month
  const grouped = useMemo(() => {
    const groups: { label: string; events: TimelineEvent[] }[] = []
    let current: { label: string; events: TimelineEvent[] } | null = null
    for (const ev of filtered) {
      const d = new Date(ev.date)
      const label = Number.isNaN(d.getTime())
        ? "Unknown"
        : d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      if (!current || current.label !== label) {
        current = { label, events: [] }
        groups.push(current)
      }
      current.events.push(ev)
    }
    return groups
  }, [filtered])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length }
    for (const ev of events) counts[ev.category] = (counts[ev.category] || 0) + 1
    return counts
  }, [events])

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={18} className="text-terra" />
          <h1 className="text-2xl font-serif text-warm-800">Health Timeline</h1>
        </div>
        <p className="text-sm text-warm-500">
          Every health event, chronologically — appointments, labs, medications, vitals, and more.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              activeFilter === key
                ? "bg-terra text-white shadow-sm"
                : "border border-sand/80 bg-cream/80 text-warm-600 hover:border-terra/30 hover:text-terra"
            )}
          >
            {label}
            {categoryCounts[key] !== undefined && (
              <span className={cn("ml-1.5 text-[10px]", activeFilter === key ? "text-white/70" : "text-cloudy")}>
                {categoryCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <Clock size={32} className="text-sand mx-auto mb-3" />
          <p className="text-sm text-warm-500">No events found</p>
          <p className="text-xs text-cloudy mt-1">Your health history will appear here as data is added.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.label}>
              {/* Month label */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">{group.label}</span>
                <div className="flex-1 h-px bg-sand/60" />
                <span className="text-[10px] text-cloudy">{group.events.length} event{group.events.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Events in this month */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[18px] top-4 bottom-4 w-px bg-sand/60" />

                <div className="space-y-3">
                  {group.events.map((ev) => {
                    const meta = CATEGORY_META[ev.category]
                    const Icon = meta.icon
                    const d = new Date(ev.date)
                    const isValidDate = !Number.isNaN(d.getTime())
                    return (
                      <Link
                        key={ev.id}
                        href={ev.href}
                        className={cn(
                          "relative flex items-start gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
                          ev.urgent
                            ? "border-soft-red/15 bg-soft-red/3 hover:border-soft-red/25"
                            : "border-sand/70 bg-white/60 hover:border-terra/20 hover:bg-white/80"
                        )}
                      >
                        {/* Dot on timeline */}
                        <div className={cn(
                          "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                          meta.bg, meta.border
                        )}>
                          <Icon size={14} className={meta.color} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-warm-800 leading-tight">{ev.title}</span>
                                {ev.urgent && (
                                  <span className="text-[9px] font-bold text-soft-red bg-soft-red/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                    Needs attention
                                  </span>
                                )}
                                {ev.status && (
                                  <span className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                                    ev.status === "completed" || ev.status === "paid" || ev.status === "active"
                                      ? "bg-accent/10 text-accent"
                                      : ev.status === "denied" || ev.status === "overdue"
                                      ? "bg-soft-red/10 text-soft-red"
                                      : ev.status === "pending" || ev.status === "submitted"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-sand/60 text-warm-600"
                                  )}>
                                    {ev.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-warm-500 mt-0.5 truncate">{ev.subtitle}</p>
                              {ev.detail && (
                                <p className="text-[11px] text-cloudy mt-0.5">{ev.detail}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] text-warm-500 font-medium">
                                {isValidDate ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                              </p>
                              <p className="text-[10px] text-cloudy">
                                {isValidDate ? formatTime(ev.date) : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        <ChevronRight size={14} className="text-cloudy shrink-0 self-center" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-center text-xs text-cloudy pb-4">
          Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""} across your health history
        </p>
      )}
    </div>
  )
}
