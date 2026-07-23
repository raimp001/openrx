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
  // Disable prompt actions while an answer is streaming so a click never
  // silently no-ops against the in-flight guard in the chat page.
  disabled?: boolean
  /** Visual surface. "dark" preserves the legacy app-shell styling. */
  surface?: "dark" | "light"
}

export function ChatActionPlan({ items, title = "Next step", layout = "inline", testIdPrefix = "chat-action", onPrompt, disabled = false, surface = "dark" }: ChatActionPlanProps) {
  const light = surface === "light"
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
          : light
            ? "rounded-[14px] border border-zinc-200 bg-zinc-50 p-3"
            : "rounded-[22px] border border-white/12 bg-[#0b0d0d]/88 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
        isRail && !light && "bg-[#090b0b]/90"
      )}
    >
      <header className={cn("mb-2.5 flex items-center justify-between gap-3 px-1", isDock && "sr-only")}>
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", light ? "text-zinc-600" : "text-zinc-200")}>
          {title}
        </p>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
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
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition", light ? "border-cyan-700/20 bg-cyan-50 text-cyan-700 group-hover:border-cyan-700/40 group-hover:bg-cyan-100" : "border-cyan-200/16 bg-cyan-200/[0.10] text-cyan-100 group-hover:border-cyan-200/32 group-hover:bg-cyan-200/[0.16]")}>
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] font-semibold", light ? "text-zinc-900" : "text-zinc-50", isDock ? "line-clamp-2 leading-4" : "truncate")}>{item.label}</span>
                {!isDock ? (
                  <span className={cn("mt-0.5 block text-[11px] font-medium leading-5", light ? "text-zinc-500" : "text-zinc-300")}>
                    {item.description}
                  </span>
                ) : null}
              </span>
              {item.actionType === "chat_prompt" ? null : (
                <ArrowUpRight size={14} className={cn("shrink-0", light ? "text-cyan-700/85" : "text-cyan-100/85")} />
              )}
            </>
          )
          const itemClassName = cn(
            "group flex h-full items-center gap-2.5 rounded-[16px] border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2",
            light && "min-h-11",
            light ? "focus-visible:ring-cyan-700/35" : "focus-visible:ring-cyan-200/35",
            light
              ? item.actionType === "chat_prompt"
                ? "border-cyan-700/25 bg-cyan-50 hover:border-cyan-700/50 hover:bg-cyan-100"
                : "border-zinc-200 bg-white hover:border-cyan-700/35 hover:bg-zinc-50"
              : item.actionType === "chat_prompt"
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
                  disabled={disabled}
                  className={cn(itemClassName, "disabled:cursor-not-allowed disabled:opacity-50")}
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
