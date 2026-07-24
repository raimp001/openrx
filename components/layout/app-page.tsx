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
      ? "text-[clamp(2.35rem,5vw,4.2rem)] text-primary"
      : "text-[clamp(1.9rem,3.4vw,3rem)] text-primary"

  return (
    <section
      className={cn(
        "relative border-b border-zinc-200 pb-5 sm:pb-6",
        variant === "hero" && "pb-6 sm:pb-8",
        className
      )}
    >
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
              {eyebrow ? <span className="eyebrow-pill mb-3">{eyebrow}</span> : null}
              <h1 className={cn("orx-page-title max-w-3xl", titleClass)}>{title}</h1>
              {description ? (
                <div className="mt-3 max-w-2xl text-[14px] leading-7 text-secondary sm:text-[15px]">{description}</div>
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
            "relative mt-6 grid gap-px overflow-hidden border-y border-zinc-200 bg-zinc-200 sm:grid-cols-4",
            align === "center" && "mx-auto max-w-2xl"
          )}
          aria-label="OpenRx care pathway"
        >
          {executionLoop.map((item, index) => (
            <div key={item} className="flex items-center gap-2.5 bg-white px-3.5 py-2.5">
              <span className="font-data text-[10px] text-cyan-700">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-[12px] font-medium text-primary">{item}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
