"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertTriangle, PackageSearch, Pill, RefreshCw, Search, ShieldPlus } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsEmptyState, OpsMetricCard, OpsPanel, OpsTabButton } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatDate, getStatusColor } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  active: "Taking",
  "pending-refill": "Ready to Refill",
  completed: "Completed",
  "on-hold": "On Hold",
  discontinued: "Discontinued",
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

function AdherenceRing({ pct, size = 58 }: { pct: number; size?: number }) {
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const safePct = Math.min(100, Math.max(0, pct))
  const filled = (safePct / 100) * circumference
  const color = safePct >= 90 ? "#047857" : safePct >= 80 ? "#B45309" : "#B91C1C"
  const label = safePct >= 90 ? "Great" : safePct >= 80 ? "Fair" : "Low"

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Adherence: ${safePct}%. ${label}.`}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(20,35,31,0.07)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-[10px] font-bold leading-none" style={{ color }}>{safePct}%</span>
        <span className="mt-0.5 text-[7px] leading-none text-muted">{label}</span>
      </div>
    </div>
  )
}

function daysUntilRefill(lastFilled: string, frequency: string): number | null {
  if (!lastFilled) return null
  const f = frequency.toLowerCase()
  let supplyDays = 30
  if (/twice|2x|bid|b\.i\.d/i.test(f)) supplyDays = 15
  else if (/three|3x|tid|t\.i\.d/i.test(f)) supplyDays = 10
  else if (/four|4x|qid|q\.i\.d/i.test(f)) supplyDays = 7
  else if (/every\s*12\s*h/i.test(f)) supplyDays = 15
  else if (/every\s*8\s*h/i.test(f)) supplyDays = 10
  else if (/every\s*6\s*h/i.test(f)) supplyDays = 7
  else if (/weekly|qw|once\s*a\s*week/i.test(f)) supplyDays = 210
  else if (/prn|as\s*needed/i.test(f)) return null
  const filled = new Date(lastFilled).getTime()
  const nextRefill = filled + supplyDays * 86400000
  return Math.ceil((nextRefill - Date.now()) / 86400000)
}

export default function PrescriptionsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const { snapshot, getPhysician, loading } = useLiveSnapshot()

  const myPrescriptions = snapshot.prescriptions
  const hasData = Boolean(snapshot.patient)

  const statuses = useMemo(
    () => Array.from(new Set(myPrescriptions.map((prescription) => prescription.status))),
    [myPrescriptions]
  )

  const filtered = useMemo(() => {
    return myPrescriptions.filter((prescription) => {
      const query = search.trim().toLowerCase()
      const matchesSearch =
        !query ||
        prescription.medication_name.toLowerCase().includes(query) ||
        prescription.pharmacy.toLowerCase().includes(query)
      const matchesStatus = !statusFilter || prescription.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [myPrescriptions, search, statusFilter])

  const activeRx = useMemo(
    () => myPrescriptions.filter((prescription) => prescription.status === "active"),
    [myPrescriptions]
  )
  const lowAdherence = useMemo(
    () => activeRx.filter((prescription) => prescription.adherence_pct < 80),
    [activeRx]
  )
  const pendingRefills = useMemo(
    () => myPrescriptions.filter((prescription) => prescription.status === "pending-refill"),
    [myPrescriptions]
  )
  const refillSoon = useMemo(
    () => activeRx.filter((prescription) => {
      const daysLeft = daysUntilRefill(prescription.last_filled, prescription.frequency)
      return daysLeft !== null && daysLeft <= 7
    }),
    [activeRx]
  )
  const avgAdherence = activeRx.length
    ? Math.round(activeRx.reduce((sum, prescription) => sum + prescription.adherence_pct, 0) / activeRx.length)
    : null
  const sortedFiltered = useMemo(
    () =>
      [...filtered].sort((left, right) => {
        const score = (prescription: (typeof filtered)[number]) => {
          const daysLeft = daysUntilRefill(prescription.last_filled, prescription.frequency)
          return (
            (prescription.status === "pending-refill" ? 5 : 0) +
            (prescription.status === "active" && prescription.adherence_pct < 80 ? 4 : 0) +
            (daysLeft !== null && daysLeft <= 7 ? 3 : 0) +
            (prescription.refills_remaining === 0 ? 2 : 0)
          )
        }
        return score(right) - score(left) || right.adherence_pct - left.adherence_pct
      }),
    [filtered]
  )
  const primaryConcern = useMemo(
    () => sortedFiltered.find((prescription) => prescription.status === "pending-refill" || prescription.adherence_pct < 80) || sortedFiltered[0] || null,
    [sortedFiltered]
  )

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
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
          eyebrow="Medication management"
          title="Medications"
          description="Track fills, adherence, and refill pressure in one view instead of jumping between charts, pharmacies, and reminders."
        />
        <div className="surface-card p-6">
          <OpsEmptyState
            icon={Pill}
            title="No medication data is connected yet"
            description="Connect your health record first, then OpenRx will organize your medications, refill timing, and adherence signals here."
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
        eyebrow="Medication management"
        title="Medications"
        description="See what is active, what is slipping, and what needs a refill before it becomes a care gap."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone="accent">{activeRx.length} active</OpsBadge>
            <OpsBadge tone={pendingRefills.length ? "gold" : "accent"}>{pendingRefills.length} refill queue</OpsBadge>
            <OpsBadge tone={lowAdherence.length ? "red" : "blue"}>{lowAdherence.length} low adherence</OpsBadge>
          </div>
        }
        actions={
          <>
            <Link href="/drug-prices" className="control-button-secondary">
              Compare prices
            </Link>
            <AIAction
              agentId="rx"
              label="Review meds"
              prompt="Review my medications for refill timing, adherence risk, and possible interactions. Prioritize the most important next steps."
              context={`${activeRx.length} active medications. Average adherence ${avgAdherence ?? 0}%. Low adherence medications: ${lowAdherence.length}. Pending refills: ${pendingRefills.length}.`}
            />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard
          label="Active meds"
          value={`${activeRx.length}`}
          detail="Medications currently in the daily regimen."
          icon={Pill}
          tone="accent"
        />
        <OpsMetricCard
          label="Avg adherence"
          value={avgAdherence === null ? "--" : `${avgAdherence}%`}
          detail="A quick read on how consistently the active regimen is being followed."
          icon={ShieldPlus}
          tone={avgAdherence === null ? "blue" : avgAdherence >= 90 ? "accent" : avgAdherence >= 80 ? "gold" : "red"}
        />
        <OpsMetricCard
          label="Refill soon"
          value={`${refillSoon.length}`}
          detail="Active medications likely to need action within the next week."
          icon={RefreshCw}
          tone={refillSoon.length ? "gold" : "accent"}
        />
        <OpsMetricCard
          label="Low adherence"
          value={`${lowAdherence.length}`}
          detail="Active medications trending below an 80% adherence pattern."
          icon={AlertTriangle}
          tone={lowAdherence.length ? "red" : "accent"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
        <div className="overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(8,24,46,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">Medication to address first</p>
              <h2 className="mt-4 max-w-xl font-serif text-[2.15rem] leading-[0.96] text-white">
                {primaryConcern ? primaryConcern.medication_name : "No urgent medication"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                {primaryConcern
                  ? `${statusLabel(primaryConcern.status)} · adherence ${primaryConcern.adherence_pct}% · ${primaryConcern.pharmacy || "Pharmacy on file"}`
                  : "The current regimen is stable. No refill or adherence signal is leading the queue right now."}
              </p>
            </div>
            <OpsBadge tone={primaryConcern?.status === "pending-refill" || (primaryConcern?.adherence_pct ?? 100) < 80 ? "red" : primaryConcern ? "gold" : "accent"} className="!border-white/12 !bg-white/10 !text-white">
              {primaryConcern?.status === "pending-refill" || (primaryConcern?.adherence_pct ?? 100) < 80 ? "urgent" : primaryConcern ? "review" : "stable"}
            </OpsBadge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Refill pressure</p>
              <p className="mt-2 text-lg font-semibold text-white">{pendingRefills.length + refillSoon.length} medication{pendingRefills.length + refillSoon.length === 1 ? "" : "s"}</p>
              <p className="mt-1 text-[12px] leading-6 text-white/64">
                {pendingRefills.length || refillSoon.length
                  ? "These prescriptions are already waiting for a refill or are closing in on the refill window."
                  : "No refill bottleneck is visible in the active regimen."}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Regimen posture</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {avgAdherence === null
                  ? "No active regimen"
                  : avgAdherence >= 90
                    ? "Stable routine"
                    : avgAdherence >= 80
                      ? "Needs reinforcement"
                      : "Drifting off plan"}
              </p>
              <p className="mt-1 text-[12px] leading-6 text-white/64">
                {avgAdherence === null
                  ? "There is no active medication list on file yet."
                  : `Average adherence is ${avgAdherence}%, which sets the tone for refill and counseling priority.`}
              </p>
            </div>
          </div>
        </div>
        <BriefingCard
          eyebrow="Refill pressure"
          title={`${pendingRefills.length + refillSoon.length} medications`}
          detail={
            pendingRefills.length || refillSoon.length
              ? "These prescriptions are already waiting for a refill or are approaching the refill window."
              : "No refill bottleneck is visible in the current regimen."
          }
          tone={pendingRefills.length || refillSoon.length ? "gold" : "accent"}
        />
        <BriefingCard
          eyebrow="Regimen posture"
          title={
            avgAdherence === null
              ? "No active regimen"
              : avgAdherence >= 90
                ? "Stable routine"
                : avgAdherence >= 80
                  ? "Needs reinforcement"
                  : "Drifting off plan"
          }
          detail={
            avgAdherence === null
              ? "There is no active medication list on file yet."
              : `Average adherence is ${avgAdherence}%, which sets the tone for refill and counseling priority.`
          }
          tone={avgAdherence === null ? "blue" : avgAdherence >= 90 ? "accent" : avgAdherence >= 80 ? "gold" : "red"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <OpsPanel
          eyebrow="Medication lane"
          title="Daily regimen"
          description="Search by medication or pharmacy, narrow by status, and keep the most actionable refill and adherence signals visible without opening another screen."
          actions={
            <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
              <label className="relative min-w-[16rem] flex-1 xl:max-w-[18rem]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search medications or pharmacies"
                  className="control-input mt-0 pl-9"
                />
              </label>
              <OpsTabButton active={!statusFilter} onClick={() => setStatusFilter("")}>All</OpsTabButton>
              {statuses.map((status) => (
                <OpsTabButton key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                  {statusLabel(status)}
                </OpsTabButton>
              ))}
            </div>
          }
        >
          {filtered.length === 0 ? (
            <OpsEmptyState
              icon={PackageSearch}
              title="No medications match this view"
              description={
                search
                  ? `No medications matched “${search}”. Try a brand name, generic name, or pharmacy.`
                  : "There are no medications in this status right now."
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sortedFiltered.map((prescription) => {
                const physician = getPhysician(prescription.physician_id)
                const isLowAdherence = prescription.status === "active" && prescription.adherence_pct < 80
                const daysLeft = daysUntilRefill(prescription.last_filled, prescription.frequency)
                const needsRefillSoon = daysLeft !== null && daysLeft <= 7 && prescription.status === "active"

                return (
                  <article
                    key={prescription.id}
                    className={cn(
                      "surface-muted flex h-full flex-col gap-4 p-4 sm:p-5",
                      isLowAdherence && "border-soft-red/25 bg-soft-red/5",
                      needsRefillSoon && !isLowAdherence && "border-amber-300/35 bg-amber-100/35"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-serif text-primary">{prescription.medication_name}</h3>
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide", getStatusColor(prescription.status))}>
                            {statusLabel(prescription.status)}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-primary">{prescription.dosage}</div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-muted">
                          <span className="chip">{prescription.frequency}</span>
                          <span className="chip">{prescription.pharmacy || "Pharmacy on file"}</span>
                          {physician ? <span className="chip">{physician.full_name}</span> : null}
                        </div>
                      </div>
                      <AdherenceRing pct={prescription.adherence_pct} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetaCard
                        label="Refills remaining"
                        value={prescription.refills_remaining === 0 ? "No refills" : `${prescription.refills_remaining} remaining`}
                        tone={prescription.refills_remaining === 0 ? "text-soft-red" : "text-primary"}
                      />
                      <MetaCard label="Last filled" value={formatDate(prescription.last_filled)} />
                    </div>

                    {isLowAdherence ? (
                      <SignalBanner tone="red" title="Adherence slipping">
                        This medication is below the 80% threshold. Review whether cost, side effects, or routine changes are getting in the way.
                      </SignalBanner>
                    ) : null}
                    {needsRefillSoon ? (
                      <SignalBanner tone="gold" title={daysLeft !== null && daysLeft <= 0 ? "Refill overdue" : `Refill needed in ~${daysLeft} days`}>
                        This medication is approaching the refill window and should be handled before it becomes a gap in treatment.
                      </SignalBanner>
                    ) : null}

                    {prescription.notes ? (
                      <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-xs leading-5 text-secondary">
                        {prescription.notes}
                      </div>
                    ) : null}

                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {(isLowAdherence || prescription.status === "pending-refill" || prescription.refills_remaining === 0) ? (
                        <AIAction
                          agentId="rx"
                          label={isLowAdherence ? "Get Adherence Plan" : "Request Refill"}
                          prompt={
                            isLowAdherence
                              ? `My adherence for ${prescription.medication_name} ${prescription.dosage} is ${prescription.adherence_pct}%. Give me a practical adherence plan and tell me what to discuss with my care team.`
                              : `Help me request a refill for ${prescription.medication_name} ${prescription.dosage}. Refills remaining: ${prescription.refills_remaining}. Pharmacy: ${prescription.pharmacy || "on file"}.`
                          }
                          context={`${prescription.medication_name} ${prescription.dosage} — ${prescription.frequency}`}
                          variant="compact"
                        />
                      ) : null}
                      <AIAction
                        agentId="rx"
                        label="Review safety"
                        prompt={`Review ${prescription.medication_name} ${prescription.dosage} for adherence, refill timing, and practical counseling points.`}
                        context={`Frequency: ${prescription.frequency}, last filled: ${prescription.last_filled}, adherence: ${prescription.adherence_pct}%`}
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
            eyebrow="Medication focus"
            title="What to act on first"
            description="A compact queue of the signals most likely to turn into missed doses, refill delays, or avoidable confusion."
          >
            <div className="space-y-3">
              <FocusItem
                label="Low adherence"
                value={`${lowAdherence.length}`}
                detail={
                  lowAdherence[0]?.medication_name
                    ? `${lowAdherence[0].medication_name} is the first medication to review for a behavior or cost barrier.`
                    : "No medication is currently under the low-adherence threshold."
                }
                tone={lowAdherence.length ? "red" : "accent"}
              />
              <FocusItem
                label="Needs refill"
                value={`${pendingRefills.length || refillSoon.length}`}
                detail={
                  pendingRefills[0]?.medication_name || refillSoon[0]?.medication_name
                    ? `${pendingRefills[0]?.medication_name || refillSoon[0]?.medication_name} is next in the refill queue.`
                    : "No refill bottleneck is visible right now."
                }
                tone={pendingRefills.length || refillSoon.length ? "gold" : "accent"}
              />
              <FocusItem
                label="Average adherence"
                value={avgAdherence === null ? "--" : `${avgAdherence}%`}
                detail={
                  avgAdherence === null
                    ? "There is no active medication regimen on file yet."
                    : avgAdherence >= 90
                    ? "The active regimen is in a stable range right now."
                    : "The active regimen needs a closer look before it drifts into missed doses."
                }
                tone={avgAdherence === null ? "blue" : avgAdherence >= 90 ? "accent" : avgAdherence >= 80 ? "gold" : "red"}
              />
            </div>
          </OpsPanel>

          <OpsPanel
            eyebrow="Patient framing"
            title="How this reads day to day"
            description="Explain the medication board in plain language, not pharmacy system language."
          >
            <div className="space-y-3 text-sm leading-6 text-secondary">
              <p>
                {lowAdherence.length
                  ? `${lowAdherence.length} medication${lowAdherence.length === 1 ? " is" : "s are"} slipping below the adherence target. Start there, because refill requests alone will not fix missed doses.`
                  : "No medication is currently showing a clear adherence warning, so the next priority is refill timing and regimen clarity."}
              </p>
              <p>
                {refillSoon.length || pendingRefills.length
                  ? `${refillSoon.length + pendingRefills.length} medication${refillSoon.length + pendingRefills.length === 1 ? " is" : "s are"} approaching a refill issue. Handle those before they become treatment gaps.`
                  : "There is no immediate refill pressure in the active regimen right now."}
              </p>
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  )
}

function MetaCard({
  label,
  value,
  tone = "text-primary",
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">{label}</div>
      <div className={cn("mt-2 text-sm font-semibold", tone)}>{value}</div>
    </div>
  )
}

function SignalBanner({
  tone,
  title,
  children,
}: {
  tone: "red" | "gold"
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        tone === "red"
          ? "border-soft-red/20 bg-soft-red/5 text-soft-red"
          : "border-amber-300/30 bg-amber-100/55 text-amber-700"
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.18em]">{title}</div>
      <div className="mt-1">{children}</div>
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
