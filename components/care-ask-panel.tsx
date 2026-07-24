"use client"

import { useRouter } from "next/navigation"
import {
  ArrowUp,
  Loader2,
  Sparkles,
  ClipboardList,
  Receipt,
  FileText,
  CheckCircle2,
  Bot,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type CareAskSuggestion = {
  label: string
  prompt: string
  topic?: string
}

type BackgroundLane = {
  label: string
  detail: string
  icon: typeof Bot
}

type CareAskPanelProps = {
  eyebrow?: string
  title?: string
  description?: string
  placeholder?: string
  defaultPrompt?: string
  suggestions?: CareAskSuggestion[]
  lanes?: BackgroundLane[]
  compact?: boolean
  minimal?: boolean
  dark?: boolean
  showLanes?: boolean
  className?: string
}

const defaultSuggestions: CareAskSuggestion[] = [
  {
    label: "What screening is due?",
    prompt: "What cancer screening does a 50-year-old woman need?",
    topic: "screening",
  },
  {
    label: "Find primary care",
    prompt: "Find a primary care option near me and explain what to ask before booking.",
    topic: "scheduling",
  },
  {
    label: "Explain a bill",
    prompt: "Help me understand a medical bill or denied claim and what to check first.",
    topic: "billing",
  },
  {
    label: "What should I do next?",
    prompt: "Tell me the highest-priority next step and route me to the right care service.",
    topic: "coordinator",
  },
]

const defaultLanes: BackgroundLane[] = [
  {
    label: "Understand the ask",
    detail:
      "You start with one sentence. OpenRx looks for screening, provider, billing, medication, or follow-up intent.",
    icon: FileText,
  },
  {
    label: "Answer in chat",
    detail:
      "Screening and clinical questions answer directly in chat with guideline links. No extra forms unless they're essential.",
    icon: Sparkles,
  },
  {
    label: "Hand off only when needed",
    detail:
      "If a real action is needed — booking, paying a bill, prior auth — OpenRx prepares it from the same conversation.",
    icon: CheckCircle2,
  },
]

export function CareAskPanel({
  eyebrow = "Ask OpenRx",
  title = "Ask once. Get the answer in chat.",
  description = "Use plain English. Screening and clinical guidance answer directly in chat; care search, billing, medication, and follow-up actions stay one step away.",
  placeholder = "Ask what screening is due, what a bill means, or what to do next…",
  defaultPrompt = "",
  suggestions = defaultSuggestions,
  lanes = defaultLanes,
  compact = false,
  minimal = false,
  dark = false,
  showLanes = false,
  className,
}: CareAskPanelProps) {
  const router = useRouter()
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [isLaunching, setIsLaunching] = useState(false)

  function openChat(nextPrompt = prompt, topic?: string) {
    setIsLaunching(true)
    const params = new URLSearchParams()
    const trimmed = nextPrompt.trim()

    if (trimmed) params.set("prompt", trimmed)
    if (topic) params.set("topic", topic)
    if (trimmed) params.set("autorun", "1")
    router.push(`/chat${params.toString() ? `?${params.toString()}` : ""}`)
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[18px] border p-4 sm:p-5",
        minimal && "p-2 sm:p-2",
        dark ? "border-white/15 bg-[#0B1B33] text-white" : "border-zinc-200 bg-white text-primary",
        !minimal && "shadow-card",
        className
      )}
    >
      <div className="relative">
        {!minimal && (eyebrow || title || description) ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                dark ? "text-white/64" : "text-muted"
              )}
            >
              <Bot size={11} />
              {eyebrow}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            minimal ? "grid gap-0" : "grid gap-5",
            showLanes && !compact && !minimal ? "xl:grid-cols-[1.1fr_0.9fr] xl:items-start" : ""
          )}
        >
          <div>
            {!minimal && title ? (
              <h2
                className={cn(
                  "orx-section-heading max-w-3xl",
                  compact
                    ? "text-[clamp(1.4rem,2.2vw,1.85rem)]"
                    : "text-[clamp(1.6rem,2.6vw,2.1rem)]",
                  dark ? "text-white" : "text-primary"
                )}
              >
                {title}
              </h2>
            ) : null}
            {!minimal && description ? (
              <p className={cn("mt-2.5 max-w-xl text-[14px] leading-6", dark ? "text-white/72" : "text-muted")}>
                {description}
              </p>
            ) : null}

            <form
              className={cn(
                "overflow-hidden rounded-[16px] border",
                !minimal && "mt-4",
                dark ? "border-white/15 bg-white/[0.04]" : "border-zinc-200 bg-white",
                "shadow-card focus-within:border-cyan-700/45 focus-within:shadow-[0_0_0_3px_rgba(14,116,144,0.12)]"
              )}
              onSubmit={(event) => {
                event.preventDefault()
                openChat()
              }}
            >
              <label htmlFor="openrx-care-ask" className="sr-only">
                Ask OpenRx
              </label>
              <textarea
                id="openrx-care-ask"
                data-testid="care-ask-input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={placeholder}
                rows={2}
                className={cn(
                  "min-h-[88px] w-full resize-none border-0 bg-transparent px-4 py-3 text-[15px] leading-6 outline-none placeholder:text-subtle sm:px-4",
                  dark ? "text-white placeholder:text-white/50" : "text-primary"
                )}
              />
              <div
                className={cn(
                  "flex items-center justify-between gap-2 px-3 pb-2 pt-1",
                  dark ? "border-white/10" : "border-border"
                )}
              >
                <span
                  className={cn(
                    "hidden items-center gap-1.5 text-[11px] sm:inline-flex",
                    dark ? "text-white/56" : "text-muted"
                  )}
                >
                  Decision support — not a substitute for clinician judgment.
                </span>
                <button
                  type="submit"
                  data-testid="care-ask-submit"
                  disabled={isLaunching}
                  aria-label="Ask OpenRx"
                  className={cn(
                    "inline-flex h-11 w-11 items-center justify-center rounded-[10px] transition disabled:cursor-not-allowed disabled:opacity-50",
                    dark ? "bg-white text-primary hover:bg-white/90" : "bg-cyan-700 text-white hover:bg-cyan-800"
                  )}
                >
                  {isLaunching ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowUp size={14} />
                  )}
                </button>
              </div>
            </form>

            {!minimal ? (
              <p className={cn("mt-3 max-w-xl text-[12px] leading-5", dark ? "text-white/56" : "text-muted")}>
                Answers drawn from USPSTF, CDC, NCCN, ACS, and CMS guidance — every recommendation names its source and date.
              </p>
            ) : null}
            <div className={cn("mt-3 flex flex-wrap gap-2", minimal && "justify-center")}>
              {suggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => openChat(suggestion.prompt, suggestion.topic)}
                  data-testid="care-ask-suggestion"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                    dark
                      ? "border-white/15 bg-white/[0.06] text-white/76 hover:bg-white/10 hover:text-white"
                      : "border-white/10 bg-white/[0.045] text-secondary hover:border-cyan-200/24 hover:bg-cyan-200/[0.07] hover:text-primary"
                  )}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>

          {showLanes && !minimal ? (
            <div className={cn("grid", compact && "sm:grid-cols-3 sm:gap-x-6")}>
              {lanes.map((lane, index) => (
                <div
                  key={lane.label}
                  className={cn(
                    "border-t py-4 first:border-t-0 first:pt-0 sm:first:pt-4",
                    compact && "sm:border-t-0 sm:border-l sm:pl-5 sm:first:border-l-0 sm:first:pl-0",
                    dark ? "border-white/12" : "border-zinc-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <lane.icon
                      size={15}
                      strokeWidth={1.8}
                      className={cn("mt-0.5 shrink-0", dark ? "text-white/72" : "text-muted")}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-[0.12em]",
                            dark ? "text-white/48" : "text-muted"
                          )}
                        >
                          0{index + 1}
                        </span>
                        <p className={cn("text-[14px] font-semibold", dark ? "text-white" : "text-primary")}>
                          {lane.label}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "mt-1.5 text-[13px] leading-6",
                          dark ? "text-white/68" : "text-muted"
                        )}
                      >
                        {lane.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export const careAskSuggestions = defaultSuggestions

export const dashboardCareAskSuggestions: CareAskSuggestion[] = [
  {
    label: "What is most urgent?",
    prompt: "Review my current care brief and tell me the one thing I should handle first.",
    topic: "coordinator",
  },
  {
    label: "Explain my labs",
    prompt: "Summarize my recent lab results in plain language and flag what I should ask my clinician.",
    topic: "coordinator",
  },
  {
    label: "Fix a coverage issue",
    prompt: "Check whether any claim, prior approval, or bill needs action before care is delayed.",
    topic: "billing",
  },
  {
    label: "Plan preventive care",
    prompt: "What screenings, vaccines, or preventive tasks should be considered for a 55-year-old man?",
    topic: "screening",
  },
]

export const patientBackgroundLanes: BackgroundLane[] = [
  {
    label: "Check the chart signals",
    detail: "OpenRx looks across prescriptions, labs, appointments, messages, and coverage items.",
    icon: ClipboardList,
  },
  {
    label: "Answer in chat first",
    detail: "OpenRx responds in chat with sources, then offers a handoff only when an action is needed.",
    icon: Sparkles,
  },
  {
    label: "Return with actions",
    detail: "You get the answer, source links, and the next safest step without hunting through pages.",
    icon: Receipt,
  },
]
