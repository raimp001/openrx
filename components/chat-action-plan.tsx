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
}

export function ChatActionPlan({ items, title = "Next links", testIdPrefix = "chat-action" }: ChatActionPlanProps) {
  if (!items.length) return null
  return (
    <section
      data-testid={`${testIdPrefix}-plan`}
      aria-label={title}
      className="rounded-[14px] border border-white/16 bg-white/[0.055] p-3"
    >
      <header className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">{title}</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">{items.length} option{items.length === 1 ? "" : "s"}</span>
      </header>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          const external = /^https?:\/\//.test(item.href)
          return (
            <li key={item.id}>
              <a
                href={item.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                data-testid={`${testIdPrefix}-plan-item`}
                className="group flex items-start justify-between gap-3 rounded-[11px] border border-white/12 bg-black/30 px-3 py-2.5 text-[13px] transition hover:border-cyan-200/35 hover:bg-white/[0.085]"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-white/12 bg-white/[0.075] text-cyan-200">
                    <Icon size={13} />
                  </span>
                  <span>
                    <span className="block font-medium text-zinc-100">{item.label}</span>
                    <span className="block text-[12px] leading-5 text-zinc-400">{item.description}</span>
                  </span>
                </div>
                <ArrowRight size={14} className="mt-1 shrink-0 text-zinc-400 transition group-hover:text-cyan-200" />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
