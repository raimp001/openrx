"use client"

import { cn, formatDate } from "@/lib/utils"
import { ArrowRightCircle, Clock, CheckCircle2, Calendar, Phone, AlertTriangle } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsBriefCard, OpsEmptyState, OpsPanel } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import Link from "next/link"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

export default function ReferralsPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const referrals = snapshot.referrals
  const insuranceProvider = snapshot.patient?.insurance_provider || "your insurer"

  const hasData = !!snapshot.patient
  const pending = referrals.filter((r) => r.status === "pending")
  const scheduled = referrals.filter((r) => r.status === "scheduled")
  const completed = referrals.filter((r) => r.status === "completed")
  const prioritizedReferrals = [...referrals].sort((left, right) => {
    const score = (item: (typeof referrals)[number]) => {
      if (item.status === "pending" && !item.insurance_authorized) return 0
      if (item.urgency === "stat") return 1
      if (item.urgency === "urgent") return 2
      if (item.status === "scheduled") return 3
      if (item.status === "completed") return 5
      return 4
    }

    return score(left) - score(right)
  })
  const primaryReferral = prioritizedReferrals[0] || null
  const authBacklog = referrals.filter((r) => !r.insurance_authorized && r.status !== "completed").length

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-5">
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-soft-blue/8">
          <ArrowRightCircle size={28} className="text-soft-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-primary">Referrals</h1>
          <p className="mt-1 max-w-sm text-muted">
            Connect your health record to track specialist referrals and appointments.
          </p>
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
        eyebrow="Specialist access"
        title="Referrals"
        description="See which specialist visits are waiting on insurance, which appointments are booked, and what needs to happen next."
        meta={
          <>
            <OpsBadge tone="gold">{authBacklog} authorization blocker{authBacklog !== 1 ? "s" : ""}</OpsBadge>
            <OpsBadge tone="blue">{scheduled.length} specialist visit{scheduled.length !== 1 ? "s" : ""} booked</OpsBadge>
          </>
        }
        actions={
          <AIAction
            agentId="coordinator"
            label="Track My Referrals"
            prompt="Give me a status update on all my specialist referrals, what's pending insurance auth, and what I need to do next to get these appointments scheduled."
            context={`Pending: ${pending.length}, Scheduled: ${scheduled.length}, Completed: ${completed.length}`}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <OpsBriefCard
          label="Move this first"
          title={primaryReferral ? `${primaryReferral.specialist_specialty} with ${primaryReferral.specialist_name}` : "No referral selected"}
          detail={
            primaryReferral
              ? `${primaryReferral.insurance_authorized ? "Authorization complete" : "Authorization pending"} · ${primaryReferral.urgency.toUpperCase()}`
              : "New referrals will appear here as they are created."
          }
          tone="gold"
        />
        <OpsBriefCard
          label="Referral status"
          title={`${pending.length} pending, ${scheduled.length} scheduled`}
          detail="Pending referrals are sorted ahead of completed visits so unfinished next steps stay visible."
          tone="blue"
        />
        <OpsBriefCard
          label="Insurance pressure"
          title={`${authBacklog} referral${authBacklog !== 1 ? "s" : ""} waiting on authorization`}
          detail={`OpenRx is tracking ${insuranceProvider} friction so the first follow-up call is obvious.`}
          tone="terra"
        />
      </div>

      {authBacklog > 0 ? (
        <div className="rounded-2xl border border-yellow-200/50 bg-yellow-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">Insurance Authorization Needed</span>
          </div>
          {referrals
            .filter((r) => !r.insurance_authorized && r.status !== "completed")
            .map((r) => (
              <p key={r.id} className="mt-1 text-xs text-secondary">
                {r.specialist_name} ({r.specialist_specialty}) — authorization pending from {insuranceProvider}
              </p>
            ))}
          <p className="mt-2 text-[10px] text-muted">
            Authorization follow-up should happen before routine scheduling.
          </p>
        </div>
      ) : null}

      <OpsPanel
        eyebrow="Referral queue"
        title="Specialist visits ordered by urgency"
        description="The queue prioritizes unresolved authorizations and urgent specialty access ahead of already-booked or completed visits."
      >
        <div className="space-y-3">
          {prioritizedReferrals.length === 0 ? (
            <OpsEmptyState
              icon={ArrowRightCircle}
              title="No referrals on file"
              description="When your care team sends you to a specialist, it will appear here with authorization and scheduling context."
            />
          ) : null}

          {prioritizedReferrals.map((ref) => {
            const referringDoc = getPhysician(ref.referring_physician_id)

            return (
              <div key={ref.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        ref.status === "completed"
                          ? "bg-accent/10"
                          : ref.status === "scheduled"
                            ? "bg-soft-blue/10"
                            : "bg-yellow-100"
                      )}
                    >
                      <ArrowRightCircle
                        size={18}
                        className={
                          ref.status === "completed"
                            ? "text-accent"
                            : ref.status === "scheduled"
                              ? "text-soft-blue"
                              : "text-yellow-600"
                        }
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{ref.specialist_name}</h3>
                      <p className="mt-0.5 text-xs text-secondary">{ref.specialist_specialty}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        Referred by {referringDoc?.full_name || "your doctor"} on {formatDate(ref.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                        ref.status === "completed"
                          ? "bg-accent/10 text-accent"
                          : ref.status === "scheduled"
                            ? "bg-soft-blue/10 text-soft-blue"
                            : "bg-yellow-100 text-yellow-700"
                      )}
                    >
                      {ref.status === "scheduled" ? "Scheduled" : ref.status === "completed" ? "Completed" : "Pending"}
                    </span>
                    {ref.appointment_date && ref.status === "scheduled" ? (
                      <div className="mt-1.5 rounded-lg bg-soft-blue/8 px-2 py-1 text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-soft-blue">Appt</p>
                        <p className="text-xs font-semibold text-primary">{formatDate(ref.appointment_date)}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="ml-[52px] mt-3">
                  <p className="text-xs text-primary">{ref.reason}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
                    <a href={`tel:${ref.specialist_phone}`} className="flex items-center gap-1 transition hover:text-teal">
                      <Phone size={8} /> {ref.specialist_phone}
                    </a>
                    <span className={cn("flex items-center gap-1 font-semibold", ref.insurance_authorized ? "text-accent" : "text-yellow-600")}>
                      {ref.insurance_authorized ? (
                        <>
                          <CheckCircle2 size={8} /> Insurance authorized
                        </>
                      ) : (
                        <>
                          <Clock size={8} /> Authorization pending
                        </>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-bold uppercase",
                        ref.urgency === "stat" ? "text-soft-red" : ref.urgency === "urgent" ? "text-yellow-600" : "text-muted"
                      )}
                    >
                      {ref.urgency}
                    </span>
                    {ref.status === "scheduled" ? (
                      <span className="flex items-center gap-1 text-soft-blue">
                        <Calendar size={8} /> {ref.appointment_date ? formatDate(ref.appointment_date) : "Visit pending"}
                      </span>
                    ) : null}
                  </div>

                  {ref.notes ? <p className="mt-2 text-[10px] italic text-muted">{ref.notes}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      </OpsPanel>

      <AIAction
        agentId="coordinator"
        label="Atlas' Referral Coordination"
        prompt="Review my specialist referrals and help me understand next steps, any pending insurance authorizations needed, and how each referral relates to my overall care plan."
        context={`Referrals — pending: ${pending.length}, scheduled: ${scheduled.length}, completed: ${completed.length}. ${pending.map((r) => r.specialist_specialty).join(", ")} pending auth.`}
        variant="inline"
        className="rounded-2xl border border-teal/10 bg-teal/5 p-4"
      />
    </div>
  )
}
