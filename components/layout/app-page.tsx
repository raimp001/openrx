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
      ? "font-serif text-3xl leading-[1.02] tracking-[-0.05em] text-warm-800 sm:text-[2.6rem]"
      : "font-serif text-[1.9rem] leading-tight tracking-[-0.04em] text-warm-800"

  return (
    <section
      className={cn(
        "surface-card relative isolate overflow-hidden p-5 sm:p-6",
        align === "center"
          ? "text-center"
          : "",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-7rem] h-64 w-64 rounded-full bg-terra/12 blur-3xl" />
        <div className="absolute bottom-[-7rem] left-[-4rem] h-52 w-52 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(90deg,rgba(255,255,255,0.4),transparent)]" />
      </div>
      <div
        className={cn(
          "relative flex gap-5",
          align === "center"
            ? "flex-col items-center text-center"
            : "flex-col xl:flex-row xl:items-start xl:justify-between"
        )}
      >
        <div className={cn("min-w-0 flex-1", align === "center" && "flex flex-col items-center")}>
          <div className={cn("flex items-start gap-4", align === "center" && "flex-col items-center")}>
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          <div className={cn("min-w-0", align === "center" && "text-center")}>
            {eyebrow ? (
              <span className="eyebrow-pill mb-3">{eyebrow}</span>
            ) : null}
            <h1 className={titleClass}>{title}</h1>
            {meta ? <div className="mt-3">{meta}</div> : null}
            {description ? (
              <div className="mt-3 max-w-3xl text-sm leading-7 text-warm-500 sm:text-[15px]">{description}</div>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? (
        <div
          className={cn(
            "relative flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[34%] xl:justify-end",
            align === "center" && "justify-center"
          )}
        >
          {actions}
        </div>
      ) : null}
      </div>
    </section>
  )
}
