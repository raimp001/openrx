"use client"

import { cn, formatTime, formatDate, getStatusColor } from "@/lib/utils"
import { Video, AlertTriangle, Stethoscope, Bot, Calendar, ChevronDown, MapPin, Clock } from "lucide-react"
import { useState, useMemo } from "react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import Link from "next/link"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

type ViewMode = "today" | "upcoming" | "past"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

export default function SchedulingPage() {
  const [view, setView] = useState<ViewMode>("today")
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

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const activeList = view === "today" ? todayApts : view === "upcoming" ? upcomingApts : pastApts

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
          <div className="space-y-2"><Skeleton className="h-8 w-44" /><Skeleton className="h-4 w-56" /></div>
          <div className="flex gap-2"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-36" /></div>
        </div>
        <div className="flex gap-2"><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-7 w-20 rounded-full" /></div>
        <Skeleton className="h-10 w-60 rounded-xl" />
        <div className="surface-card divide-y divide-border/50">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="w-1.5 h-10 rounded-full" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-40" /></div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-teal/5 flex items-center justify-center">
          <Calendar size={28} className="text-teal" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-primary">My Appointments</h1>
          <p className="text-muted mt-1 max-w-sm">Connect your health record to view and manage your appointments.</p>
        </div>
        <Link href="/onboarding" className="px-5 py-2.5 bg-teal text-white text-sm font-semibold rounded-xl hover:bg-teal-dark transition">
          Get Started
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        title="My Appointments"
        description={`${todayApts.length} appointments today · ${upcomingApts.length} upcoming`}
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

      {/* Today Status Summary */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className={cn(
              "text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide",
              getStatusColor(status)
            )}
          >
            {count} {status}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex bg-surface border border-border rounded-xl overflow-hidden">
          {(["today", "upcoming", "past"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-4 py-2 text-sm font-semibold transition-all capitalize",
                view === v
                  ? "bg-teal text-white"
                  : "text-secondary hover:text-primary hover:bg-border/30"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment List */}
      <div className="surface-card divide-y divide-border/50">
        {activeList.length === 0 && (
          <div className="flex flex-col items-center py-14 gap-3">
            <div className="w-12 h-12 rounded-full bg-border/40 flex items-center justify-center">
              <Calendar size={22} className="text-muted" />
            </div>
            <p className="text-sm font-semibold text-secondary">
              {view === "today" ? "No appointments today" : view === "upcoming" ? "No upcoming appointments" : "No past appointments"}
            </p>
            {view !== "past" && (
              <div className="flex gap-2 mt-1">
                <Link
                  href="/providers"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-teal border border-teal/20 hover:bg-teal/5 transition"
                >
                  <Stethoscope size={13} />
                  Find a Doctor
                </Link>
                <Link
                  href="/chat"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-secondary border border-border hover:bg-border/30 transition"
                >
                  <Bot size={13} />
                  Ask AI to Schedule
                </Link>
              </div>
            )}
          </div>
        )}
        {activeList.map((apt) => {
          const physician = getPhysician(apt.physician_id)
          const isExpanded = expandedId === apt.id
          return (
            <div key={apt.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                className="flex w-full items-center gap-4 px-5 py-4 hover:bg-border/20 transition text-left"
                aria-expanded={isExpanded}
              >
                {/* Time */}
                <div className="w-20 shrink-0 text-center">
                  <div className="text-sm font-bold text-primary">
                    {formatTime(apt.scheduled_at)}
                  </div>
                  <div className="text-[10px] text-muted">
                    {apt.duration_minutes}min
                  </div>
                </div>

                {/* Status bar */}
                <div
                  className={cn(
                    "w-1.5 h-10 rounded-full shrink-0",
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

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                        getStatusColor(apt.status)
                      )}
                    >
                      {apt.status}
                    </span>
                    {apt.type === "urgent" && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-soft-red">
                        <AlertTriangle size={10} />
                        URGENT
                      </span>
                    )}
                    {apt.type === "telehealth" && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-soft-blue">
                        <Video size={10} />
                        TELEHEALTH
                      </span>
                    )}
                    {apt.type === "new-patient" && (
                      <span className="text-[10px] font-bold text-accent">NEW</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {apt.reason}
                  </p>
                </div>

                {/* Physician */}
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-primary">
                    {physician?.full_name}
                  </p>
                  <p className="text-[10px] text-muted">{physician?.specialty}</p>
                </div>

                {/* Date (for non-today) */}
                {view !== "today" && (
                  <div className="text-xs text-muted shrink-0 w-24 text-right">
                    {formatDate(apt.scheduled_at)}
                  </div>
                )}

                <ChevronDown size={14} className={cn("text-muted shrink-0 transition-transform", isExpanded && "rotate-180")} />
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-0 ml-[6.5rem] border-t border-border/30 animate-fade-in">
                  <div className="grid gap-3 sm:grid-cols-3 py-3">
                    <div className="flex items-start gap-2">
                      <Clock size={13} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Duration</p>
                        <p className="text-sm text-primary">{apt.duration_minutes} minutes</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Stethoscope size={13} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Provider</p>
                        <p className="text-sm text-primary">{physician?.full_name}</p>
                        <p className="text-xs text-muted">{physician?.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Type</p>
                        <p className="text-sm text-primary capitalize">{apt.type || "In-person"}</p>
                      </div>
                    </div>
                  </div>
                  {apt.notes && (
                    <p className="text-xs text-secondary leading-5 mt-1 italic">{apt.notes}</p>
                  )}
                  <div className="flex gap-2 mt-3">
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
