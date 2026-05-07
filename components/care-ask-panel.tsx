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

    // Always answer in chat first. Specialist topics still get routed via the
    // topic agent, but "how do I…" or "what should I do…" prompts no longer
    // skip past the chat answer.
    if (trimmed) params.set("prompt", trimmed)
    if (topic) params.set("topic", topic)
    if (trimmed) params.set("autorun", "1")
    router.push(`/chat${params.toString() ? `?${params.toString()}` : ""}`)
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[16px] border bg-white p-4 sm:p-5",
        minimal && "p-2 sm:p-2",
        dark ? "border-white/15 bg-[#0B1B33] text-white" : "border-border text-primary",
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
                  "max-w-3xl font-semibold leading-[1.1] tracking-[-0.018em]",
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
                "overflow-hidden rounded-[12px] border bg-white",
                !minimal && "mt-4",
                dark ? "border-white/15 bg-white/[0.04]" : "border-border-strong",
                "shadow-card focus-within:border-teal/60 focus-within:shadow-focus"
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
                    "inline-flex h-9 w-9 items-center justify-center rounded-[10px] transition disabled:cursor-not-allowed disabled:opacity-50",
                    dark ? "bg-white text-primary hover:bg-white/90" : "bg-navy text-white hover:bg-navy-hover"
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
                      : "border-border bg-white text-secondary hover:border-border-strong hover:bg-surface-2 hover:text-primary"
                  )}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>

          {showLanes && !minimal ? (
            <div className={cn("grid gap-3", compact && "sm:grid-cols-3")}>
              {lanes.map((lane, index) => (
                <div
                  key={lane.label}
                  className={cn(
                    "rounded-[14px] border p-4",
                    dark ? "border-white/12 bg-white/[0.05]" : "border-border bg-white"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                        dark ? "bg-white/10 text-white" : "bg-teal-50 text-teal-dark"
                      )}
                    >
                      <lane.icon size={15} strokeWidth={1.8} />
                    </div>
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
