import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const toneStyles = {
  terra: {
    bar: "bg-gradient-to-r from-terra to-terra-light",
    icon: "bg-terra/12 text-terra",
    badge: "border-terra/20 bg-terra/10 text-terra",
  },
  accent: {
    bar: "bg-gradient-to-r from-accent to-emerald-400",
    icon: "bg-accent/12 text-accent",
    badge: "border-accent/20 bg-accent/10 text-accent",
  },
  blue: {
    bar: "bg-gradient-to-r from-soft-blue to-sky-400",
    icon: "bg-soft-blue/12 text-soft-blue",
    badge: "border-soft-blue/20 bg-soft-blue/10 text-soft-blue",
  },
  gold: {
    bar: "bg-gradient-to-r from-amber-400 to-yellow-300",
    icon: "bg-amber-200/35 text-amber-700",
    badge: "border-amber-300/35 bg-amber-100/70 text-amber-700",
  },
  red: {
    bar: "bg-gradient-to-r from-soft-red to-rose-400",
    icon: "bg-soft-red/12 text-soft-red",
    badge: "border-soft-red/20 bg-soft-red/10 text-soft-red",
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
    <div className={cn("surface-card relative overflow-hidden p-4 sm:p-5", className)}>
      <div className={cn("stat-card-accent", styles.bar)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-title">{label}</div>
          <div className="mt-3 font-serif text-[2rem] leading-none tracking-[-0.04em] text-warm-800">
            {value}
          </div>
          {detail ? <p className="mt-2 text-xs leading-5 text-warm-500">{detail}</p> : null}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", styles.icon)}>
          <Icon size={18} />
        </div>
      </div>
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
    <section className={cn("surface-card p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <div className="section-title mb-2">{eyebrow}</div> : null}
          <h2 className="text-xl font-serif text-warm-800">{title}</h2>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-warm-500">{description}</p> : null}
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold", toneStyles[tone].badge, className)}>
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
        "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
        active
          ? "border-terra bg-terra text-white shadow-sm"
          : "border-sand bg-white/70 text-warm-600 hover:border-terra/30 hover:text-warm-800"
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-cloudy shadow-sm">
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-semibold text-warm-700">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-cloudy">{description}</p>
      </div>
    </div>
  )
}
