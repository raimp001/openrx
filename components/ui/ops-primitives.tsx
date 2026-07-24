import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Solid signal bars and quiet tinted chips: state is announced with one flat
// color, never a gradient — the instrument reads, it doesn't decorate.
const toneStyles = {
  terra: {
    bar: "bg-coral/70",
    icon: "bg-coral/10 text-coral",
    badge: "border-coral/20 bg-coral/8 text-coral",
  },
  accent: {
    bar: "bg-accent/70",
    icon: "bg-accent/10 text-accent",
    badge: "border-accent/20 bg-accent/8 text-accent",
  },
  blue: {
    bar: "bg-soft-blue/70",
    icon: "bg-soft-blue/10 text-soft-blue",
    badge: "border-soft-blue/20 bg-soft-blue/8 text-soft-blue",
  },
  gold: {
    bar: "bg-amber-300/70",
    icon: "bg-amber-100 text-amber-700",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  red: {
    bar: "bg-soft-red/70",
    icon: "bg-soft-red/10 text-soft-red",
    badge: "border-soft-red/20 bg-soft-red/8 text-soft-red",
  },
} as const

type Tone = keyof typeof toneStyles

export function OpsMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "terra",
  className,
}: {
  label: string
  value: string
  detail?: string
  icon: LucideIcon
  tone?: Tone
  className?: string
}) {
  const styles = toneStyles[tone]

  return (
    <div className={cn("surface-card relative overflow-hidden p-5", className)}>
      <div className={cn("stat-card-accent", styles.bar)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-title">{label}</div>
          <div className="font-data mt-3 text-[26px] font-medium leading-none text-primary">
            {value}
          </div>
          {detail ? <p className="mt-2 text-xs leading-5 text-secondary">{detail}</p> : null}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]", styles.icon)}>
          <Icon size={17} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

export function OpsBriefCard({
  label,
  title,
  detail,
  tone = "terra",
  className,
}: {
  label: string
  title: string
  detail?: string
  tone?: Tone
  className?: string
}) {
  const styles = toneStyles[tone]

  return (
    <div className={cn("surface-card relative overflow-hidden p-5", className)}>
      <div className={cn("stat-card-accent", styles.bar)} />
      <div className="section-title">{label}</div>
      <p className="mt-3 text-sm font-semibold leading-6 text-primary">{title}</p>
      {detail ? <p className="mt-2 text-xs leading-5 text-secondary">{detail}</p> : null}
    </div>
  )
}

export function OpsPanel({
  title,
  description,
  eyebrow,
  actions,
  className,
  children,
}: {
  title: string
  description?: string
  eyebrow?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("surface-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <div className="section-title mb-2">{eyebrow}</div> : null}
          <h2 className="text-xl font-semibold text-primary">{title}</h2>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function OpsBadge({
  children,
  tone = "terra",
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", toneStyles[tone].badge, className)}>
      {children}
    </span>
  )
}

export function OpsTabButton({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-button border px-3 py-1.5 text-[11px] font-medium transition",
        active
          ? "border-cyan-700 bg-cyan-700 text-white"
          : "border-border bg-white text-secondary hover:border-teal/40 hover:bg-zinc-100 hover:text-primary"
      )}
    >
      {children}
    </button>
  )
}

export function OpsEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}) {
  return (
    <div className={cn("surface-muted flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-muted shadow-sm">
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted">{description}</p>
      </div>
    </div>
  )
}
