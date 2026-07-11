"use client"

import Link from "next/link"
import {
  ArrowRight,
  Building2,
  ExternalLink,
  FileText,
  FlaskConical,
  HeartPulse,
  MessageSquare,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type AnswerActionIcon =
  | "care"
  | "chat"
  | "network"
  | "note"
  | "pharmacy"
  | "screening"
  | "search"
  | "shield"
  | "source"
  | "trials"

export interface AnswerActionItem {
  id: string
  label: string
  description?: string
  href?: string
  external?: boolean
  icon?: AnswerActionIcon
  tone?: "primary" | "secondary"
  testId?: string
  onClick?: () => void
}

const ICONS: Record<AnswerActionIcon, LucideIcon> = {
  care: Stethoscope,
  chat: MessageSquare,
  network: Building2,
  note: FileText,
  pharmacy: Pill,
  screening: HeartPulse,
  search: Search,
  shield: ShieldCheck,
  source: ExternalLink,
  trials: FlaskConical,
}

const COLUMN_CLASS = {
  single: "grid-cols-1",
  two: "grid-cols-1 sm:grid-cols-2",
  three: "grid-cols-1 sm:grid-cols-3",
} as const

interface AnswerActionGridProps {
  items: AnswerActionItem[]
  className?: string
  columns?: keyof typeof COLUMN_CLASS
  label?: string
}

export function AnswerActionGrid({
  items,
  className,
  columns = "two",
  label = "Next actions",
}: AnswerActionGridProps) {
  if (!items.length) return null

  return (
    <div aria-label={label} className={cn("grid gap-2", COLUMN_CLASS[columns], className)}>
      {items.map((item) => {
        const Icon = ICONS[item.icon || "care"]
        const isPrimary = item.tone === "primary"
        const href = item.href || "#"
        const external = item.external || /^https?:\/\//.test(href)
        const className = cn(
          "group flex min-h-12 w-full items-center justify-between gap-3 rounded-full border px-3.5 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/40",
          isPrimary
            ? "border-cyan-200/40 bg-cyan-200 text-black shadow-[0_14px_34px_rgba(103,232,249,0.13)] hover:bg-cyan-100"
            : "border-white/10 bg-white/[0.045] text-zinc-100 hover:border-cyan-200/28 hover:bg-white/[0.075]"
        )
        const content = (
          <>
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon
                size={16}
                aria-hidden="true"
                className={cn(
                  "shrink-0 transition",
                  isPrimary ? "text-black/72" : "text-zinc-300 group-hover:text-cyan-100"
                )}
              />
              <span className="min-w-0">
                <span className="block truncate leading-5">{item.label}</span>
                {item.description ? (
                  <span
                    className={cn(
                      "block truncate text-[11px] font-medium leading-4",
                      isPrimary ? "text-black/62" : "text-zinc-400"
                    )}
                  >
                    {item.description}
                  </span>
                ) : null}
              </span>
            </span>
            <ArrowRight
              size={13}
              aria-hidden="true"
              className={cn(
                "shrink-0 transition",
                isPrimary ? "text-black/70" : "text-zinc-600 group-hover:text-cyan-100"
              )}
            />
          </>
        )

        if (item.onClick) {
          return (
            <button key={item.id} type="button" onClick={item.onClick} data-testid={item.testId} className={className}>
              {content}
            </button>
          )
        }

        if (external) {
          return (
            <a
              key={item.id}
              href={href}
              target="_blank"
              rel="noreferrer"
              data-testid={item.testId}
              className={className}
            >
              {content}
            </a>
          )
        }

        return (
          <Link key={item.id} href={href} data-testid={item.testId} className={className}>
            {content}
          </Link>
        )
      })}
    </div>
  )
}
