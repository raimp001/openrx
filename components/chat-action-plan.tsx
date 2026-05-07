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
  // Optional headline — defaults to "Action plan".
  title?: string
  testIdPrefix?: string
}

export function ChatActionPlan({ items, title = "Action plan", testIdPrefix = "chat-action" }: ChatActionPlanProps) {
  if (!items.length) return null
  return (
    <section
      data-testid={`${testIdPrefix}-plan`}
      aria-label={title}
      className="rounded-[12px] border border-border-strong bg-white p-3"
    >
      <header className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{items.length} step{items.length === 1 ? "" : "s"}</span>
      </header>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          return (
            <li key={item.id}>
              <a
                href={item.href}
                data-testid={`${testIdPrefix}-plan-item`}
                className="group flex items-start justify-between gap-3 rounded-[10px] border border-border bg-white px-3 py-2 text-[13px] transition hover:border-border-strong hover:bg-surface-2"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-teal-dark">
                    <Icon size={13} />
                  </span>
                  <span>
                    <span className="block font-medium text-primary">{item.label}</span>
                    <span className="block text-[12px] text-muted">{item.description}</span>
                  </span>
                </div>
                <ArrowRight size={14} className="mt-1 shrink-0 text-muted transition group-hover:text-primary" />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
