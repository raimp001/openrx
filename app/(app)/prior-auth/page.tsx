"use client"

import { cn, formatDate, getStatusColor } from "@/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import Link from "next/link"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

export default function PriorAuthPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const myAuths = snapshot.priorAuths

  const hasData = !!snapshot.patient
  const pending = myAuths.filter(
    (p) => p.status === "pending" || p.status === "submitted"
  )
  const approved = myAuths.filter((p) => p.status === "approved")
  const denied = myAuths.filter((p) => p.status === "denied")

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2"><Skeleton className="h-8 w-44" /><Skeleton className="h-4 w-72" /></div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-pampas rounded-2xl border border-sand p-5"><Skeleton className="h-20 w-full" /></div>)}
        </div>
        <div className="bg-pampas rounded-2xl border border-sand divide-y divide-sand/50">
          <div className="px-5 py-3 bg-sand/20 border-b border-sand"><Skeleton className="h-4 w-40" /></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-5 w-5 rounded-full mt-0.5" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64" /><Skeleton className="h-3 w-40" /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center">
          <Clock size={28} className="text-yellow-600" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-warm-800">My Authorizations</h1>
          <p className="text-warm-500 mt-1 max-w-sm">Connect your health record to track prior authorizations and appeals.</p>
        </div>
        <Link href="/onboarding" className="px-5 py-2.5 bg-terra text-white text-sm font-semibold rounded-xl hover:bg-terra-dark transition">
          Get Started
        </Link>
      </div>
    )
  }

  const getIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 size={16} className="text-accent" />
      case "denied":
        return <XCircle size={16} className="text-soft-red" />
      case "submitted":
        return <Send size={16} className="text-soft-blue" />
      default:
        return <Clock size={16} className="text-yellow-400" />
    }
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        title="My Authorizations"
        description={
          <>
            {myAuths.length} total &middot;{" "}
            <span className="font-medium text-yellow-400">{pending.length} pending</span> &middot;{" "}
            <span className="font-medium text-accent">{approved.length} approved</span> &middot;{" "}
            <span className="font-medium text-soft-red">{denied.length} denied</span>
          </>
        }
        actions={
          <AIAction
            agentId="prior-auth"
            label="Check My PA Status"
            prompt="Check the status of all my pending and submitted prior authorizations. Let me know if any are overdue or need attention."
            context={`Pending: ${pending.length}, Denied: ${denied.length}`}
          />
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-900/20 rounded-2xl border border-yellow-700/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">
              Pending Review
            </span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">
            {pending.length}
          </div>
          <div className="text-xs text-yellow-400 mt-1">
            {pending.filter((p) => p.urgency === "urgent").length} urgent
          </div>
        </div>
        <div className="bg-accent/5 rounded-2xl border border-accent/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-accent" />
            <span className="text-sm font-bold text-accent">Approved</span>
          </div>
          <div className="text-3xl font-bold text-accent">
            {approved.length}
          </div>
          <div className="text-xs text-accent/70 mt-1">This period</div>
        </div>
        <div className="bg-soft-red/5 rounded-2xl border border-soft-red/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={18} className="text-soft-red" />
            <span className="text-sm font-bold text-soft-red">Denied</span>
          </div>
          <div className="text-3xl font-bold text-soft-red">
            {denied.length}
          </div>
          <div className="text-xs text-soft-red/70 mt-1">May need appeal</div>
        </div>
      </div>

      {/* PA List */}
      <div className="bg-pampas rounded-2xl border border-sand divide-y divide-sand/50">
        <div className="px-5 py-3 bg-sand/20 border-b border-sand">
          <h2 className="text-sm font-bold text-warm-700">
            All My Authorizations
          </h2>
        </div>
        {myAuths.map((pa) => {
          const physician = getPhysician(pa.physician_id)

          return (
            <div
              key={pa.id}
              className={cn(
                "px-5 py-4 hover:bg-sand/20 transition",
                pa.urgency === "urgent" &&
                  pa.status === "pending" &&
                  "border-l-2 border-l-soft-red"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5">{getIcon(pa.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-warm-800">
                      {pa.procedure_name}
                    </span>
                    <span className="text-xs text-warm-500 font-mono">
                      CPT {pa.procedure_code}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                        getStatusColor(pa.status)
                      )}
                    >
                      {pa.status}
                    </span>
                    {pa.urgency === "urgent" && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-soft-red">
                        <AlertTriangle size={10} />
                        URGENT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-warm-500 mt-1">
                    {physician?.full_name} &middot;{" "}
                    {pa.insurance_provider}
                  </p>
                  <p className="text-xs text-warm-500 mt-0.5">
                    ICD: {pa.icd_codes.join(", ")}
                  </p>
                  <p className="text-[11px] text-warm-600 mt-2 leading-relaxed">
                    {pa.clinical_notes}
                  </p>
                  {pa.denial_reason && (
                    <div className="mt-2 p-2.5 bg-soft-red/5 rounded-lg border border-soft-red/10">
                      <p className="text-[10px] font-bold text-soft-red uppercase tracking-wider mb-0.5">
                        Denial Reason
                      </p>
                      <p className="text-xs text-soft-red">
                        {pa.denial_reason}
                      </p>
                      <AIAction
                        agentId="prior-auth"
                        label="Help Me Appeal"
                        prompt={`Help me understand and appeal the denial for my prior authorization ${pa.reference_number}. Denial reason: "${pa.denial_reason}". What are my options?`}
                        context={`Procedure: ${pa.procedure_name} (${pa.procedure_code}), ICD: ${pa.icd_codes.join(",")}, Insurer: ${pa.insurance_provider}`}
                        variant="compact"
                        className="mt-2"
                      />
                    </div>
                  )}
                  {(pa.status === "pending" || pa.status === "submitted") && (
                    <AIAction
                      agentId="prior-auth"
                      label={pa.status === "pending" ? "Submit for Me" : "Check Status"}
                      prompt={pa.status === "pending"
                        ? `Submit my prior authorization for ${pa.procedure_name} to ${pa.insurance_provider}. Make sure all required clinical documentation is included.`
                        : `Check the current status of my PA ${pa.reference_number} with ${pa.insurance_provider}. Let me know if there are any updates.`}
                      context={`CPT: ${pa.procedure_code}, Insurer: ${pa.insurance_provider}`}
                      variant="compact"
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="text-right shrink-0">
                  {pa.reference_number && (
                    <div className="text-[10px] font-mono text-cloudy">
                      {pa.reference_number}
                    </div>
                  )}
                  {pa.submitted_at && (
                    <div className="text-[10px] text-cloudy mt-0.5">
                      Submitted {formatDate(pa.submitted_at)}
                    </div>
                  )}
                  {pa.resolved_at && (
                    <div className="text-[10px] text-cloudy mt-0.5">
                      Resolved {formatDate(pa.resolved_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
