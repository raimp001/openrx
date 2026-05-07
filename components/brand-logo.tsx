import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  iconClassName?: string
  size?: "sm" | "md" | "lg"
  tone?: "light" | "dark"
}

const SIZE_PX: Record<NonNullable<BrandMarkProps["size"]>, { box: number; svg: number }> = {
  sm: { box: 32, svg: 18 },
  md: { box: 40, svg: 22 },
  lg: { box: 56, svg: 32 },
}

/**
 * OpenRx mark: a geometric decision lens. The nested diamond reads as a
 * clinical signal moving from question to handoff without using a literal cross
 * or Rx glyph, and remains legible at favicon size.
 */
export function BrandMark({ className, iconClassName, size = "md", tone = "dark" }: BrandMarkProps) {
  const dims = SIZE_PX[size]
  const isLight = tone === "light"

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
        isLight
          ? "border border-[rgba(15,23,42,0.10)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
          : "border border-[rgba(15,23,42,0.32)] bg-[#0B1B33] shadow-[0_2px_6px_rgba(11,27,51,0.18)]",
        className
      )}
      style={{ width: dims.box, height: dims.box }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_16%,rgba(125,211,252,0.26),transparent_42%),radial-gradient(circle_at_78%_80%,rgba(45,212,191,0.28),transparent_36%)]" />
      <svg
        width={dims.svg}
        height={dims.svg}
        viewBox="0 0 24 24"
        fill="none"
        className={cn("relative", iconClassName)}
        aria-hidden
      >
        <path d="M12 2.9 21.1 12 12 21.1 2.9 12 12 2.9Z" fill={isLight ? "rgba(11,27,51,0.04)" : "rgba(255,255,255,0.08)"} stroke={isLight ? "#0B1B33" : "rgba(255,255,255,0.78)"} strokeWidth="1.7" />
        <path d="M12 7.35 16.65 12 12 16.65 7.35 12 12 7.35Z" fill={isLight ? "rgba(15,118,110,0.08)" : "rgba(45,212,191,0.14)"} stroke={isLight ? "#0F766E" : "#7DD3FC"} strokeWidth="1.55" />
        <path d="M12 9.85 14.15 12 12 14.15 9.85 12 12 9.85Z" fill={isLight ? "#0F766E" : "#2DD4BF"} />
        <path d="M5.25 12h4M14.75 12h4" stroke={isLight ? "#0B1B33" : "rgba(255,255,255,0.82)"} strokeWidth="1.45" strokeLinecap="round" />
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
  tone?: "light" | "dark"
}

export function BrandWordmark({
  className,
  subtitle = true,
  subtitleClassName,
  titleClassName,
  titleAs = "p",
  tone = "light",
}: BrandWordmarkProps) {
  const Title = titleAs
  const titleColor = tone === "dark" ? "text-white" : "text-primary"
  const subtitleColor = tone === "dark" ? "text-white/56" : "text-muted"

  return (
    <div className={cn("min-w-0", className)}>
      <Title className={cn("truncate text-[15px] font-semibold tracking-[-0.02em]", titleColor, titleClassName)}>
        OpenRx
      </Title>
      {subtitle ? (
        <p className={cn("text-[10px] font-medium uppercase tracking-[0.18em]", subtitleColor, subtitleClassName)}>
          Clinical handoffs
        </p>
      ) : null}
    </div>
  )
}
