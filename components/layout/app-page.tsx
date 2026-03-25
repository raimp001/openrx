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
      ? "text-2xl font-semibold tracking-tight text-primary sm:text-3xl"
      : "text-xl font-semibold tracking-tight text-primary sm:text-2xl"

  return (
    <section
      className={cn(
        "surface-card p-5 sm:p-6",
        align === "center" && "text-center",
        className
      )}
    >
      <div
        className={cn(
          "flex gap-5",
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
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-secondary">{eyebrow}</span>
              ) : null}
              <h1 className={titleClass}>{title}</h1>
              {meta ? <div className="mt-3">{meta}</div> : null}
              {description ? (
                <div className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary">{description}</div>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[34%] xl:justify-end",
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
