"use client"

import { cn } from "@/lib/utils"
import {
  ArrowRightCircle, Clock, CheckCircle2, Calendar, Phone,
  AlertTriangle,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
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

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-64" /></div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-surface rounded-2xl border border-border p-4"><Skeleton className="h-14 w-full" /></div>)}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-surface rounded-2xl border border-border p-5"><Skeleton className="h-20 w-full" /></div>)}
        </div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-soft-blue/8 flex items-center justify-center">
          <ArrowRightCircle size={28} className="text-soft-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-primary">Referrals</h1>
          <p className="text-muted mt-1 max-w-sm">Connect your health record to track specialist referrals and appointments.</p>
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
        title="Referrals"
        description="Track your specialist referrals and appointments."
        actions={
          <AIAction
            agentId="coordinator"
            label="Track My Referrals"
            prompt="Give me a status update on all my specialist referrals, what's pending insurance auth, and what I need to do next to get these appointments scheduled."
            context={`Pending: ${pending.length}, Scheduled: ${scheduled.length}, Completed: ${completed.length}`}
          />
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface rounded-2xl p-4 border border-border">
          <Clock size={20} className="text-yellow-600 mb-2" />
          <div className="text-lg font-bold text-primary">{pending.length}</div>
          <div className="text-xs text-muted">Pending</div>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-border">
          <Calendar size={20} className="text-soft-blue mb-2" />
          <div className="text-lg font-bold text-primary">{scheduled.length}</div>
          <div className="text-xs text-muted">Scheduled</div>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-border">
          <CheckCircle2 size={20} className="text-accent mb-2" />
          <div className="text-lg font-bold text-primary">{completed.length}</div>
          <div className="text-xs text-muted">Completed</div>
        </div>
      </div>

      {/* Pending Insurance Alert */}
      {referrals.some((r) => !r.insurance_authorized && r.status !== "completed") && (
        <div className="bg-yellow-50 rounded-2xl border border-yellow-200/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">Insurance Authorization Needed</span>
          </div>
          {referrals
            .filter((r) => !r.insurance_authorized && r.status !== "completed")
            .map((r) => (
              <p key={r.id} className="text-xs text-secondary mt-1">
                {r.specialist_name} ({r.specialist_specialty}) — authorization pending from {insuranceProvider}
              </p>
            ))}
          <p className="text-[10px] text-muted mt-2">
            Rex (PA specialist) is working on getting these authorized.
          </p>
        </div>
      )}

      {/* Referral Cards */}
      <div className="space-y-3">
        {referrals.length === 0 && (
          <div className="bg-surface rounded-2xl border border-border flex flex-col items-center justify-center py-16 text-center gap-3">
            <ArrowRightCircle size={32} className="text-muted" />
            <p className="text-sm font-semibold text-secondary">No referrals on file</p>
            <p className="text-xs text-muted max-w-xs">When your doctor refers you to a specialist, it will appear here.</p>
          </div>
        )}
        {referrals.map((ref) => {
          const referringDoc = getPhysician(ref.referring_physician_id)

          return (
            <div
              key={ref.id}
              className="bg-surface rounded-2xl border border-border p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    ref.status === "completed" ? "bg-accent/10" :
                    ref.status === "scheduled" ? "bg-soft-blue/10" :
                    "bg-yellow-100"
                  )}>
                    <ArrowRightCircle size={18} className={
                      ref.status === "completed" ? "text-accent" :
                      ref.status === "scheduled" ? "text-soft-blue" :
                      "text-yellow-600"
                    } />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">
                      {ref.specialist_name}
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">{ref.specialist_specialty}</p>
                    <p className="text-[10px] text-muted mt-1">
                      Referred by {referringDoc?.full_name || "your doctor"} on{" "}
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                    ref.status === "completed" ? "bg-accent/10 text-accent" :
                    ref.status === "scheduled" ? "bg-soft-blue/10 text-soft-blue" :
                    "bg-yellow-100 text-yellow-700"
                  )}>
                    {ref.status === "scheduled" ? "Scheduled" : ref.status === "completed" ? "Completed" : "Pending"}
                  </span>
                  {ref.appointment_date && ref.status === "scheduled" && (
                    <div className="mt-1.5 bg-soft-blue/8 rounded-lg px-2 py-1 text-right">
                      <p className="text-[9px] font-bold text-soft-blue uppercase tracking-wide">Appt</p>
                      <p className="text-xs text-primary font-semibold">
                        {new Date(ref.appointment_date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="mt-3 ml-[52px]">
                <p className="text-xs text-primary">{ref.reason}</p>

                {/* Details */}
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted">
                  <a
                    href={`tel:${ref.specialist_phone}`}
                    className="flex items-center gap-1 hover:text-teal transition"
                  >
                    <Phone size={8} /> {ref.specialist_phone}
                  </a>
                  <span className={cn(
                    "flex items-center gap-1 font-semibold",
                    ref.insurance_authorized ? "text-accent" : "text-yellow-600"
                  )}>
                    {ref.insurance_authorized ? (
                      <><CheckCircle2 size={8} /> Insurance authorized</>
                    ) : (
                      <><Clock size={8} /> Authorization pending</>
                    )}
                  </span>
                  <span className={cn(
                    "font-bold uppercase",
                    ref.urgency === "stat" ? "text-soft-red" :
                    ref.urgency === "urgent" ? "text-yellow-600" :
                    "text-muted"
                  )}>
                    {ref.urgency}
                  </span>
                </div>

                {/* Notes */}
                {ref.notes && (
                  <p className="text-[10px] text-muted mt-2 italic">{ref.notes}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Insight */}
      <AIAction
        agentId="coordinator"
        label="Atlas' Referral Coordination"
        prompt="Review my specialist referrals and help me understand next steps, any pending insurance authorizations needed, and how each referral relates to my overall care plan."
        context={`Referrals — pending: ${pending.length}, scheduled: ${scheduled.length}, completed: ${completed.length}. ${pending.map(r => r.specialist_specialty).join(", ")} pending auth.`}
        variant="inline"
        className="bg-teal/5 rounded-2xl border border-teal/10 p-4"
      />
    </div>
  )
}
