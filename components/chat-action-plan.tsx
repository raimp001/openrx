"use client"

import { ArrowRight, Calendar, ClipboardCheck, FlaskConical, MessageSquare, PhoneCall, Stethoscope } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// Action card surfaced in chat answers — gives the user a clinically restrained
// "do something next" prompt instead of leaving them with prose only.
export interface ChatActionPlanItem {
  id: string
  label: string
  description: string
  href: string
  prompt?: string
  // Optional icon hint — falls back to a sensible default per kind.
  kind: "schedule" | "screening" | "lab" | "referral" | "message" | "call" | "education"
}

const KIND_ICON: Record<ChatActionPlanItem["kind"], LucideIcon> = {
  schedule: Calendar,
  screening: ClipboardCheck,
  lab: FlaskConical,
  referral: Stethoscope,
  message: MessageSquare,
  call: PhoneCall,
  education: ClipboardCheck,
}

interface ChatActionPlanProps {
  items: ChatActionPlanItem[]
  // Optional headline — defaults to a link-oriented label because these cards
  // are explicit exits from the chat, not hidden redirects.
  title?: string
  testIdPrefix?: string
  onPrompt?: (prompt: string) => void
}

export function ChatActionPlan({ items, title = "Ask next", testIdPrefix = "chat-action", onPrompt }: ChatActionPlanProps) {
  if (!items.length) return null
  const allPromptActions = items.every((item) => item.prompt && onPrompt)
  return (
    <section
      data-testid={`${testIdPrefix}-plan`}
      aria-label={title}
      className="rounded-[14px] border border-white/12 bg-white/[0.04] p-3"
    >
      <header className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">{title}</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {allPromptActions ? "stays in chat" : "optional links"}
        </span>
      </header>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          const external = /^https?:\/\//.test(item.href)
          const content = (
            <>
              <Icon size={12} />
              <span>{item.label}</span>
              {item.prompt ? null : <ArrowRight size={12} />}
            </>
          )
          return (
            <li key={item.id}>
              {item.prompt && onPrompt ? (
                <button
                  type="button"
                  onClick={() => onPrompt(item.prompt!)}
                  title={item.description}
                  data-testid={`${testIdPrefix}-plan-item`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1.5 text-[12px] font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-200/[0.14]"
                >
                  {content}
                </button>
              ) : (
                <a
                  href={item.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  title={item.description}
                  data-testid={`${testIdPrefix}-plan-item`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1.5 text-[12px] font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/[0.09]"
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
