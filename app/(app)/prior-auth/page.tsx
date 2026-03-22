"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertTriangle, ClipboardList, Clock, ShieldAlert, ShieldCheck, XCircle } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsEmptyState, OpsMetricCard, OpsPanel, OpsTabButton } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatDate } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  approved: "Approved",
  denied: "Denied",
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/\b\w/g, (char) => char.toUpperCase())
}

function statusTone(status: string): "terra" | "accent" | "blue" | "gold" | "red" {
  switch (status) {
    case "approved":
      return "accent"
    case "denied":
      return "red"
    case "submitted":
      return "blue"
    default:
      return "gold"
  }
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

export default function PriorAuthPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const myAuths = snapshot.priorAuths
  const hasData = Boolean(snapshot.patient)

  const pending = useMemo(
    () => myAuths.filter((auth) => auth.status === "pending" || auth.status === "submitted"),
    [myAuths]
  )
  const approved = useMemo(() => myAuths.filter((auth) => auth.status === "approved"), [myAuths])
  const denied = useMemo(() => myAuths.filter((auth) => auth.status === "denied"), [myAuths])
  const urgent = useMemo(
    () => myAuths.filter((auth) => auth.urgency === "urgent" || auth.urgency === "stat"),
    [myAuths]
  )
  const readyToAppeal = useMemo(
    () => myAuths.filter((auth) => auth.status === "denied" || Boolean(auth.denial_reason)),
    [myAuths]
  )

  const statuses = useMemo(() => Array.from(new Set(myAuths.map((auth) => auth.status))), [myAuths])
  const filteredAuths = useMemo(() => {
    if (!statusFilter) return myAuths
    return myAuths.filter((auth) => auth.status === statusFilter)
  }, [myAuths, statusFilter])

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="surface-card p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <div className="surface-card p-5"><Skeleton className="h-[34rem] w-full" /></div>
          <div className="surface-card p-5"><Skeleton className="h-[34rem] w-full" /></div>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="animate-slide-up space-y-6">
        <AppPageHeader
          eyebrow="Utilization review"
          title="Prior authorization board"
          description="Track insurer approvals, denials, and appeal-ready requests without waiting for a callback chain."
        />
        <div className="surface-card p-6">
          <OpsEmptyState
            icon={ShieldAlert}
            title="No authorization data is connected yet"
            description="Connect your record first, then this board will track pending authorizations, denials, and appeal opportunities automatically."
          />
          <div className="mt-5 flex justify-center">
            <Link href="/onboarding" className="control-button-primary">
              Connect my record
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Utilization review"
        title="Prior authorization board"
        description="Rex keeps the queue readable: what is waiting on payer review, what is already cleared, and what is blocked by a denial that needs a real appeal."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone={pending.length ? "gold" : "accent"}>{pending.length} in motion</OpsBadge>
            <OpsBadge tone={denied.length ? "red" : "accent"}>{denied.length} denied</OpsBadge>
            <OpsBadge tone={urgent.length ? "blue" : "terra"}>{urgent.length} urgent or stat</OpsBadge>
          </div>
        }
        actions={
          <>
            <AIAction
              agentId="prior-auth"
              label="Check My PA Status"
              prompt="Review my prior authorization queue, tell me which cases are still pending, and point out anything overdue or likely to be denied."
              context={`Total authorizations: ${myAuths.length}, pending or submitted: ${pending.length}, denied: ${denied.length}`}
            />
            <Link href="/prior-auth/audit" className="control-button-secondary">
              View audit trail
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard
          label="Pending review"
          value={`${pending.length}`}
          detail="Requests still waiting on payer action or initial submission."
          icon={Clock}
          tone={pending.length ? "gold" : "accent"}
        />
        <OpsMetricCard
          label="Approved"
          value={`${approved.length}`}
          detail="Cases already cleared and ready to move forward."
          icon={ShieldCheck}
          tone="accent"
        />
        <OpsMetricCard
          label="Denied"
          value={`${denied.length}`}
          detail="Cases that need a patient-friendly explanation or appeal package."
          icon={XCircle}
          tone={denied.length ? "red" : "accent"}
        />
        <OpsMetricCard
          label="Urgent queue"
          value={`${urgent.length}`}
          detail="Urgent or stat requests that should be reviewed first."
          icon={AlertTriangle}
          tone={urgent.length ? "blue" : "terra"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <OpsPanel
          eyebrow="Authorization lane"
          title="Case review queue"
          description="Use the status tabs to collapse the queue fast, then open the right AI action for each case instead of reading payer jargon line by line."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <OpsTabButton active={!statusFilter} onClick={() => setStatusFilter("")}>All</OpsTabButton>
              {statuses.map((status) => (
                <OpsTabButton key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                  {statusLabel(status)}
                </OpsTabButton>
              ))}
            </div>
          }
        >
          {filteredAuths.length === 0 ? (
            <OpsEmptyState
              icon={ClipboardList}
              title="No authorizations match this filter"
              description={
                statusFilter
                  ? `There are no ${statusLabel(statusFilter).toLowerCase()} prior authorizations right now.`
                  : "No prior authorization cases are on file yet."
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredAuths.map((auth) => {
                const physician = getPhysician(auth.physician_id)
                const urgentLabel = auth.urgency === "stat" ? "STAT" : auth.urgency === "urgent" ? "URGENT" : null

                return (
                  <article key={auth.id} className="surface-muted p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-serif text-warm-800">{auth.procedure_name}</h3>
                          <OpsBadge tone={statusTone(auth.status)}>{statusLabel(auth.status)}</OpsBadge>
                          {urgentLabel ? <OpsBadge tone="red">{urgentLabel}</OpsBadge> : null}
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-cloudy">
                          <span className="chip">CPT {auth.procedure_code}</span>
                          <span className="chip">{auth.insurance_provider}</span>
                          <span className="chip">ICD {auth.icd_codes.join(", ")}</span>
                          {physician ? <span className="chip">{physician.full_name}</span> : null}
                        </div>

                        <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm leading-6 text-warm-700">
                          {auth.clinical_notes || "No clinical rationale has been captured for this authorization yet."}
                        </div>

                        {auth.denial_reason ? (
                          <div className="rounded-2xl border border-soft-red/20 bg-soft-red/5 px-4 py-3 text-sm leading-6 text-soft-red">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-soft-red/80">Denial reason</div>
                            <div className="mt-1">{auth.denial_reason}</div>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid min-w-full gap-3 sm:grid-cols-2 lg:min-w-[18rem] lg:max-w-[20rem] lg:grid-cols-1">
                        <MetaCard label="Reference" value={auth.reference_number || "Not assigned"} />
                        <MetaCard label="Submitted" value={auth.submitted_at ? formatDate(auth.submitted_at) : "Not submitted"} />
                        <MetaCard label="Resolved" value={auth.resolved_at ? formatDate(auth.resolved_at) : "Still open"} />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {auth.status === "denied" ? (
                        <AIAction
                          agentId="prior-auth"
                          label="Help Me Appeal"
                          prompt={`Help me understand and appeal the denial for prior authorization ${auth.reference_number || auth.procedure_code}. Denial reason: "${auth.denial_reason || "Not supplied"}".`}
                          context={`Procedure: ${auth.procedure_name} (${auth.procedure_code}), insurer: ${auth.insurance_provider}, ICD codes: ${auth.icd_codes.join(", ")}`}
                          variant="compact"
                        />
                      ) : null}
                      {auth.status === "pending" || auth.status === "submitted" ? (
                        <AIAction
                          agentId="prior-auth"
                          label={auth.status === "pending" ? "Prepare Submission" : "Check Status"}
                          prompt={
                            auth.status === "pending"
                              ? `Prepare the prior authorization submission for ${auth.procedure_name}. Summarize what documentation should be attached before sending it to ${auth.insurance_provider}.`
                              : `Check the likely status posture for prior authorization ${auth.reference_number || auth.procedure_code} with ${auth.insurance_provider} and tell me what to do next.`
                          }
                          context={`Procedure: ${auth.procedure_name} (${auth.procedure_code}), urgency: ${auth.urgency}, insurer: ${auth.insurance_provider}`}
                          variant="compact"
                        />
                      ) : null}
                      <AIAction
                        agentId="prior-auth"
                        label="Plain-language summary"
                        prompt={`Rewrite this prior authorization case into patient-friendly language: procedure ${auth.procedure_name}, status ${auth.status}, insurer ${auth.insurance_provider}, notes ${auth.clinical_notes}.`}
                        context={`Reference: ${auth.reference_number || "none"}, denial: ${auth.denial_reason || "none"}`}
                        variant="compact"
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </OpsPanel>

        <div className="space-y-4">
          <OpsPanel
            eyebrow="Rex focus"
            title="What needs attention first"
            description="A quick read on what should move next instead of forcing the patient to infer the workflow from insurer language."
          >
            <div className="space-y-3">
              <FocusItem
                label="Appeal-ready"
                value={`${readyToAppeal.length}`}
                detail={
                  readyToAppeal[0]?.procedure_name
                    ? `${readyToAppeal[0].procedure_name} is already blocked by a denial or explanation.`
                    : "No appeal-ready cases right now."
                }
                tone={readyToAppeal.length ? "red" : "accent"}
              />
              <FocusItem
                label="Waiting on payer"
                value={`${pending.length}`}
                detail={
                  pending[0]?.procedure_name
                    ? `${pending[0].procedure_name} is the next case to check for turnaround.`
                    : "No payer review queue at the moment."
                }
                tone={pending.length ? "gold" : "accent"}
              />
              <FocusItem
                label="Urgent requests"
                value={`${urgent.length}`}
                detail={
                  urgent.length
                    ? "Urgent and stat requests should be handled before routine utilization review."
                    : "No urgent requests are open."
                }
                tone={urgent.length ? "blue" : "accent"}
              />
            </div>
          </OpsPanel>

          <OpsPanel
            eyebrow="Patient framing"
            title="What this means in plain language"
            description="Translate the queue into immediate next steps the patient can actually act on."
          >
            <div className="space-y-3 text-sm leading-6 text-warm-600">
              <p>
                {denied.length
                  ? `You have ${denied.length} denied authorization${denied.length === 1 ? "" : "s"}. Start there, because those are the cases most likely to delay care unless someone prepares an appeal.`
                  : "No denials are currently blocking care, so the main job is keeping pending requests moving."}
              </p>
              <p>
                {pending.length
                  ? `${pending.length} request${pending.length === 1 ? " is" : "s are"} still in motion. Use Rex to decide whether the next step is submission cleanup, payer follow-up, or documentation support.`
                  : "There is no live payer queue right now, which means the next priority is confirming already-approved care gets scheduled."}
              </p>
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  )
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy/80">{label}</div>
      <div className="mt-2 text-sm font-semibold text-warm-800">{value}</div>
    </div>
  )
}

function FocusItem({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: "terra" | "accent" | "blue" | "gold" | "red"
}) {
  return (
    <div className="surface-muted flex items-start justify-between gap-3 px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-warm-800">{label}</div>
        <div className="mt-1 text-xs leading-5 text-cloudy">{detail}</div>
      </div>
      <OpsBadge tone={tone} className="shrink-0">{value}</OpsBadge>
    </div>
  )
}
