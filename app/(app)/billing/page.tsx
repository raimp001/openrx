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
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
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
  const totalPatientResponsibility = useMemo(
    () => myClaims.reduce((sum, claim) => sum + claim.patient_responsibility, 0),
    [myClaims]
  )
  const topReviewClaim = useMemo(
    () =>
      [...readyToReview].sort((left, right) => {
        const leftScore =
          (left.status === "denied" ? 4 : 0) +
          (left.errors_detected.length > 0 ? 2 : 0) +
          (left.patient_responsibility > 0 ? 1 : 0)
        const rightScore =
          (right.status === "denied" ? 4 : 0) +
          (right.errors_detected.length > 0 ? 2 : 0) +
          (right.patient_responsibility > 0 ? 1 : 0)
        return rightScore - leftScore || right.total_amount - left.total_amount
      })[0] || null,
    [readyToReview]
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
        eyebrow="Coverage & billing"
        title="Understand your claims before they become bills."
        description="See what was billed, what insurance paid, what may be denied, and what needs a human review before you pay an unexpected balance."
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
              label="Review my claims"
              prompt="Review all my claims for billing errors, incorrect charges, and denial risks. Help me understand what I owe and flag anything that looks wrong."
              context={`Total claims: ${myClaims.length}, Denied: ${deniedClaims.length}, With issues: ${claimsWithIssues.length}`}
            />
            <AIAction
              agentId="billing"
              label="Help with appeals"
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

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
        <div className="overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(8,24,46,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">First claim to review</p>
              <h2 className="mt-4 max-w-xl font-serif text-[2.15rem] leading-[0.96] text-white">
                {topReviewClaim ? describeCPT(topReviewClaim.cpt_codes) || topReviewClaim.claim_number : "No urgent claim"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                {topReviewClaim
                  ? `${claimStatusLabel(topReviewClaim.status)} · patient share ${formatCurrency(topReviewClaim.patient_responsibility)}`
                  : "The current queue is stable. No denial or coding issue is leading the review lane."}
              </p>
            </div>
            <OpsBadge tone={topReviewClaim?.status === "denied" ? "red" : topReviewClaim?.errors_detected.length ? "gold" : "accent"} className="!border-white/12 !bg-white/10 !text-white">
              {topReviewClaim?.status === "denied" ? "urgent" : topReviewClaim?.errors_detected.length ? "review" : "stable"}
            </OpsBadge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Patient exposure</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(totalPatientResponsibility)}</p>
              <p className="mt-1 text-[12px] leading-6 text-white/64">Combined patient responsibility visible across the current claims set.</p>
            </div>
            <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Best next move</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {deniedClaims.length
                  ? "Start with denials"
                  : claimsWithIssues.length
                  ? "Review coding errors"
                  : readyToReview.length
                  ? "Watch processing claims"
                  : "Nothing urgent"}
              </p>
              <p className="mt-1 text-[12px] leading-6 text-white/64">
                {deniedClaims.length
                  ? "A denied claim is the fastest route to unexpected balances and patient confusion."
                  : claimsWithIssues.length
                  ? "Coding or billing issues should be cleaned up before a patient receives a confusing statement."
                  : readyToReview.length
                  ? "Pending claims are still moving, so the job is staying ahead of turnaround delays."
                  : "There is no immediate billing escalation in the queue right now."}
              </p>
            </div>
          </div>
        </div>
        <BriefingCard
          eyebrow="Denials"
          title={`${deniedClaims.length} in queue`}
          detail={deniedClaims.length ? "Start appeals before confusing balances reach the patient." : "No denial lane is open right now."}
          tone={deniedClaims.length ? "red" : "accent"}
        />
        <BriefingCard
          eyebrow="Coding issues"
          title={`${claimsWithIssues.length} flagged`}
          detail={claimsWithIssues.length ? "Review these before the patient receives a statement that is hard to explain." : "No coding or claim-construction issues are currently surfaced."}
          tone={claimsWithIssues.length ? "gold" : "accent"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <OpsPanel
          eyebrow="Claim queue"
          title="Review lane"
          description="Filter by status, scan the amounts quickly, and open the right AI action for each claim instead of digging through a table."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="chip gap-2"><Filter size={12} className="text-muted" /> Status</div>
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
                          <h3 className="text-lg font-serif text-primary">{describeCPT(claim.cpt_codes) || claim.claim_number}</h3>
                          <OpsBadge tone={statusTone as "terra" | "accent" | "blue" | "gold" | "red"}>{claimStatusLabel(claim.status)}</OpsBadge>
                          {hasIssues ? (
                            <OpsBadge tone="red">
                              <AlertTriangle size={12} /> {claim.errors_detected.length} issue{claim.errors_detected.length > 1 ? "s" : ""}
                            </OpsBadge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-muted">
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
                          <div className="rounded-2xl border border-amber-300/30 bg-amber-100/50 px-4 py-3 text-xs leading-5 text-primary">
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
          <OpsPanel eyebrow="Review first" title="What needs human attention" description="A short list the patient can understand immediately without reading the whole claim record.">
            <div className="space-y-3">
              <InsightRow label="Claims with issues" value={`${claimsWithIssues.length}`} detail={claimsWithIssues[0]?.claim_number ? `Most recent: ${claimsWithIssues[0].claim_number}` : "Nothing flagged right now."} tone={claimsWithIssues.length ? "red" : "accent"} />
              <InsightRow label="Denied claims" value={`${deniedClaims.length}`} detail={deniedClaims[0]?.denial_reason || "No denial explanations on file."} tone={deniedClaims.length ? "gold" : "accent"} />
              <InsightRow label="Needs review" value={`${readyToReview.length}`} detail={readyToReview.length ? "Processing claims and denials should be checked next." : "No urgent review queue."} tone={readyToReview.length ? "blue" : "accent"} />
            </div>
          </OpsPanel>

          <OpsPanel eyebrow="Patient snapshot" title="How this feels to the patient" description="Translate the billing state into plain next steps rather than payer jargon.">
            <div className="space-y-3 text-sm leading-6 text-secondary">
              <p>
                {deniedClaims.length
                  ? `You have ${deniedClaims.length} denied claim${deniedClaims.length > 1 ? "s" : ""}. Start there, because those claims are the most likely to generate confusing balances.`
                  : "No denied claims are currently on file, so the main focus is keeping pending claims moving."}
              </p>
              <p>
                {claimsWithIssues.length
                  ? `${claimsWithIssues.length} claim${claimsWithIssues.length > 1 ? "s have" : " has"} coding or billing issues flagged. Review before paying any unexpected balance.`
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
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">{label}</div>
      <div className="mt-2 text-lg font-semibold text-primary">{value}</div>
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
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-[22px] border px-4 py-3",
        tone === "red"
          ? "border-red-200/45 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))]"
          : tone === "gold"
            ? "border-amber-300/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.90))]"
            : tone === "blue"
              ? "border-[rgba(59,130,246,0.18)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))]"
              : "border-[rgba(82,108,139,0.12)] bg-white/90"
      )}
    >
      <div>
        <div className="text-sm font-semibold text-primary">{label}</div>
        <div className="mt-1 text-xs leading-5 text-muted">{detail}</div>
      </div>
      <OpsBadge tone={tone} className="shrink-0">{value}</OpsBadge>
    </div>
  )
}

function BriefingCard({
  eyebrow,
  title,
  detail,
  tone,
}: {
  eyebrow: string
  title: string
  detail: string
  tone: "terra" | "accent" | "blue" | "gold" | "red"
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-5 py-5",
        tone === "red"
          ? "border-red-200/45 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))]"
          : tone === "gold"
            ? "border-amber-300/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.90))]"
            : tone === "blue"
              ? "border-[rgba(59,130,246,0.18)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))]"
              : "border-[rgba(82,108,139,0.12)] bg-white/90"
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-serif leading-tight text-primary">{title}</div>
          <div className="mt-2 text-sm leading-6 text-secondary">{detail}</div>
        </div>
        <OpsBadge tone={tone} className="shrink-0">{tone === "accent" ? "stable" : tone === "blue" ? "watch" : tone === "gold" ? "review" : tone === "red" ? "urgent" : "active"}</OpsBadge>
      </div>
    </div>
  )
}
