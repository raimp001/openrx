"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FlaskConical,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsEmptyState, OpsMetricCard, OpsPanel } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatDate } from "@/lib/utils"

function RangeBar({
  value,
  referenceRange,
  flag,
}: {
  value: string
  referenceRange?: string
  flag: string
}) {
  const match = referenceRange?.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/)
  if (!match) return null

  const low = parseFloat(match[1])
  const high = parseFloat(match[2])
  const numericValue = parseFloat(value)
  if (Number.isNaN(numericValue) || Number.isNaN(low) || Number.isNaN(high)) return null

  const pad = (high - low) * 0.6
  const minScale = low - pad
  const maxScale = high + pad
  const scale = maxScale - minScale
  const valuePct = Math.max(2, Math.min(98, ((numericValue - minScale) / scale) * 100))
  const normalStart = ((low - minScale) / scale) * 100
  const normalWidth = ((high - low) / scale) * 100
  const dotColor = flag === "normal" ? "#1FA971" : flag === "critical" ? "#DC2626" : "#D1495B"

  return (
    <div className="relative mt-2 h-1.5 w-full max-w-[9rem] rounded-full bg-border/30" role="img" aria-label={`Value ${value}, range ${referenceRange}`}>
      <div className="absolute h-full rounded-full bg-accent/20" style={{ left: `${normalStart}%`, width: `${normalWidth}%` }} />
      <div
        className="absolute top-1/2 h-2.5 w-2.5 rounded-full border-2 border-white shadow"
        style={{
          left: `${valuePct}%`,
          transform: "translate(-50%, -50%)",
          background: dotColor,
        }}
      />
    </div>
  )
}

function FlagBadge({ flag }: { flag: string }) {
  if (flag === "normal") {
    return <CheckCircle2 size={14} className="text-accent" />
  }

  if (flag === "critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white">
        Critical
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]",
        flag === "high" ? "bg-soft-red/10 text-soft-red" : "bg-soft-blue/10 text-soft-blue"
      )}
    >
      {flag === "high" ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {flag}
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

export default function LabResultsPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const labs = snapshot.labResults
  const hasData = Boolean(snapshot.patient)
  const [expandedLab, setExpandedLab] = useState<string | null>(labs[0]?.id || null)

  const pendingLabs = useMemo(() => labs.filter((lab) => lab.status === "pending"), [labs])
  const resultedLabs = useMemo(() => labs.filter((lab) => lab.status !== "pending"), [labs])
  const abnormalCount = useMemo(
    () => resultedLabs.reduce((count, lab) => count + lab.results.filter((result) => result.flag !== "normal").length, 0),
    [resultedLabs]
  )
  const criticalCount = useMemo(
    () => resultedLabs.reduce((count, lab) => count + lab.results.filter((result) => result.flag === "critical").length, 0),
    [resultedLabs]
  )
  const reviewedCount = useMemo(
    () => resultedLabs.filter((lab) => lab.status === "reviewed").length,
    [resultedLabs]
  )
  const abnormalLabs = useMemo(
    () => resultedLabs.filter((lab) => lab.results.some((result) => result.flag !== "normal")),
    [resultedLabs]
  )

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
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
          eyebrow="Diagnostics"
          title="Lab results board"
          description="Keep pending tests, abnormal values, and clinician notes in one place instead of forcing patients to decode isolated PDFs."
        />
        <div className="surface-card p-6">
          <OpsEmptyState
            icon={FlaskConical}
            title="No lab data is connected yet"
            description="Connect your health record first, then Atlas will organize pending tests, abnormal values, and clinician notes here."
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
        eyebrow="Diagnostics"
        title="Lab results board"
        description="Atlas turns the result feed into a readable clinical board: what is still processing, what is abnormal, and what deserves a focused discussion with a clinician."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone="blue">{labs.length} total tests</OpsBadge>
            <OpsBadge tone={pendingLabs.length ? "gold" : "accent"}>{pendingLabs.length} pending</OpsBadge>
            <OpsBadge tone={abnormalCount ? "red" : "accent"}>{abnormalCount} abnormal values</OpsBadge>
            {criticalCount ? <OpsBadge tone="red">{criticalCount} critical</OpsBadge> : null}
          </div>
        }
        actions={
          <AIAction
            agentId="coordinator"
            label="Interpret My Labs"
            prompt={`Explain my lab results in plain language. I have ${abnormalCount} abnormal values out of ${labs.length} tests. For each abnormal result, tell me what it means, why it matters, and what I should discuss with my doctor.`}
            context={`Abnormal values: ${resultedLabs.flatMap((lab) => lab.results.filter((result) => result.flag !== "normal")).map((result) => `${result.name}: ${result.value}${result.unit || ""} (${result.flag})`).join(", ")}`}
          />
        }
      />

      {criticalCount > 0 ? (
        <div className="surface-card border-red-400/30 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))] p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="eyebrow-pill border-red-300/30 bg-red-500/10 text-red-600">Critical values detected</div>
              <p className="mt-3 text-sm leading-6 text-red-700">
                {criticalCount} critical value{criticalCount === 1 ? " requires" : "s require"} immediate attention. This should not wait for a routine portal reply.
              </p>
            </div>
            <AlertTriangle className="shrink-0 text-red-600" size={18} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard
          label="Total tests"
          value={`${labs.length}`}
          detail="Combined pending and resulted lab panels on file."
          icon={FlaskConical}
          tone="blue"
        />
        <OpsMetricCard
          label="Pending"
          value={`${pendingLabs.length}`}
          detail="Tests that have been ordered but not fully resulted yet."
          icon={Clock}
          tone={pendingLabs.length ? "gold" : "accent"}
        />
        <OpsMetricCard
          label="Abnormal"
          value={`${abnormalCount}`}
          detail="Results outside the reference range, including low, high, and critical."
          icon={AlertTriangle}
          tone={abnormalCount ? "red" : "accent"}
        />
        <OpsMetricCard
          label="Reviewed"
          value={`${reviewedCount}`}
          detail="Result sets already marked as reviewed by a clinician."
          icon={CheckCircle2}
          tone="accent"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <OpsPanel
          eyebrow="Results lane"
          title="Diagnostic feed"
          description="Expand a panel to inspect each value, reference range, clinician note, and the AI explanation without leaving the page."
        >
          {resultedLabs.length === 0 ? (
            <OpsEmptyState
              icon={FlaskConical}
              title="No resulted labs yet"
              description={pendingLabs.length ? "Tests are still processing. As results arrive, they will appear here with abnormal flags and clinician notes." : "Your lab results will appear here after tests are ordered and processed."}
            />
          ) : (
            <div className="space-y-3">
              {resultedLabs.map((lab) => {
                const physician = getPhysician(lab.physician_id)
                const isExpanded = expandedLab === lab.id
                const abnormalResults = lab.results.filter((result) => result.flag !== "normal")
                const criticalResults = lab.results.filter((result) => result.flag === "critical")
                const hasAbnormal = abnormalResults.length > 0

                return (
                  <article
                    key={lab.id}
                    className={cn(
                      "surface-muted overflow-hidden",
                      criticalResults.length > 0 && "border-red-400/30 bg-red-50/70",
                      hasAbnormal && !criticalResults.length && "border-soft-red/20 bg-soft-red/5"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedLab(isExpanded ? null : lab.id)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-serif text-primary">{lab.test_name}</h3>
                          {criticalResults.length > 0 ? <OpsBadge tone="red">Critical</OpsBadge> : null}
                          {hasAbnormal && !criticalResults.length ? <OpsBadge tone="gold">{abnormalResults.length} abnormal</OpsBadge> : null}
                          {!hasAbnormal ? <OpsBadge tone="accent">All normal</OpsBadge> : null}
                          <OpsBadge tone={lab.status === "reviewed" ? "accent" : "blue"}>{lab.status === "reviewed" ? "Reviewed" : "Resulted"}</OpsBadge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted">
                          <span className="chip">{lab.lab_facility}</span>
                          <span className="chip">{lab.category}</span>
                          <span className="chip">{lab.resulted_at ? formatDate(lab.resulted_at) : "Pending"}</span>
                          {physician ? <span className="chip">{physician.full_name}</span> : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-muted">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-border/60">
                        <div className="divide-y divide-border/40">
                          {lab.results.map((result, index) => (
                            <div
                              key={`${lab.id}-${index}`}
                              className={cn(
                                "flex items-start gap-4 px-4 py-3.5 sm:px-5",
                                result.flag === "critical" && "bg-red-50/80",
                                result.flag !== "normal" && result.flag !== "critical" && "bg-soft-red/5"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-primary">{result.name}</div>
                                {result.reference_range ? <div className="mt-1 text-[11px] text-muted">Ref: {result.reference_range}</div> : null}
                                {result.reference_range ? <RangeBar value={result.value} referenceRange={result.reference_range} flag={result.flag} /> : null}
                              </div>
                              <div className="shrink-0 text-right">
                                <div className={cn(
                                  "text-base font-bold leading-none",
                                  result.flag === "critical"
                                    ? "text-red-600"
                                    : result.flag !== "normal"
                                    ? "text-soft-red"
                                    : "text-primary"
                                )}>
                                  {result.value}
                                  {result.unit ? <span className="ml-1 text-xs font-normal text-muted">{result.unit}</span> : null}
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <FlagBadge flag={result.flag} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {lab.notes ? (
                          <div className="border-t border-border/60 bg-white/45 px-4 py-3 sm:px-5">
                            <div className="flex items-start gap-2">
                              <FileText size={13} className="mt-0.5 shrink-0 text-teal" />
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted/80">
                                  {physician?.full_name || "Clinician"} note
                                </div>
                                <div className="mt-1 text-sm leading-6 text-primary">{lab.notes}</div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {hasAbnormal ? (
                          <div className="border-t border-border/60 px-4 py-3 sm:px-5">
                            <AIAction
                              agentId="coordinator"
                              label="Explain These Results"
                              prompt={`Explain the abnormal results from my ${lab.test_name} in plain language: ${abnormalResults.map((result) => `${result.name}: ${result.value}${result.unit || ""} (reference: ${result.reference_range || "n/a"}, flag: ${result.flag})`).join(", ")}. Tell me what they could mean and what I should discuss with my doctor.`}
                              context={`Lab: ${lab.test_name} at ${lab.lab_facility}`}
                              variant="compact"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </OpsPanel>

        <div className="space-y-4">
          <OpsPanel
            eyebrow="Pending"
            title="Awaiting result feed"
            description="Tests still in processing, so the patient knows what is not final yet."
          >
            {pendingLabs.length === 0 ? (
              <OpsEmptyState
                icon={Clock}
                title="No labs are waiting right now"
                description="Every test on file has either resulted or there is no active diagnostic work in progress."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {pendingLabs.map((lab) => (
                  <div key={lab.id} className="surface-muted px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-primary">{lab.test_name}</div>
                        <div className="mt-1 text-xs leading-5 text-muted">Ordered {formatDate(lab.ordered_at)} · {lab.lab_facility}</div>
                      </div>
                      <OpsBadge tone="gold">Processing</OpsBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </OpsPanel>

          <OpsPanel
            eyebrow="Signal summary"
            title="What stands out"
            description="A compact read of the result feed before opening each panel."
          >
            <div className="space-y-3">
              <FocusItem
                label="Abnormal panels"
                value={`${abnormalLabs.length}`}
                detail={
                  abnormalLabs[0]?.test_name
                    ? `${abnormalLabs[0].test_name} is the first result set that should be reviewed in detail.`
                    : "No abnormal lab panels are visible right now."
                }
                tone={abnormalLabs.length ? "red" : "accent"}
              />
              <FocusItem
                label="Critical values"
                value={`${criticalCount}`}
                detail={criticalCount ? "Critical values should trigger direct follow-up, not a passive portal wait." : "No critical values are currently present."}
                tone={criticalCount ? "red" : "accent"}
              />
              <FocusItem
                label="Clinician reviewed"
                value={`${reviewedCount}`}
                detail={reviewedCount ? "Some result sets already have a clinician review state attached." : "No result set is marked reviewed yet."}
                tone={reviewedCount ? "accent" : "blue"}
              />
            </div>
          </OpsPanel>

          <OpsPanel
            eyebrow="Patient framing"
            title="How to read this board"
            description="Keep the interpretation grounded and actionable rather than dumping raw values back onto the patient."
          >
            <div className="space-y-3 text-sm leading-6 text-secondary">
              <p>
                {criticalCount
                  ? `${criticalCount} value${criticalCount === 1 ? " is" : "s are"} critical. That should trigger direct clinical follow-up rather than a normal message thread.`
                  : abnormalCount
                  ? `${abnormalCount} value${abnormalCount === 1 ? " is" : "s are"} outside the reference range. Review those panels first, then use Atlas for a plain-language explanation.`
                  : "The current lab feed is stable, with no out-of-range values visible in the resulted panels."}
              </p>
              <p>
                {pendingLabs.length
                  ? `${pendingLabs.length} test${pendingLabs.length === 1 ? " is" : "s are"} still processing, so the board is not yet complete. Keep that in mind before over-interpreting the current results.`
                  : "There are no pending tests, so the current board reflects the full diagnostic set on file."}
              </p>
            </div>
          </OpsPanel>
        </div>
      </div>
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
        <div className="text-sm font-semibold text-primary">{label}</div>
        <div className="mt-1 text-xs leading-5 text-muted">{detail}</div>
      </div>
      <OpsBadge tone={tone} className="shrink-0">{value}</OpsBadge>
    </div>
  )
}
