import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  iconClassName?: string
  size?: "sm" | "md"
}

export function BrandMark({ className, iconClassName, size = "md" }: BrandMarkProps) {
  const dim = size === "sm" ? 14 : 17
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[12px] shadow-card",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className
      )}
      style={{ background: "linear-gradient(135deg, #0D9488, #0F766E)", boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 2px 6px rgba(13,148,136,0.15)" }}
    >
      <svg width={dim} height={dim} viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden>
        <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}

type BrandWordmarkProps = {
  className?: string
  subtitle?: boolean
  subtitleClassName?: string
  titleClassName?: string
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
      <Title className={cn("truncate text-sm font-semibold tracking-[-0.03em] text-primary", titleClassName)}>
        OpenRx
      </Title>
      {subtitle ? (
        <p className={cn("text-[9px] font-medium uppercase tracking-[0.16em] text-muted", subtitleClassName)}>
          Care OS
        </p>
      ) : null}
    </div>
  )
}
