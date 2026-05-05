"use client"

import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquareText,
  Receipt,
  Sparkles,
} from "lucide-react"
import { useState } from "react"
import { resolveCareHandoff } from "@/lib/care-handoff"
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
  dark?: boolean
  showLanes?: boolean
  className?: string
}

const defaultSuggestions: CareAskSuggestion[] = [
  {
    label: "What screening is due?",
    prompt: "I want to know which preventive screenings may be due and what I should do next.",
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
    detail: "You start with one sentence. OpenRx looks for screening, provider, billing, medication, or follow-up intent.",
    icon: FileText,
  },
  {
    label: "Route to the service",
    detail: "Clear screening and care-search questions open the right workflow directly instead of making you pick a page.",
    icon: Sparkles,
  },
  {
    label: "Prepare the handoff",
    detail: "The next page keeps your question attached, then runs the check or search without a second form.",
    icon: CheckCircle2,
  },
]

export function CareAskPanel({
  eyebrow = "Ask OpenRx",
  title = "Ask once. Open the right care path.",
  description = "Use plain English. OpenRx routes screening, care search, billing, medication, and follow-up questions without asking you to choose the system first.",
  placeholder = "Ask what screening is due, where to go, what a bill means, or what to do next...",
  defaultPrompt = "",
  suggestions = defaultSuggestions,
  lanes = defaultLanes,
  compact = false,
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

    const action = resolveCareHandoff(trimmed, topic || "coordinator")
    if (action && typeof window !== "undefined") {
      window.sessionStorage.setItem(action.storageKey, JSON.stringify(action.payload))
      router.push(action.href)
      return
    }

    if (trimmed) params.set("prompt", trimmed)
    if (topic) params.set("topic", topic)
    if (trimmed) params.set("autorun", "1")
    router.push(`/chat${params.toString() ? `?${params.toString()}` : ""}`)
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[34px] border p-4 shadow-[0_34px_90px_rgba(8,24,46,0.10)] sm:p-5",
        dark
          ? "border-white/12 bg-[#07111f] text-white"
          : "border-[rgba(82,108,139,0.14)] bg-[rgba(255,255,255,0.78)] text-primary backdrop-blur-2xl",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(47,107,255,0.13),transparent_34%),radial-gradient(circle_at_92%_20%,rgba(8,126,139,0.11),transparent_30%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]",
              dark ? "text-white/62" : "text-muted"
            )}
          >
            <Bot size={12} />
            {eyebrow}
          </span>
        </div>

        <div className={cn("mt-3 grid gap-5", showLanes && !compact ? "xl:grid-cols-[1.1fr_0.9fr] xl:items-start" : "lg:grid-cols-1")}>
          <div>
            <h2
              className={cn(
                "max-w-3xl font-serif leading-[0.96] tracking-[-0.055em]",
                compact ? "text-[clamp(1.8rem,3.4vw,2.7rem)]" : "text-[clamp(2.4rem,5vw,4.2rem)]",
                dark ? "text-white" : "text-primary"
              )}
            >
              {title}
            </h2>
            <p className={cn("mt-3 max-w-xl text-sm leading-7", dark ? "text-white/68" : "text-secondary")}>
              {description}
            </p>

            <form
              className={cn(
                "mt-5 overflow-hidden rounded-[28px] border shadow-[0_18px_50px_rgba(8,24,46,0.08)]",
                dark ? "border-white/12 bg-white/[0.06]" : "border-[rgba(82,108,139,0.16)] bg-white/92"
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
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={placeholder}
                rows={compact ? 2 : 2}
                className={cn(
                  "min-h-[104px] w-full resize-none bg-transparent px-4 py-4 text-[15px] leading-7 outline-none placeholder:text-muted sm:px-5",
                  dark ? "text-white placeholder:text-white/42" : "text-primary"
                )}
              />
              <div
                className={cn(
                  "flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                  dark ? "border-white/10" : "border-[rgba(82,108,139,0.12)]"
                )}
              >
                <div className={cn("hidden items-center gap-2 text-xs sm:flex", dark ? "text-white/56" : "text-muted")}>
                  <MessageSquareText size={13} />
                  Routes to screening, care search, billing, meds, or follow-up.
                </div>
                <button
                  type="submit"
                  disabled={isLaunching}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition disabled:opacity-70",
                    dark ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-white shadow-[0_14px_34px_rgba(7,17,31,0.18)] hover:bg-[#12213a]"
                  )}
                >
                  {isLaunching ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  Ask OpenRx
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => openChat(suggestion.prompt, suggestion.topic)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                    dark
                      ? "border-white/12 bg-white/[0.06] text-white/72 hover:bg-white/10 hover:text-white"
                      : "border-[rgba(82,108,139,0.12)] bg-white/76 text-secondary hover:border-accent/24 hover:bg-[rgba(47,107,255,0.07)] hover:text-primary"
                  )}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>

          {showLanes ? <div className={cn("grid gap-3", compact && "sm:grid-cols-3")}>
            {lanes.map((lane, index) => (
              <div
                key={lane.label}
                className={cn(
                  "rounded-[22px] border p-4",
                  dark ? "border-white/10 bg-white/[0.055]" : "border-[rgba(82,108,139,0.12)] bg-white/74"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      dark ? "bg-white/10 text-white" : "bg-[rgba(47,107,255,0.08)] text-accent"
                    )}
                  >
                    <lane.icon size={16} strokeWidth={1.7} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/42" : "text-muted")}>
                        0{index + 1}
                      </span>
                      <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-primary")}>{lane.label}</p>
                    </div>
                    <p className={cn("mt-2 text-[12px] leading-6", dark ? "text-white/62" : "text-secondary")}>{lane.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div> : null}
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
    prompt: "Tell me which screenings, vaccines, or preventive tasks should be scheduled next.",
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
    label: "Start the right workflow",
    detail: "If the answer needs scheduling, billing, medication, or screening follow-up, it gets routed there.",
    icon: Sparkles,
  },
  {
    label: "Return with actions",
    detail: "You get a short answer, links to the right page, and the next safest step to take.",
    icon: Receipt,
  },
]
