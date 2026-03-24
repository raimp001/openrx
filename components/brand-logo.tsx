import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  iconClassName?: string
  size?: "sm" | "md"
}

/** Shared cross mark used on landing header and sidebar for brand continuity. */
export function BrandMark({ className, iconClassName, size = "md" }: BrandMarkProps) {
  const dim = size === "sm" ? 14 : 17
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[18px] border border-black/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,241,234,0.96))] shadow-[0_10px_24px_rgba(17,34,30,0.06)]",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className
      )}
    >
      <svg width={dim} height={dim} viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden>
        <path d="M12 4v16M4 12h16" stroke="#c65a45" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}

type BrandWordmarkProps = {
  className?: string
  subtitle?: boolean
  subtitleClassName?: string
  /** Default `text-sm`; sidebar uses `text-[15px]` */
  titleClassName?: string
  /** Use `p` for sidebar (page supplies the real `h1`); `span` for compact inline */
  titleAs?: "p" | "span"
}

export function BrandWordmark({
  className,
  subtitle = true,
  subtitleClassName,
  titleClassName,
  titleAs = "p",
}: BrandWordmarkProps) {
  const Title = titleAs
  return (
    <div className={cn("min-w-0", className)}>
      <Title className={cn("truncate text-sm font-semibold tracking-[-0.05em] text-warm-800", titleClassName)}>
        OpenRx
      </Title>
      {subtitle ? (
        <p className={cn("text-[9px] font-semibold uppercase tracking-[0.24em] text-cloudy/80", subtitleClassName)}>
          Care OS
        </p>
      ) : null}
    </div>
  )
}
