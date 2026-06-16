"use client"

import Link from "next/link"
import { ArrowRight, BookmarkPlus, CheckCircle2, ClipboardList } from "lucide-react"
import { advanceCarePlanStatus, type CarePlan } from "@/lib/care-plan"
import { useCarePlans } from "@/lib/hooks/use-care-plans"
import { cn } from "@/lib/utils"

type CarePlanTone = "dark" | "light"

interface CarePlanPreviewProps {
  draft: CarePlan
  compact?: boolean
  tone?: CarePlanTone
  className?: string
}

const urgencyToneByTheme: Record<CarePlanTone, Record<"routine" | "soon" | "urgent" | "emergency", string>> = {
  dark: {
    routine: "border-white/10 bg-white/[0.04] text-zinc-300",
    soon: "border-cyan-200/18 bg-cyan-200/[0.07] text-cyan-100",
    urgent: "border-amber-300/22 bg-amber-300/[0.09] text-amber-100",
    emergency: "border-red-300/24 bg-red-400/[0.1] text-red-100",
  },
  light: {
    routine: "border-[#E7E5E0] bg-white text-[#57534E]",
    soon: "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]",
    urgent: "border-amber-200 bg-amber-50 text-amber-900",
    emergency: "border-red-200 bg-red-50 text-red-700",
  },
}

const TONE_STYLES: Record<CarePlanTone, {
  shell: string
  kicker: string
  summary: string
  savedPill: string
  itemCard: string
  itemTitle: string
  itemAction: string
  itemMeta: string
  primaryButton: string
  secondaryButton: string
  link: string
  footnote: string
}> = {
  dark: {
    shell: "border-white/10 bg-[#0b1112] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
    kicker: "text-cyan-100",
    summary: "text-zinc-300",
    savedPill: "border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-100",
    itemCard: "border-white/9 bg-white/[0.035]",
    itemTitle: "text-zinc-100",
    itemAction: "text-zinc-400",
    itemMeta: "text-zinc-500",
    primaryButton: "bg-cyan-200 text-black hover:bg-cyan-100",
    secondaryButton: "border-white/12 bg-white/[0.05] text-zinc-100 hover:bg-white/[0.1]",
    link: "text-cyan-100 hover:text-cyan-50",
    footnote: "text-zinc-500",
  },
  light: {
    shell: "border-[#E7E5E0] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.05)]",
    kicker: "text-[#0F766E]",
    summary: "text-[#57534E]",
    savedPill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    itemCard: "border-[#EFEDE8] bg-[#FAFAF7]",
    itemTitle: "text-[#1C1917]",
    itemAction: "text-[#57534E]",
    itemMeta: "text-[#A8A29E]",
    primaryButton: "bg-[#0F766E] text-white hover:bg-[#115E59]",
    secondaryButton: "border-[#E7E5E0] bg-white text-[#44403C] hover:bg-stone-50",
    link: "text-[#0F766E] hover:text-[#115E59]",
    footnote: "text-[#A8A29E]",
  },
}

export function CarePlanPreview({ draft, compact = false, tone = "dark", className }: CarePlanPreviewProps) {
  const styles = TONE_STYLES[tone]
  const urgencyTone = urgencyToneByTheme[tone]
  const { plans, addPlan, setRecommendationStatus } = useCarePlans()
  const saved = plans.find((plan) => plan.id === draft.id)
  const plan = saved || draft
  const nextItem = plan.recommendations.find((item) => item.status !== "completed" && item.status !== "deferred")

  function markNextStep() {
    if (!saved) addPlan(draft)
    if (!nextItem) return
    setRecommendationStatus(plan.id, nextItem.id, advanceCarePlanStatus(nextItem.status))
  }

  return (
    <section
      data-testid="care-plan-preview"
      className={cn("rounded-[20px] border p-4", styles.shell, className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn("flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]", styles.kicker)}>
            <ClipboardList size={13} />
            Care Plan
          </p>
          <p className={cn("mt-2 max-w-lg text-sm leading-6", styles.summary)}>{plan.patientContextSummary}</p>
        </div>
        {saved ? (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", styles.savedPill)}>
            <CheckCircle2 size={12} />
            Saved locally
          </span>
        ) : null}
      </header>
      <div className={cn("mt-4 grid gap-2", !compact && "sm:grid-cols-2")}>
        {plan.recommendations.slice(0, compact ? 2 : 4).map((item) => (
          <div key={item.id} data-testid="care-plan-item" className={cn("rounded-[15px] border p-3", styles.itemCard)}>
            <div className="flex items-start justify-between gap-2">
              <p className={cn("text-[13px] font-semibold leading-5", styles.itemTitle)}>{item.title}</p>
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", urgencyTone[item.urgency])}>
                {item.urgency}
              </span>
            </div>
            <p className={cn("mt-2 line-clamp-2 text-[12px] leading-5", styles.itemAction)}>{item.nextAction}</p>
            <p className={cn("mt-2 text-[10px] uppercase tracking-[0.12em]", styles.itemMeta)}>
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
            className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-semibold transition", styles.primaryButton)}
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
          className={cn("inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition disabled:opacity-45", styles.secondaryButton)}
        >
          <CheckCircle2 size={14} />
          Mark next step
        </button>
        {saved ? (
          <Link href="/dashboard" className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold", styles.link)}>
            View my care
            <ArrowRight size={13} />
          </Link>
        ) : null}
      </div>
      <p className={cn("mt-3 text-[11px] leading-5", styles.footnote)}>Demo mode saves this plan only in this browser. Do not enter identifiers you do not want stored locally.</p>
    </section>
  )
}

