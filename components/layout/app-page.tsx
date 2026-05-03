import { cn } from "@/lib/utils"

const executionLoop = ["Ask", "Plan", "Move", "Follow up"]

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
      ? "text-[clamp(2.6rem,5.4vw,4.9rem)] text-primary"
      : "text-[clamp(2.1rem,3.8vw,3.4rem)] text-primary"

  return (
    <section
      className={cn(
        "surface-hero relative overflow-hidden p-5 sm:p-6",
        variant === "hero" && "p-6 sm:p-8",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(47,107,255,0.12),transparent_28%),radial-gradient(circle_at_92%_12%,rgba(8,126,139,0.10),transparent_24%)]" />
      <div
        className={cn(
          "relative flex gap-5",
          align === "center"
            ? "flex-col items-center text-center"
            : "flex-col xl:flex-row xl:items-end xl:justify-between"
        )}
      >
        <div className={cn("min-w-0 flex-1", align === "center" && "flex flex-col items-center")}>
          <div className={cn("flex items-start gap-4", align === "center" && "flex-col items-center")}>
            {leading ? <div className="shrink-0 pt-1">{leading}</div> : null}
            <div className={cn("min-w-0 pl-0", align === "center" && "text-center")}>
              {eyebrow ? <span className="eyebrow-pill mb-4">{eyebrow}</span> : null}
              <h1 className={cn("max-w-4xl text-balance", titleClass)}>{title}</h1>
              {description ? (
                <div className="mt-3 max-w-2xl text-[15px] leading-7 text-secondary">{description}</div>
              ) : null}
              {meta ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">{meta}</div>
                </>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div
            className={cn(
              "relative flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[38%] xl:justify-end xl:self-start",
              align === "center" && "justify-center"
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {variant === "hero" ? (
        <div
          className={cn(
            "relative mt-6 grid gap-2 rounded-[22px] border border-[rgba(82,108,139,0.12)] bg-white/52 p-2 backdrop-blur sm:grid-cols-4",
            align === "center" && "mx-auto max-w-2xl"
          )}
          aria-label="OpenRx care pathway"
        >
          {executionLoop.map((item, index) => (
            <div key={item} className="flex items-center gap-2 rounded-[16px] px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-[12px] font-semibold text-primary">{item}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
