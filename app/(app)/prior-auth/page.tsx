"use client"

import { useState } from "react"
import { currentUser } from "@/lib/current-user"
import { priorAuths, getPhysician, type PriorAuth } from "@/lib/seed-data"
import { cn, formatDate } from "@/lib/utils"
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import PAAppealModal from "@/components/pa-appeal-modal"

interface TimelineStep {
  label: string
  sublabel?: string
  done: boolean
  active: boolean
  failed?: boolean
}

function getTimeline(pa: PriorAuth): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: "Submitted",
      sublabel: pa.submitted_at ? formatDate(pa.submitted_at) : undefined,
      done: !!pa.submitted_at,
      active: pa.status === "submitted" && !pa.resolved_at,
    },
    {
      label: "Received by Insurer",
      sublabel: pa.submitted_at ? formatDate(new Date(new Date(pa.submitted_at).getTime() + 86400000).toISOString()) : undefined,
      done: pa.status !== "submitted" || !!pa.resolved_at,
      active: pa.status === "pending",
    },
    {
      label: "Under Review",
      sublabel: pa.status === "pending" ? "Est. 3–14 business days" : undefined,
      done: pa.status === "approved" || pa.status === "denied",
      active: pa.status === "pending",
      failed: false,
    },
    {
      label: pa.status === "denied" ? "Denied" : pa.status === "approved" ? "Approved" : "Decision",
      sublabel: pa.resolved_at ? formatDate(pa.resolved_at) : pa.status === "submitted" || pa.status === "pending" ? estimateDecision(pa) : undefined,
      done: !!pa.resolved_at,
      active: false,
      failed: pa.status === "denied",
    },
  ]
  return steps
}

function estimateDecision(pa: PriorAuth): string {
  if (!pa.submitted_at) return "Pending submission"
  const submitted = new Date(pa.submitted_at)
  const businessDays = pa.urgency === "urgent" ? 3 : 14
  const est = new Date(submitted)
  est.setDate(est.getDate() + businessDays)
  return `Est. by ${est.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

function urgencyLabel(pa: PriorAuth): string {
  if (pa.urgency === "urgent") return "Urgent — insurer must respond within 72 hrs"
  return "Standard — insurer must respond within 14 days"
}

export default function PriorAuthPage() {
  const myAuths = priorAuths.filter((pa) => pa.patient_id === currentUser.id)
  const [expanded, setExpanded] = useState<string | null>(myAuths[0]?.id ?? null)
  const [appealingPA, setAppealingPA] = useState<PriorAuth | null>(null)

  const pending = myAuths.filter((p) => p.status === "pending" || p.status === "submitted")
  const approved = myAuths.filter((p) => p.status === "approved")
  const denied = myAuths.filter((p) => p.status === "denied")

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 size={16} className="text-accent" />
      case "denied": return <XCircle size={16} className="text-soft-red" />
      case "submitted": return <Send size={16} className="text-soft-blue" />
      default: return <Clock size={16} className="text-yellow-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-accent/10 text-accent",
      denied: "bg-soft-red/10 text-soft-red",
      submitted: "bg-soft-blue/10 text-soft-blue",
      pending: "bg-yellow-900/20 text-yellow-400",
    }
    return map[status] || "bg-sand/30 text-cloudy"
  }

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">My Authorizations</h1>
          <p className="text-sm text-warm-500 mt-1">
            {myAuths.length} total &middot;{" "}
            <span className="text-yellow-400 font-medium">{pending.length} pending</span>
            {" "}&middot;{" "}
            <span className="text-accent font-medium">{approved.length} approved</span>
            {" "}&middot;{" "}
            <span className="text-soft-red font-medium">{denied.length} denied</span>
          </p>
        </div>
        <AIAction
          agentId="prior-auth"
          label="Check My PA Status"
          prompt="Check the status of all my pending and submitted prior authorizations. Let me know if any are overdue or need attention."
          context={`Pending: ${pending.length}, Denied: ${denied.length}`}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-900/20 rounded-2xl border border-yellow-700/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">Pending Review</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{pending.length}</div>
          <div className="text-xs text-yellow-400/70 mt-1">
            {pending.filter((p) => p.urgency === "urgent").length} urgent
          </div>
        </div>
        <div className="bg-accent/5 rounded-2xl border border-accent/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-accent" />
            <span className="text-sm font-bold text-accent">Approved</span>
          </div>
          <div className="text-3xl font-bold text-accent">{approved.length}</div>
          <div className="text-xs text-accent/70 mt-1">This period</div>
        </div>
        <div className="bg-soft-red/5 rounded-2xl border border-soft-red/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={18} className="text-soft-red" />
            <span className="text-sm font-bold text-soft-red">Denied</span>
          </div>
          <div className="text-3xl font-bold text-soft-red">{denied.length}</div>
          <div className="text-xs text-soft-red/70 mt-1">May need appeal</div>
        </div>
      </div>

      {/* PA Cards with Timeline */}
      <div className="space-y-3">
        {myAuths.map((pa) => {
          const physician = getPhysician(pa.physician_id)
          const isOpen = expanded === pa.id
          const timeline = getTimeline(pa)

          return (
            <div
              key={pa.id}
              className={cn(
                "bg-pampas rounded-2xl border transition-all",
                pa.status === "denied" ? "border-soft-red/20" :
                pa.urgency === "urgent" && pa.status === "pending" ? "border-yellow-600/30" :
                "border-sand"
              )}
            >
              {/* Header row — always visible */}
              <button
                onClick={() => setExpanded(isOpen ? null : pa.id)}
                className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-sand/20 transition rounded-2xl"
              >
                <div className="mt-0.5 shrink-0">{getStatusIcon(pa.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-warm-800">{pa.procedure_name}</span>
                    <span className="text-xs text-warm-500 font-mono">CPT {pa.procedure_code}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide", getStatusBadge(pa.status))}>
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
                    {physician?.full_name} &middot; {pa.insurance_provider}
                    {pa.reference_number && <span className="font-mono"> &middot; {pa.reference_number}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-cloudy">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-5 border-t border-sand/50 pt-4">

                  {/* Timeline */}
                  <div>
                    <p className="text-[10px] font-bold text-cloudy uppercase tracking-widest mb-3">Progress</p>
                    <div className="relative flex items-start gap-0">
                      {timeline.map((step, i) => (
                        <div key={i} className="flex-1 relative">
                          {i < timeline.length - 1 && (
                            <div className={cn(
                              "absolute top-3.5 left-1/2 right-0 h-0.5",
                              step.done ? "bg-accent" : "bg-sand"
                            )} />
                          )}
                          <div className="flex flex-col items-center relative z-10">
                            <div className={cn(
                              "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0",
                              step.failed ? "border-soft-red bg-soft-red/10" :
                              step.done ? "border-accent bg-accent/10" :
                              step.active ? "border-terra bg-terra/10 animate-pulse" :
                              "border-sand bg-cream"
                            )}>
                              {step.failed ? (
                                <XCircle size={12} className="text-soft-red" />
                              ) : step.done ? (
                                <CheckCircle2 size={12} className="text-accent" />
                              ) : step.active ? (
                                <Clock size={12} className="text-terra" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-sand" />
                              )}
                            </div>
                            <div className="text-center mt-2 px-1">
                              <p className={cn(
                                "text-[10px] font-bold",
                                step.failed ? "text-soft-red" :
                                step.done ? "text-warm-700" :
                                step.active ? "text-terra" : "text-cloudy"
                              )}>
                                {step.label}
                              </p>
                              {step.sublabel && (
                                <p className="text-[9px] text-cloudy mt-0.5">{step.sublabel}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {(pa.status === "pending" || pa.status === "submitted") && (
                      <p className="text-[10px] text-warm-500 mt-3 text-center">
                        {urgencyLabel(pa)}
                      </p>
                    )}
                  </div>

                  {/* Clinical notes */}
                  <div className="bg-cream/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-cloudy uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <FileText size={10} />
                      Clinical Notes
                    </p>
                    <p className="text-xs text-warm-600 leading-relaxed">{pa.clinical_notes}</p>
                    <p className="text-[10px] text-cloudy mt-1.5">
                      ICD codes: {pa.icd_codes.join(", ")}
                    </p>
                  </div>

                  {/* Denial reason + appeal */}
                  {pa.denial_reason && (
                    <div className="p-3 bg-soft-red/5 rounded-xl border border-soft-red/10">
                      <p className="text-[10px] font-bold text-soft-red uppercase tracking-widest mb-1.5">
                        Denial Reason
                      </p>
                      <p className="text-xs text-soft-red leading-relaxed">{pa.denial_reason}</p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <button
                          onClick={() => setAppealingPA(pa)}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-soft-red hover:bg-soft-red/90 px-3 py-1.5 rounded-lg transition"
                        >
                          <FileText size={10} />
                          Generate Appeal Letter
                        </button>
                        <AIAction
                          agentId="prior-auth"
                          label="Help Me Appeal"
                          prompt={`Help me understand and appeal the denial for my prior authorization. Denial reason: "${pa.denial_reason}". What are my strongest arguments and what documentation should I gather?`}
                          context={`Procedure: ${pa.procedure_name} (${pa.procedure_code}), ICD: ${pa.icd_codes.join(",")}, Insurer: ${pa.insurance_provider}`}
                          variant="compact"
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions for pending/submitted */}
                  {(pa.status === "pending" || pa.status === "submitted") && (
                    <div className="flex gap-2 flex-wrap">
                      <AIAction
                        agentId="prior-auth"
                        label={pa.status === "pending" ? "Submit for Me" : "Check Status"}
                        prompt={pa.status === "pending"
                          ? `Submit my prior authorization for ${pa.procedure_name} to ${pa.insurance_provider}. Ensure all required clinical documentation is included.`
                          : `Check the current status of my PA ${pa.reference_number} with ${pa.insurance_provider}. Are there updates or additional info needed?`}
                        context={`CPT: ${pa.procedure_code}, Insurer: ${pa.insurance_provider}`}
                        variant="compact"
                      />
                      <AIAction
                        agentId="prior-auth"
                        label="View Requirements"
                        prompt={`What clinical documentation does ${pa.insurance_provider} typically require for prior authorization of ${pa.procedure_name} (CPT ${pa.procedure_code})? What are common reasons for denial I should avoid?`}
                        variant="compact"
                      />
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand text-[10px] font-semibold text-warm-500 hover:border-terra/30 hover:text-terra transition">
                        <Eye size={10} />
                        Track Online
                      </button>
                    </div>
                  )}

                  {/* Approved */}
                  {pa.status === "approved" && (
                    <div className="flex items-center gap-1.5 text-[11px] text-accent">
                      <CheckCircle2 size={11} />
                      <span>Approved &middot; Valid 180 days from approval date</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* PA Appeal Modal */}
      {appealingPA && (
        <PAAppealModal
          pa={appealingPA}
          patientName={currentUser.full_name}
          physicianName={getPhysician(appealingPA.physician_id)?.full_name}
          onClose={() => setAppealingPA(null)}
        />
      )}
    </div>
  )
}
