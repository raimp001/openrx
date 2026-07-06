"use client"

import { ArrowUpRight, Calendar, ClipboardCheck, FlaskConical, MessageSquare, PhoneCall, Stethoscope } from "lucide-react"
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

interface ChatActionPlanProps {
  items: ActionPlanItem[]
  // Optional headline — defaults to a link-oriented label because these cards
  // are explicit exits from the chat, not hidden redirects.
  title?: string
  layout?: "inline" | "rail" | "dock"
  testIdPrefix?: string
  onPrompt?: (prompt: string, targetAgentId?: ActionPlanItem["targetAgentId"]) => void
}

export function ChatActionPlan({ items, title = "Next step", layout = "inline", testIdPrefix = "chat-action", onPrompt }: ChatActionPlanProps) {
  if (!items.length) return null
  const allPromptActions = items.every((item) => item.actionType === "chat_prompt")
  const isRail = layout === "rail"
  const isDock = layout === "dock"
  return (
    <section
      data-testid={`${testIdPrefix}-plan`}
      aria-label={title}
      className={cn(
        isDock
          ? "border-0 bg-transparent p-0 shadow-none"
          : "rounded-[22px] border border-white/12 bg-[#0b0d0d]/88 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
        isRail && "bg-[#090b0b]/90"
      )}
    >
      <header className={cn("mb-2.5 flex items-center justify-between gap-3 px-1", isDock && "sr-only")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
          {title}
        </p>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          {allPromptActions ? "stays here" : "sources + actions"}
        </span>
      </header>
      <ul className={cn(isDock ? "flex flex-wrap gap-2 pb-0.5" : "grid gap-2", layout === "inline" && "sm:grid-cols-2")}>
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          const href = item.href || "#"
          const external = item.actionType === "external_link" || /^https?:\/\//.test(href)
          const tel = item.actionType === "tel_link" || href.startsWith("tel:")
          const target = external && !tel ? "_blank" : undefined
          const rel = external && !tel ? "noreferrer" : undefined
          const content = (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-200/16 bg-cyan-200/[0.10] text-cyan-100 transition group-hover:border-cyan-200/32 group-hover:bg-cyan-200/[0.16]">
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] font-semibold text-zinc-50", isDock ? "line-clamp-2 leading-4" : "truncate")}>{item.label}</span>
                {!isDock ? (
                  <span className="mt-0.5 block text-[11px] font-medium leading-5 text-zinc-300">
                    {item.description}
                  </span>
                ) : null}
              </span>
              {item.actionType === "chat_prompt" ? null : (
                <ArrowUpRight size={14} className="shrink-0 text-cyan-100/85" />
              )}
            </>
          )
          const itemClassName = cn(
            "group flex h-full items-center gap-2.5 rounded-[16px] border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/35",
            item.actionType === "chat_prompt"
              ? "border-cyan-200/20 bg-cyan-200/[0.08] hover:border-cyan-200/40 hover:bg-cyan-200/[0.14]"
              : "border-white/12 bg-white/[0.055] hover:border-cyan-200/28 hover:bg-white/[0.095]",
            isDock && "min-h-11 rounded-full px-3.5 py-2",
            "w-full"
          )
          return (
            <li key={item.id} className={cn("min-w-0", isDock && "flex-1 basis-[180px]")}>
              {item.actionType === "chat_prompt" && item.prompt && onPrompt ? (
                <button
                  type="button"
                  onClick={() => onPrompt(item.prompt!, item.targetAgentId)}
                  title={item.description}
                  data-testid={`${testIdPrefix}-plan-item`}
                  className={itemClassName}
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
                  className={itemClassName}
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
