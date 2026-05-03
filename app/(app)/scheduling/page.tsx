"use client"

import { cn, formatTime, formatDate, getStatusColor } from "@/lib/utils"
import { Video, AlertTriangle, Stethoscope, Bot, Calendar, ChevronDown, MapPin, Clock } from "lucide-react"
import { useMemo, useState } from "react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsBriefCard, OpsEmptyState, OpsTabButton } from "@/components/ui/ops-primitives"
import Link from "next/link"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

type ViewMode = "today" | "upcoming" | "past"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

export default function SchedulingPage() {
  const [view, setView] = useState<ViewMode>("today")
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  if (!loading && !hasData) {
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
