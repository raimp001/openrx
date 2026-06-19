"use client"

import Link from "next/link"
import { ArrowRight, BookmarkPlus, CheckCircle2, ClipboardList } from "lucide-react"
import { advanceCarePlanStatus, type CarePlan } from "@/lib/care-plan"
import { useCarePlans } from "@/lib/hooks/use-care-plans"
import { cn } from "@/lib/utils"

interface CarePlanPreviewProps {
  draft: CarePlan
  compact?: boolean
  className?: string
}

const urgencyTone = {
  routine: "border-white/10 bg-white/[0.04] text-zinc-300",
  soon: "border-cyan-200/18 bg-cyan-200/[0.07] text-cyan-100",
  urgent: "border-amber-300/22 bg-amber-300/[0.09] text-amber-100",
  emergency: "border-red-300/24 bg-red-400/[0.1] text-red-100",
}

export function CarePlanPreview({ draft, compact = false, className }: CarePlanPreviewProps) {
  const { plans, addPlan, setRecommendationStatus } = useCarePlans()
  const saved = plans.find((plan) => plan.id === draft.id)
  const plan = saved || draft
  const nextItem = plan.recommendations.find((item) => item.status !== "completed" && item.status !== "deferred")

  function markNextStep() {
    if (!saved) addPlan(draft)
    if (!nextItem) return
    setRecommendationStatus(plan.id, nextItem.id, advanceCarePlanStatus(nextItem.status))
  }

  if (compact) {
    return (
      <section
        data-testid="care-plan-preview"
        className={cn(
          "rounded-[18px] border border-cyan-200/18 bg-cyan-200/[0.065] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]",
          className
        )}
      >
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
            <ClipboardList size={12} />
            Suggested care plan
          </p>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/18 bg-emerald-300/[0.08] px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
              <CheckCircle2 size={11} />
              Saved
            </span>
          ) : null}
        </header>
        <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-zinc-200">{plan.patientContextSummary}</p>
        <div className="mt-3 grid gap-2">
          {plan.recommendations.slice(0, 2).map((item) => (
            <div key={item.id} data-testid="care-plan-item" className="rounded-[14px] border border-white/12 bg-black/22 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold leading-5 text-zinc-50">{item.title}</p>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", urgencyTone[item.urgency])}>
                  {item.urgency}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 text-[11px] leading-5 text-zinc-300">{item.nextAction}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                {item.status.replaceAll("_", " ")} · {item.sourceLabel}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!saved ? (
            <button
              type="button"
              data-testid="care-plan-add-button"
              onClick={() => addPlan(draft)}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-200 px-3 py-1.5 text-[12px] font-semibold text-black transition hover:bg-cyan-100"
            >
              <BookmarkPlus size={13} />
              Add to My Care
            </button>
          ) : null}
          <button
            type="button"
            data-testid="care-plan-mark-next-button"
            onClick={markNextStep}
            disabled={!nextItem}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-zinc-100 transition hover:bg-white/[0.1] disabled:opacity-45"
          >
            <CheckCircle2 size={13} />
            Mark next step
          </button>
          {saved ? (
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-cyan-100 hover:text-cyan-50">
              View
              <ArrowRight size={12} />
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-[10.5px] leading-5 text-zinc-400">Demo mode saves this plan only in this browser.</p>
      </section>
    )
  }

  return (
    <section
      data-testid="care-plan-preview"
      className={cn(
        "rounded-[20px] border border-white/10 bg-[#0b1112] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
            <ClipboardList size={13} />
            Care Plan
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-300">{plan.patientContextSummary}</p>
        </div>
        {saved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/18 bg-emerald-300/[0.08] px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
            <CheckCircle2 size={12} />
            Saved locally
          </span>
        ) : null}
      </header>
      <div className={cn("mt-4 grid gap-2", !compact && "sm:grid-cols-2")}>
        {plan.recommendations.slice(0, compact ? 2 : 4).map((item) => (
          <div key={item.id} data-testid="care-plan-item" className="rounded-[15px] border border-white/9 bg-white/[0.035] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-semibold leading-5 text-zinc-100">{item.title}</p>
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", urgencyTone[item.urgency])}>
                {item.urgency}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-zinc-400">{item.nextAction}</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {item.status.replaceAll("_", " ")} · {item.sourceLabel}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!saved ? (
          <button
            type="button"
            data-testid="care-plan-add-button"
            onClick={() => addPlan(draft)}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-200 px-3.5 py-2 text-[12px] font-semibold text-black transition hover:bg-cyan-100"
          >
            <BookmarkPlus size={14} />
            Add to My Care
          </button>
        ) : null}
        <button
          type="button"
          data-testid="care-plan-mark-next-button"
          onClick={markNextStep}
          disabled={!nextItem}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[12px] font-semibold text-zinc-100 transition hover:bg-white/[0.1] disabled:opacity-45"
        >
          <CheckCircle2 size={14} />
          Mark next step
        </button>
        {saved ? (
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold text-cyan-100 hover:text-cyan-50">
            View my care
            <ArrowRight size={13} />
          </Link>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">Demo mode saves this plan only in this browser. Do not enter identifiers you do not want stored locally.</p>
    </section>
  )
}
