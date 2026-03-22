"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, FileSearch, Filter, Receipt, XCircle } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsEmptyState, OpsMetricCard, OpsPanel, OpsTabButton } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

const CLAIM_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  processing: "Processing",
  paid: "Paid",
  approved: "Approved",
  denied: "Denied",
  pending: "Pending",
}

const CPT_DESCRIPTIONS: Record<string, string> = {
  "99395": "Preventive Visit",
  "99396": "Preventive Visit",
  "99213": "Office Visit",
  "99214": "Office Visit",
  "99215": "Office Visit",
  "80053": "Comprehensive Metabolic Panel",
  "80061": "Lipid Panel",
  "85025": "Complete Blood Count",
  "93000": "EKG / Electrocardiogram",
  "71046": "Chest X-Ray",
  "36415": "Blood Draw",
  "99232": "Hospital Follow-up",
}

function claimStatusLabel(s: string) {
  return CLAIM_STATUS_LABELS[s] ?? s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function describeCPT(codes: string[]) {
  const names = codes.map((code) => CPT_DESCRIPTIONS[code] ?? `CPT ${code}`)
  return Array.from(new Set(names)).join(", ")
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

export default function BillingPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const { snapshot, loading } = useLiveSnapshot()
  const myClaims = snapshot.claims

  const stats = useMemo(() => {
    const totalBilled = myClaims.reduce((sum, claim) => sum + claim.total_amount, 0)
    const totalPaid = myClaims
      .filter((claim) => claim.status === "paid" || claim.status === "approved")
      .reduce((sum, claim) => sum + claim.insurance_paid + claim.patient_responsibility, 0)
    const totalDenied = myClaims
      .filter((claim) => claim.status === "denied")
      .reduce((sum, claim) => sum + claim.total_amount, 0)
    const totalPending = myClaims
      .filter((claim) => ["submitted", "processing", "pending"].includes(claim.status))
      .reduce((sum, claim) => sum + claim.total_amount, 0)

    return { totalBilled, totalPaid, totalDenied, totalPending }
  }, [myClaims])

  const statuses = useMemo(() => Array.from(new Set(myClaims.map((claim) => claim.status))), [myClaims])

  const filtered = useMemo(() => {
    if (!statusFilter) return myClaims
    return myClaims.filter((claim) => claim.status === statusFilter)
  }, [myClaims, statusFilter])

  const claimsWithIssues = useMemo(() => myClaims.filter((claim) => claim.errors_detected.length > 0), [myClaims])
  const deniedClaims = useMemo(() => myClaims.filter((claim) => claim.status === "denied"), [myClaims])
  const readyToReview = useMemo(
    () => myClaims.filter((claim) => claim.status === "denied" || claim.errors_detected.length > 0 || claim.status === "processing"),
    [myClaims]
  )

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="surface-card p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <div className="surface-card p-5"><Skeleton className="h-[32rem] w-full" /></div>
          <div className="surface-card p-5"><Skeleton className="h-[32rem] w-full" /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Revenue integrity"
        title="Billing command center"
        description="Track what was billed, what cleared, and what Vera should escalate before a claim turns into patient friction."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone="terra">{myClaims.length} claims on file</OpsBadge>
            <OpsBadge tone={claimsWithIssues.length ? "red" : "accent"}>
              {claimsWithIssues.length} with coding issues
            </OpsBadge>
            <OpsBadge tone={deniedClaims.length ? "gold" : "blue"}>
              {deniedClaims.length} denied or appeal-ready
            </OpsBadge>
          </div>
        }
        actions={
          <>
            <AIAction
              agentId="billing"
              label="Analyze My Claims"
              prompt="Review all my claims for billing errors, incorrect charges, and denial risks. Help me understand what I owe and flag anything that looks wrong."
              context={`Total claims: ${myClaims.length}, Denied: ${deniedClaims.length}, With issues: ${claimsWithIssues.length}`}
            />
            <AIAction
              agentId="billing"
              label="Help With Appeals"
              prompt="For any denied claims, help me understand why they were denied and draft appeal letters on my behalf."
              variant="inline"
            />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard label="Total billed" value={formatCurrency(stats.totalBilled)} detail="Combined across all visible claims." icon={Receipt} tone="terra" />
        <OpsMetricCard label="Settled" value={formatCurrency(stats.totalPaid)} detail="Insurance plus patient responsibility already resolved." icon={CheckCircle2} tone="accent" />
        <OpsMetricCard label="In motion" value={formatCurrency(stats.totalPending)} detail="Claims still processing, submitted, or pending review." icon={Clock} tone="gold" />
        <OpsMetricCard label="At risk" value={formatCurrency(stats.totalDenied)} detail="Denied volume that needs explanation, appeal, or correction." icon={XCircle} tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <OpsPanel
          eyebrow="Claim queue"
          title="Review lane"
          description="Filter by status, scan the amounts quickly, and open the right AI action for each claim instead of digging through a table."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="chip gap-2"><Filter size={12} className="text-cloudy" /> Status</div>
              <OpsTabButton active={!statusFilter} onClick={() => setStatusFilter("")}>All</OpsTabButton>
              {statuses.map((status) => (
                <OpsTabButton key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                  {claimStatusLabel(status)}
                </OpsTabButton>
              ))}
            </div>
          }
        >
          {filtered.length === 0 ? (
            <OpsEmptyState
              icon={FileSearch}
              title="No claims match this filter"
              description={statusFilter ? `There are no ${claimStatusLabel(statusFilter).toLowerCase()} claims right now.` : "No billing claims have been recorded yet."}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((claim) => {
                const hasIssues = claim.errors_detected.length > 0
                const statusTone = claim.status === "denied" ? "red" : claim.status === "paid" || claim.status === "approved" ? "accent" : claim.status === "processing" || claim.status === "submitted" || claim.status === "pending" ? "gold" : "blue"
                return (
                  <article key={claim.id} className="surface-muted p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-serif text-warm-800">{describeCPT(claim.cpt_codes) || claim.claim_number}</h3>
                          <OpsBadge tone={statusTone as "terra" | "accent" | "blue" | "gold" | "red"}>{claimStatusLabel(claim.status)}</OpsBadge>
                          {hasIssues ? (
                            <OpsBadge tone="red">
                              <AlertTriangle size={12} /> {claim.errors_detected.length} issue{claim.errors_detected.length > 1 ? "s" : ""}
                            </OpsBadge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-cloudy">
                          <span className="chip">Claim {claim.claim_number}</span>
                          <span className="chip">DOS {formatDate(claim.date_of_service)}</span>
                          <span className="chip">ICD {claim.icd_codes.join(", ")}</span>
                        </div>
                        {claim.denial_reason ? (
                          <div className="rounded-2xl border border-soft-red/20 bg-soft-red/5 px-4 py-3 text-xs leading-5 text-soft-red">
                            {claim.denial_reason}
                          </div>
                        ) : null}
                        {hasIssues ? (
                          <div className="rounded-2xl border border-amber-300/30 bg-amber-100/50 px-4 py-3 text-xs leading-5 text-warm-700">
                            {claim.errors_detected.join(" • ")}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[18rem] lg:max-w-[20rem] lg:grid-cols-1">
                        <MiniAmount label="Claim total" value={formatCurrency(claim.total_amount)} />
                        <MiniAmount label="Insurance paid" value={formatCurrency(claim.insurance_paid)} />
                        <MiniAmount label="Patient cost" value={formatCurrency(claim.patient_responsibility)} />
                      </div>
                    </div>

                    {(claim.status === "denied" || hasIssues) ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <AIAction
                          agentId="billing"
                          label={claim.status === "denied" ? "Draft Appeal" : "Explain Issue"}
                          prompt={claim.status === "denied"
                            ? `Help me appeal denied claim ${claim.claim_number}. Denial reason: "${claim.denial_reason}". Explain what happened and draft an appeal.`
                            : `Explain the issues with claim ${claim.claim_number} in plain language and suggest what I should do.`}
                          context={`Claim: ${claim.claim_number}, CPT: ${claim.cpt_codes.join(",")}, ICD: ${claim.icd_codes.join(",")}, Amount: $${claim.total_amount}`}
                          variant="compact"
                        />
                        <AIAction
                          agentId="billing"
                          label="Patient-friendly summary"
                          prompt={`Rewrite claim ${claim.claim_number} into patient-friendly language, covering what was billed, what insurance covered, and what follow-up is needed.`}
                          context={`Status: ${claim.status}, total amount: ${claim.total_amount}, patient responsibility: ${claim.patient_responsibility}`}
                          variant="compact"
                        />
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </OpsPanel>

        <div className="space-y-4">
          <OpsPanel eyebrow="Vera focus" title="What needs human attention" description="A short list the patient can understand immediately without reading the whole ledger.">
            <div className="space-y-3">
              <InsightRow label="Claims with issues" value={`${claimsWithIssues.length}`} detail={claimsWithIssues[0]?.claim_number ? `Most recent: ${claimsWithIssues[0].claim_number}` : "Nothing flagged right now."} tone={claimsWithIssues.length ? "red" : "accent"} />
              <InsightRow label="Denied claims" value={`${deniedClaims.length}`} detail={deniedClaims[0]?.denial_reason || "No denial explanations on file."} tone={deniedClaims.length ? "gold" : "accent"} />
              <InsightRow label="Needs review" value={`${readyToReview.length}`} detail={readyToReview.length ? "Processing claims and denials should be checked next." : "No urgent review queue."} tone={readyToReview.length ? "blue" : "accent"} />
            </div>
          </OpsPanel>

          <OpsPanel eyebrow="Patient snapshot" title="How this feels to the patient" description="Translate the billing state into plain next steps rather than payer jargon.">
            <div className="space-y-3 text-sm leading-6 text-warm-600">
              <p>
                {deniedClaims.length
                  ? `You have ${deniedClaims.length} denied claim${deniedClaims.length > 1 ? "s" : ""}. Start there, because those claims are the most likely to generate confusing balances.`
                  : "No denied claims are currently on file, so the main focus is keeping pending claims moving."}
              </p>
              <p>
                {claimsWithIssues.length
                  ? `${claimsWithIssues.length} claim${claimsWithIssues.length > 1 ? "s have" : " has"} coding or billing issues flagged. Use Vera before paying any unexpected balance.`
                  : "No coding issues are flagged right now, which lowers the chance of downstream patient billing errors."}
              </p>
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  )
}

function MiniAmount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy/80">{label}</div>
      <div className="mt-2 text-lg font-semibold text-warm-800">{value}</div>
    </div>
  )
}

function InsightRow({
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
