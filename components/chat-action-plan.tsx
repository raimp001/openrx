"use client"

import { ArrowRight, Calendar, ClipboardCheck, FlaskConical, MessageSquare, PhoneCall, Stethoscope } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ActionPlanItem } from "@/lib/care-handoff"
import { cn } from "@/lib/utils"

// Action card surfaced in chat answers — gives the user a clinically restrained
// "do something next" prompt instead of leaving them with prose only.
const KIND_ICON: Record<ActionPlanItem["kind"], LucideIcon> = {
  schedule: Calendar,
  screening: ClipboardCheck,
  lab: FlaskConical,
  referral: Stethoscope,
  message: MessageSquare,
  call: PhoneCall,
  education: ClipboardCheck,
}

type ActionPlanTone = "dark" | "light"

interface ChatActionPlanProps {
  items: ActionPlanItem[]
  // Optional headline — defaults to a link-oriented label because these cards
  // are explicit exits from the chat, not hidden redirects.
  title?: string
  testIdPrefix?: string
  tone?: ActionPlanTone
  onPrompt?: (prompt: string, targetAgentId?: ActionPlanItem["targetAgentId"]) => void
}

const TONE_STYLES: Record<ActionPlanTone, { shell: string; title: string; kicker: string; promptChip: string; linkChip: string }> = {
  dark: {
    shell: "border-white/10 bg-[#0b0d0d]/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
    title: "text-zinc-300",
    kicker: "text-zinc-500",
    promptChip: "border-cyan-200/18 bg-cyan-200/[0.075] text-cyan-100 hover:border-cyan-200/38 hover:bg-cyan-200/[0.13]",
    linkChip: "border-white/12 bg-white/[0.05] text-zinc-100 hover:border-white/25 hover:bg-white/[0.09]",
  },
  light: {
    shell: "border-[#E7E5E0] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]",
    title: "text-[#57534E]",
    kicker: "text-[#A8A29E]",
    promptChip: "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E] hover:border-[#5EEAD4] hover:bg-[#CCFBF1]",
    linkChip: "border-[#E7E5E0] bg-white text-[#44403C] hover:border-[#D6D3CD] hover:bg-stone-50",
  },
}

export function ChatActionPlan({ items, title = "Next step", testIdPrefix = "chat-action", tone = "dark", onPrompt }: ChatActionPlanProps) {
  if (!items.length) return null
  const allPromptActions = items.every((item) => item.actionType === "chat_prompt")
  const styles = TONE_STYLES[tone]
  return (
    <section
      data-testid={`${testIdPrefix}-plan`}
      aria-label={title}
      className={cn("rounded-[18px] border p-3", styles.shell)}
    >
      <header className="mb-2 flex items-center justify-between">
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", styles.title)}>
          {title}
        </p>
        <span className={cn("text-[10px] uppercase tracking-[0.14em]", styles.kicker)}>
          {allPromptActions ? "stays here" : "sources + actions"}
        </span>
      </header>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          const href = item.href || "#"
          const external = item.actionType === "external_link" || /^https?:\/\//.test(href)
          const tel = item.actionType === "tel_link" || href.startsWith("tel:")
          const target = external && !tel ? "_blank" : undefined
          const rel = external && !tel ? "noreferrer" : undefined
          const content = (
            <>
              <Icon size={12} />
              <span>{item.label}</span>
              {item.actionType === "chat_prompt" ? null : <ArrowRight size={12} />}
            </>
          )
          return (
            <li key={item.id}>
              {item.actionType === "chat_prompt" && item.prompt && onPrompt ? (
                <button
                  type="button"
                  onClick={() => onPrompt(item.prompt!, item.targetAgentId)}
                  title={item.description}
                  data-testid={`${testIdPrefix}-plan-item`}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", styles.promptChip)}
                >
                  {content}
                </button>
              ) : (
                <a
                  href={href}
                  target={target}
                  rel={rel}
                  title={item.description}
                  data-testid={`${testIdPrefix}-plan-item`}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", styles.linkChip)}
                >
                  {content}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
