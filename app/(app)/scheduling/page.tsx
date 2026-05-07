"use client"

import { cn, formatTime, formatDate, getStatusColor } from "@/lib/utils"
import { Video, AlertTriangle, Stethoscope, Bot, Calendar, ChevronDown, MapPin, Clock, CalendarCheck, Phone, ExternalLink, CheckCircle2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsBriefCard, OpsEmptyState, OpsTabButton } from "@/components/ui/ops-primitives"
import Link from "next/link"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import {
  SCHEDULING_HANDOFF_STORAGE_KEY,
  isFreshCareHandoff,
  safeSessionGetItem,
  safeSessionRemoveItem,
  type SchedulingHandoffPayload,
} from "@/lib/care-handoff"

type ViewMode = "today" | "upcoming" | "past"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

function parseSchedulingHandoff(raw: string | null): SchedulingHandoffPayload | null {
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as Partial<SchedulingHandoffPayload>
    if (!payload.providerName || !payload.reason || !isFreshCareHandoff(payload.createdAt)) return null
    return {
      source: payload.source === "screening" || payload.source === "chat" ? payload.source : "provider",
      providerName: payload.providerName,
      providerKind: payload.providerKind || "provider",
      specialty: payload.specialty || undefined,
      npi: payload.npi || undefined,
      phone: payload.phone || undefined,
      fullAddress: payload.fullAddress || undefined,
      reason: payload.reason,
      query: payload.query || undefined,
      createdAt: payload.createdAt || Date.now(),
    }
  } catch {
    return null
  }
}

function parseSchedulingHandoffFromParams(params: URLSearchParams): SchedulingHandoffPayload | null {
  if (params.get("handoff") !== "provider") return null
  const providerName = params.get("providerName")?.trim()
  const reason = params.get("reason")?.trim()
  if (!providerName || !reason) return null
  return {
    source:
      params.get("source") === "screening" || params.get("source") === "chat"
        ? params.get("source") as "screening" | "chat"
        : "provider",
    providerName,
    providerKind: params.get("providerKind") || "provider",
    specialty: params.get("specialty") || undefined,
    npi: params.get("npi") || undefined,
    phone: params.get("phone") || undefined,
    fullAddress: params.get("fullAddress") || undefined,
    reason,
    query: params.get("query") || undefined,
    createdAt: Date.now(),
  }
}

function buildSchedulingWindows() {
  const labels = ["Tomorrow morning", "Next weekday midday", "Next weekday afternoon"]
  return labels.map((label, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index + 1)
    date.setHours(index === 0 ? 9 : index === 1 ? 11 : 14, index === 1 ? 30 : 0, 0, 0)
    return `${label} · ${formatDate(date.toISOString())} at ${formatTime(date.toISOString())}`
  })
}

export default function SchedulingPage() {
  const [view, setView] = useState<ViewMode>("today")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [schedulingHandoff, setSchedulingHandoff] = useState<SchedulingHandoffPayload | null>(null)
  const [requestStatus, setRequestStatus] = useState("")
  const { snapshot, getPhysician, loading } = useLiveSnapshot()

  const hasData = !!snapshot.patient
  const myAppointments = snapshot.appointments
  const today = new Date().toDateString()

  const { todayApts, upcomingApts, pastApts } = useMemo(() => {
    const now = new Date()
    const sorted = [...myAppointments].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )

    return {
      todayApts: sorted.filter((a) => new Date(a.scheduled_at).toDateString() === today),
      upcomingApts: sorted.filter(
        (a) => new Date(a.scheduled_at) > now && new Date(a.scheduled_at).toDateString() !== today
      ),
      pastApts: sorted
        .filter((a) => new Date(a.scheduled_at) < now && new Date(a.scheduled_at).toDateString() !== today)
        .reverse(),
    }
  }, [today, myAppointments])

  const activeList = view === "today" ? todayApts : view === "upcoming" ? upcomingApts : pastApts
  const nextAppointment = todayApts[0] || upcomingApts[0] || null
  const telehealthCount = myAppointments.filter((apt) => apt.type === "telehealth").length
  const todaysAttention = todayApts.filter((apt) => ["pending", "checked-in", "in-progress"].includes(apt.status)).length
  const schedulingWindows = useMemo(() => buildSchedulingWindows(), [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const fromParams = parseSchedulingHandoffFromParams(params)
    const stored = parseSchedulingHandoff(safeSessionGetItem(SCHEDULING_HANDOFF_STORAGE_KEY))
    safeSessionRemoveItem(SCHEDULING_HANDOFF_STORAGE_KEY)
    const nextHandoff = fromParams || stored
    if (nextHandoff) {
      setSchedulingHandoff(nextHandoff)
      setRequestStatus("")
      setView("upcoming")
    }
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    todayApts.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1
    })
    return counts
  }, [todayApts])

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <div className="rounded-2xl border border-border bg-surface">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/50 px-5 py-4 last:border-b-0">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-1.5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!loading && !hasData && !schedulingHandoff) {
    return (
      <div className="animate-slide-up flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/5">
          <Calendar size={28} className="text-teal" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-primary">My Appointments</h1>
          <p className="mt-1 max-w-sm text-muted">Connect your health record to view and manage your appointments.</p>
        </div>
        <Link href="/onboarding" className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-dark">
          Get Started
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Visit coordination"
        title="My Appointments"
        description="See what is happening today, what comes next, and which visits still need preparation or a scheduling decision."
        meta={
          <>
            <OpsBadge tone="blue">{todayApts.length} today</OpsBadge>
            <OpsBadge tone="accent">{upcomingApts.length} upcoming</OpsBadge>
            <OpsBadge tone="terra">{telehealthCount} telehealth</OpsBadge>
          </>
        }
        actions={
          <>
            <AIAction
              agentId="scheduling"
              label="Find Open Slots"
              prompt="Check physician availability for the next 7 days and suggest appointment slots that work for me. Consider my insurance network and copay estimates."
              context={`Today's appointments: ${todayApts.length}, Upcoming: ${upcomingApts.length}`}
            />
            <AIAction
              agentId="scheduling"
              label="Send Me Reminders"
              prompt="Send me reminders for my upcoming appointments. Include time, physician name, location, and copay estimate."
              variant="inline"
            />
          </>
        }
      />

      {schedulingHandoff ? (
        <section
          data-testid="scheduling-handoff-card"
          className="surface-card border-teal/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,250,247,0.88))] p-5 sm:p-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-title">Scheduling handoff</p>
              <h2 className="mt-3 text-2xl font-serif text-primary">Ready to request this visit.</h2>
              <p className="mt-3 text-sm leading-7 text-secondary">
                OpenRx carried the provider and recommendation context here so you do not have to search again.
                This creates a scheduling request, not a confirmed appointment, until the provider verifies availability and ordering/referral requirements.
              </p>
              <div className="mt-4 rounded-[22px] border border-[rgba(82,108,139,0.12)] bg-white/82 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-teal">
                    {schedulingHandoff.providerKind}
                  </span>
                  {schedulingHandoff.specialty ? <span className="chip">{schedulingHandoff.specialty}</span> : null}
                  {schedulingHandoff.npi ? <span className="chip">NPI {schedulingHandoff.npi}</span> : null}
                </div>
                <p className="mt-3 text-lg font-semibold text-primary">{schedulingHandoff.providerName}</p>
                <p className="mt-2 text-sm leading-6 text-secondary">{schedulingHandoff.reason}</p>
                {schedulingHandoff.fullAddress ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <MapPin size={12} />
                    {schedulingHandoff.fullAddress}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="w-full rounded-[24px] border border-[rgba(82,108,139,0.12)] bg-white/78 p-4 lg:max-w-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Preferred windows</p>
              <div className="mt-3 space-y-2">
                {schedulingWindows.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setRequestStatus(`Scheduling request staged for ${slot}. Call or send this request to confirm.`)}
                    className="flex w-full items-center gap-2 rounded-2xl border border-border bg-surface/50 px-3 py-2 text-left text-xs font-semibold text-primary transition hover:border-teal/30 hover:bg-teal/5"
                  >
                    <CalendarCheck size={13} className="text-teal" />
                    {slot}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="scheduling-request-button"
                  onClick={() => setRequestStatus("Scheduling request staged. Next: call the provider, send the referral/order context, and confirm coverage before the visit.")}
                  className="control-button-primary px-4 py-2 text-xs"
                >
                  <CheckCircle2 size={13} />
                  Request appointment
                </button>
                {schedulingHandoff.phone ? (
                  <a
                    href={`tel:${schedulingHandoff.phone.replace(/[^\d+]/g, "")}`}
                    className="control-button-secondary px-4 py-2 text-xs"
                  >
                    <Phone size={13} />
                    Call
                  </a>
                ) : null}
                {schedulingHandoff.fullAddress ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedulingHandoff.fullAddress)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="control-button-secondary px-4 py-2 text-xs"
                  >
                    <ExternalLink size={13} />
                    Map
                  </a>
                ) : null}
              </div>
              {requestStatus ? <p className="mt-3 text-xs leading-6 text-accent">{requestStatus}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <OpsBriefCard
          label="Next on deck"
          title={nextAppointment ? `${formatDate(nextAppointment.scheduled_at)} · ${formatTime(nextAppointment.scheduled_at)}` : "No upcoming visit scheduled"}
          detail={
            nextAppointment
              ? `${nextAppointment.reason} · ${getPhysician(nextAppointment.physician_id)?.full_name || "Provider pending"}`
              : "Use provider search or AI scheduling to book the next step."
          }
          tone="blue"
        />
        <OpsBriefCard
          label="Today’s visits"
          title={`${todaysAttention} visit${todaysAttention !== 1 ? "s" : ""} need active management`}
          detail="Pending, checked-in, and in-progress visits are grouped here so it is clear what still needs attention."
          tone="terra"
        />
        <OpsBriefCard
          label="Visit history"
          title={`${pastApts.length} past visit${pastApts.length !== 1 ? "s" : ""} captured in the record`}
          detail="Use past visits and details to prepare follow-up rather than treating each appointment as an isolated card."
          tone="accent"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
              getStatusColor(status)
            )}
          >
            {count} {status}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(["today", "upcoming", "past"] as ViewMode[]).map((value) => (
            <OpsTabButton key={value} active={view === value} onClick={() => setView(value)}>
              {value}
            </OpsTabButton>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface">
        {activeList.length === 0 ? (
          <div className="px-4 py-4">
            <OpsEmptyState
              icon={Calendar}
              title={view === "today" ? "No appointments today" : view === "upcoming" ? "No upcoming appointments" : "No past appointments"}
              description={
                view === "past"
                  ? "Past visits will appear here as your record fills in."
                  : "Use provider search or AI scheduling to line up the next care step."
              }
            />
            {view !== "past" ? (
              <div className="mt-3 flex gap-2">
                <Link
                  href="/providers"
                  className="flex items-center gap-1.5 rounded-xl border border-teal/20 px-3 py-2 text-xs font-semibold text-teal transition hover:bg-teal/5"
                >
                  <Stethoscope size={13} />
                  Find a Doctor
                </Link>
                <Link
                  href="/chat"
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-secondary transition hover:bg-border/30"
                >
                  <Bot size={13} />
                  Ask AI to Schedule
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeList.map((apt) => {
          const physician = getPhysician(apt.physician_id)
          const isExpanded = expandedId === apt.id

          return (
            <div key={apt.id} className="border-b border-border/50 last:border-b-0">
              <button
                onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-border/20"
                aria-expanded={isExpanded}
              >
                <div className="w-20 shrink-0 text-center">
                  <div className="text-sm font-bold text-primary">{formatTime(apt.scheduled_at)}</div>
                  <div className="text-[10px] text-muted">{apt.duration_minutes}min</div>
                </div>

                <div
                  className={cn(
                    "h-10 w-1.5 shrink-0 rounded-full",
                    apt.status === "completed"
                      ? "bg-accent"
                      : apt.status === "in-progress"
                        ? "bg-teal"
                        : apt.status === "checked-in"
                          ? "bg-yellow-400"
                          : apt.status === "no-show"
                            ? "bg-soft-red"
                            : "bg-border"
                  )}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        getStatusColor(apt.status)
                      )}
                    >
                      {apt.status}
                    </span>
                    {apt.type === "urgent" ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-soft-red">
                        <AlertTriangle size={10} />
                        URGENT
                      </span>
                    ) : null}
                    {apt.type === "telehealth" ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-soft-blue">
                        <Video size={10} />
                        TELEHEALTH
                      </span>
                    ) : null}
                    {apt.type === "new-patient" ? <span className="text-[10px] font-bold text-accent">NEW</span> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{apt.reason}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-primary">{physician?.full_name}</p>
                  <p className="text-[10px] text-muted">{physician?.specialty}</p>
                </div>

                {view !== "today" ? (
                  <div className="w-24 shrink-0 text-right text-xs text-muted">{formatDate(apt.scheduled_at)}</div>
                ) : null}

                <ChevronDown size={14} className={cn("shrink-0 text-muted transition-transform", isExpanded && "rotate-180")} />
              </button>

              {isExpanded ? (
                <div className="ml-[6.5rem] border-t border-border/30 px-5 pb-4 pt-0 animate-fade-in">
                  <div className="grid gap-3 py-3 sm:grid-cols-3">
                    <div className="flex items-start gap-2">
                      <Clock size={13} className="mt-0.5 shrink-0 text-muted" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Duration</p>
                        <p className="text-sm text-primary">{apt.duration_minutes} minutes</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Stethoscope size={13} className="mt-0.5 shrink-0 text-muted" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Provider</p>
                        <p className="text-sm text-primary">{physician?.full_name}</p>
                        <p className="text-xs text-muted">{physician?.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-muted" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Type</p>
                        <p className="text-sm capitalize text-primary">{apt.type || "In-person"}</p>
                      </div>
                    </div>
                  </div>
                  {apt.notes ? <p className="mt-1 text-xs italic leading-5 text-secondary">{apt.notes}</p> : null}
                  <div className="mt-3 flex gap-2">
                    <AIAction
                      agentId="scheduling"
                      label="Reschedule"
                      prompt={`Help me reschedule my ${apt.reason} appointment on ${formatDate(apt.scheduled_at)} at ${formatTime(apt.scheduled_at)} with ${physician?.full_name || "my doctor"}.`}
                      variant="compact"
                    />
                    <AIAction
                      agentId="scheduling"
                      label="Prepare for visit"
                      prompt={`What should I bring and prepare for my ${apt.reason} appointment with ${physician?.full_name || "my doctor"} on ${formatDate(apt.scheduled_at)}?`}
                      variant="compact"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
