"use client"

import { ChevronDown, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackWorkflowEvent } from "@/lib/product-analytics"

export interface TrustSource {
  label: string
  url?: string
  date?: string
}

type TrustTone = "dark" | "light"

interface TrustDrawerProps {
  sources?: TrustSource[]
  inputsUsed?: string[]
  inputsNotUsed?: string[]
  phiSentToModel?: boolean
  routingNote?: string
  safetyBoundary?: string
  emergencyWarning?: string
  clinicianQuestions?: string[]
  tone?: TrustTone
  className?: string
}

const TONE_STYLES: Record<TrustTone, {
  shell: string
  summary: string
  summaryIcon: string
  chevron: string
  body: string
  emergency: string
  heading: string
  sourcePill: string
  reviewNote: string
  panel: string
  panelMuted: string
  list: string
}> = {
  dark: {
    shell: "border-white/10 bg-white/[0.03]",
    summary: "text-zinc-200",
    summaryIcon: "text-cyan-200",
    chevron: "text-zinc-400",
    body: "border-white/8 text-zinc-300",
    emergency: "border-red-300/20 bg-red-400/[0.08] text-red-100",
    heading: "text-zinc-100",
    sourcePill: "border-cyan-200/18 bg-cyan-200/[0.07] text-cyan-100 hover:bg-cyan-200/[0.12]",
    reviewNote: "border-amber-300/20 bg-amber-300/[0.08] text-amber-100",
    panel: "border-white/8 bg-black/15",
    panelMuted: "text-zinc-400",
    list: "text-zinc-300",
  },
  light: {
    shell: "border-[#E7E5E0] bg-white",
    summary: "text-[#44403C]",
    summaryIcon: "text-[#0F766E]",
    chevron: "text-[#A8A29E]",
    body: "border-[#EFEDE8] text-[#57534E]",
    emergency: "border-red-200 bg-red-50 text-red-700",
    heading: "text-[#1C1917]",
    sourcePill: "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E] hover:bg-[#CCFBF1]",
    reviewNote: "border-amber-200 bg-amber-50 text-amber-900",
    panel: "border-[#EFEDE8] bg-[#FAFAF7]",
    panelMuted: "text-[#A8A29E]",
    list: "text-[#57534E]",
  },
}

export function TrustDrawer({
  sources = [],
  inputsUsed = [],
  inputsNotUsed = [],
  phiSentToModel = false,
  routingNote = "OpenRx used a rules-first workflow where available and keeps operational routing separate from clinical identity.",
  safetyBoundary = "OpenRx supports education and care navigation. It does not diagnose, order tests, or replace clinician judgment.",
  emergencyWarning,
  clinicianQuestions = [],
  tone = "dark",
  className,
}: TrustDrawerProps) {
  const hasValidatedSource = sources.some((source) => Boolean(source.url))
  const styles = TONE_STYLES[tone]

  return (
    <details
      data-testid="trust-drawer"
      className={cn("group rounded-[16px] border", styles.shell, className)}
    >
      <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[12px] font-semibold", styles.summary)}>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={14} className={styles.summaryIcon} />
          Why this answer?
        </span>
        <ChevronDown size={14} className={cn("transition group-open:rotate-180", styles.chevron)} />
      </summary>
      <div className={cn("space-y-4 border-t px-4 py-4 text-[12px] leading-5", styles.body)}>
        {emergencyWarning ? (
          <div className={cn("flex gap-2 rounded-[12px] border p-3", styles.emergency)}>
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <p>{emergencyWarning}</p>
          </div>
        ) : null}
        <div>
          <p className={cn("mb-2 font-semibold", styles.heading)}>Sources used</p>
          {hasValidatedSource ? (
            <div className="flex flex-wrap gap-2">
              {sources.map((source) =>
                source.url ? (
                  <a
                    key={`${source.label}-${source.url}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackWorkflowEvent("source_opened", { surface: "trust_drawer" })}
                    className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1", styles.sourcePill)}
                  >
                    {source.label}
                    {source.date ? ` · ${source.date}` : ""}
                    <ExternalLink size={10} />
                  </a>
                ) : null
              )}
            </div>
          ) : (
            <p className={cn("rounded-[10px] border px-3 py-2", styles.reviewNote)}>
              Needs clinician review. No validated source was attached to this result.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TrustList tone={tone} title="Patient inputs used" items={inputsUsed} empty="No patient-specific inputs used." />
          <TrustList tone={tone} title="Inputs not used" items={inputsNotUsed} empty="No additional inputs expected for this answer." />
        </div>
        <div className={cn("rounded-[12px] border p-3", styles.panel)}>
          <p className={cn("font-semibold", styles.heading)}>Privacy and routing</p>
          <p className="mt-1">{phiSentToModel ? "Limited context may have been sent to the configured model provider for this answer." : "No full patient profile was sent to a model provider for this rules-based explanation."}</p>
          <p className={cn("mt-1", styles.panelMuted)}>{routingNote}</p>
        </div>
        <div>
          <p className={cn("font-semibold", styles.heading)}>Clinical safety boundary</p>
          <p className="mt-1">{safetyBoundary}</p>
        </div>
        {clinicianQuestions.length ? (
          <div>
            <p className={cn("font-semibold", styles.heading)}>What to ask your clinician next</p>
            <ul className={cn("mt-2 space-y-1", styles.list)}>
              {clinicianQuestions.map((question) => <li key={question}>- {question}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  )
}

function TrustList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: TrustTone }) {
  const styles = TONE_STYLES[tone]
  return (
    <div className={cn("rounded-[12px] border p-3", styles.panel)}>
      <p className={cn("font-semibold", styles.heading)}>{title}</p>
      {items.length ? (
        <ul className={cn("mt-2 space-y-1", styles.list)}>
          {items.map((item) => <li key={item}>- {item}</li>)}
        </ul>
      ) : (
        <p className={cn("mt-2", styles.panelMuted)}>{empty}</p>
      )}
    </div>
  )
}
