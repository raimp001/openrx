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
        "flex shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#ffca9d_0%,#e05b43_42%,#7a261d_100%)] shadow-[0_14px_28px_rgba(224,91,67,0.22)] ring-1 ring-white/30",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className
      )}
    >
      <svg width={dim} height={dim} viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden>
        <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
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
      <Title className={cn("truncate font-semibold tracking-[-0.04em] text-warm-800", titleClassName ?? "text-sm")}>
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
