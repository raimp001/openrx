"use client"

import { ArrowRight, Calendar, ClipboardCheck, FlaskConical, MessageSquare, PhoneCall, Stethoscope } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ActionPlanItem } from "@/lib/care-handoff"

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

interface ChatActionPlanProps {
  items: ActionPlanItem[]
  // Optional headline — defaults to a link-oriented label because these cards
  // are explicit exits from the chat, not hidden redirects.
  title?: string
  testIdPrefix?: string
  onPrompt?: (prompt: string, targetAgentId?: ActionPlanItem["targetAgentId"]) => void
}

export function ChatActionPlan({ items, title = "Next step", testIdPrefix = "chat-action", onPrompt }: ChatActionPlanProps) {
  if (!items.length) return null
  const allPromptActions = items.every((item) => item.actionType === "chat_prompt")
  return (
    <section
      data-testid={`${testIdPrefix}-plan`}
      aria-label={title}
      className="rounded-[18px] border border-white/10 bg-[#0b0d0d]/82 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <header className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
          {title}
        </p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/18 bg-cyan-200/[0.075] px-3 py-1.5 text-[12px] font-semibold text-cyan-100 transition hover:border-cyan-200/38 hover:bg-cyan-200/[0.13]"
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/[0.09]"
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
