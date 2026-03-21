import { cn } from "@/lib/utils"

type AppPageHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: string
  variant?: "default" | "hero"
  className?: string
  actions?: React.ReactNode
  leading?: React.ReactNode
  meta?: React.ReactNode
  align?: "left" | "center"
}

// Shared page chrome for app routes: consistent title, subtitle, and optional actions.
export function AppPageHeader({
  title,
  description,
  eyebrow,
  variant = "default",
  className,
  actions,
  leading,
  meta,
  align = "left",
}: AppPageHeaderProps) {
  const titleClass =
    variant === "hero"
      ? "font-serif text-3xl leading-tight tracking-tight text-warm-800"
      : "font-serif text-2xl tracking-tight text-warm-800"

  return (
    <div
      className={cn(
        "flex gap-4",
        align === "center"
          ? "flex-col items-center text-center"
          : "flex-col sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className={cn("min-w-0 flex-1", align === "center" && "flex flex-col items-center")}>
        <div className={cn("flex items-start gap-3", align === "center" && "flex-col items-center")}>
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          <div className={cn("min-w-0", align === "center" && "text-center")}>
            {eyebrow ? (
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-terra/80">
                {eyebrow}
              </p>
            ) : null}
            <h1 className={titleClass}>{title}</h1>
            {meta ? <div className="mt-1">{meta}</div> : null}
            {description ? (
              <div className="mt-1 max-w-2xl text-sm leading-relaxed text-warm-500">{description}</div>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2",
            align === "center" && "justify-center"
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
}
