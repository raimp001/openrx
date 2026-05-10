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
          ? "border border-[rgba(15,23,42,0.12)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
          : "border border-[#1E3A3F] bg-[#050707] shadow-[0_2px_10px_rgba(0,0,0,0.30)]",
        className
      )}
      style={{ width: dims.box, height: dims.box }}
    >
      <svg
        width={dims.svg}
        height={dims.svg}
        viewBox="0 0 24 24"
        fill="none"
        className={cn("relative", iconClassName)}
        aria-hidden
      >
        <path d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z" fill={isLight ? "#F7FBFB" : "#081314"} stroke={isLight ? "#0F3E47" : "#9BEAF3"} strokeWidth="1.9" />
        <path d="M12 7.25 16.75 12 12 16.75 7.25 12 12 7.25Z" fill={isLight ? "#E6FAF8" : "#0D2A2E"} stroke={isLight ? "#0F766E" : "#2DD4BF"} strokeWidth="1.65" />
        <circle cx="12" cy="12" r="1.8" fill={isLight ? "#0F766E" : "#CFFAFE"} />
        <path d="M5.7 12h4M14.3 12h4" stroke={isLight ? "#0B1D22" : "#E6FFFB"} strokeWidth="1.55" strokeLinecap="round" />
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
          Care handoffs
        </p>
      ) : null}
    </div>
  )
}
