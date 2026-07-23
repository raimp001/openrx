"use client"

import { ChevronDown, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackWorkflowEvent } from "@/lib/product-analytics"

export interface TrustSource {
  label: string
  url?: string
  date?: string
}

interface TrustDrawerProps {
  sources?: TrustSource[]
  inputsUsed?: string[]
  inputsNotUsed?: string[]
  phiSentToModel?: boolean
  routingNote?: string
  safetyBoundary?: string
  emergencyWarning?: string
  clinicianQuestions?: string[]
  className?: string
  /** Visual surface. "dark" preserves the legacy app-shell styling. */
  surface?: "dark" | "light"
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
  className,
  surface = "dark",
}: TrustDrawerProps) {
  const light = surface === "light"
  const hasValidatedSource = sources.some((source) => Boolean(source.url))

  return (
    <details
      data-testid="trust-drawer"
      className={cn("group rounded-[16px] border", light ? "border-zinc-200 bg-zinc-50" : "border-white/10 bg-white/[0.03]", className)}
    >
      <summary className={cn("flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[12px] font-semibold", light ? "text-zinc-700" : "text-zinc-200")}>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={14} className={light ? "text-cyan-700" : "text-cyan-200"} />
          Why this answer?
        </span>
        <ChevronDown size={14} className="text-zinc-500 transition group-open:rotate-180" />
      </summary>
      <div className={cn("space-y-4 border-t px-4 py-4 text-[12px] leading-5", light ? "border-zinc-200 text-zinc-600" : "border-white/8 text-zinc-300")}>
        {emergencyWarning ? (
          <div className={cn("flex gap-2 rounded-[12px] border p-3", light ? "border-red-300 bg-red-50 text-red-700" : "border-red-300/20 bg-red-400/[0.08] text-red-100")}>
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <p>{emergencyWarning}</p>
          </div>
        ) : null}
        <div>
          <p className={cn("mb-2 font-semibold", light ? "text-zinc-900" : "text-zinc-100")}>Sources used</p>
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
                    className={cn("inline-flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 py-1", light ? "border-cyan-700/25 bg-cyan-50 text-cyan-800 hover:bg-cyan-100" : "border-cyan-200/18 bg-cyan-200/[0.07] text-cyan-100 hover:bg-cyan-200/[0.12]")}
                  >
                    {source.label}
                    {source.date ? ` · ${source.date}` : ""}
                    <ExternalLink size={10} />
                  </a>
                ) : null
              )}
            </div>
          ) : (
            <p className={cn("rounded-[10px] border px-3 py-2", light ? "border-amber-300/70 bg-amber-50 text-amber-800" : "border-amber-300/20 bg-amber-300/[0.08] text-amber-100")}>
              Needs clinician review. No validated source was attached to this result.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TrustList title="Patient inputs used" items={inputsUsed} empty="No patient-specific inputs used." light={light} />
          <TrustList title="Inputs not used" items={inputsNotUsed} empty="No additional inputs expected for this answer." light={light} />
        </div>
        <div className={cn("rounded-[12px] border p-3", light ? "border-zinc-200 bg-white" : "border-white/8 bg-black/15")}>
          <p className={cn("font-semibold", light ? "text-zinc-900" : "text-zinc-100")}>Privacy and routing</p>
          <p className="mt-1">{phiSentToModel ? "Limited context may have been sent to the configured model provider for this answer." : "No full patient profile was sent to a model provider for this rules-based explanation."}</p>
          <p className="mt-1 text-zinc-500">{routingNote}</p>
        </div>
        <div>
          <p className={cn("font-semibold", light ? "text-zinc-900" : "text-zinc-100")}>Clinical safety boundary</p>
          <p className="mt-1">{safetyBoundary}</p>
        </div>
        {clinicianQuestions.length ? (
          <div>
            <p className={cn("font-semibold", light ? "text-zinc-900" : "text-zinc-100")}>What to ask your clinician next</p>
            <ul className={cn("mt-2 space-y-1", light ? "text-zinc-600" : "text-zinc-300")}>
              {clinicianQuestions.map((question) => <li key={question}>- {question}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  )
}

function TrustList({ title, items, empty, light = false }: { title: string; items: string[]; empty: string; light?: boolean }) {
  return (
    <div className={cn("rounded-[12px] border p-3", light ? "border-zinc-200 bg-white" : "border-white/8 bg-black/15")}>
      <p className={cn("font-semibold", light ? "text-zinc-900" : "text-zinc-100")}>{title}</p>
      {items.length ? (
        <ul className={cn("mt-2 space-y-1", light ? "text-zinc-600" : "text-zinc-300")}>
          {items.map((item) => <li key={item}>- {item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-500">{empty}</p>
      )}
    </div>
  )
}
