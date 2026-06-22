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
 * OpenRx mark: an open ring closed by a diamond. The ring is the open record
 * (open access, nothing hidden); the diamond at the opening is the evidence
 * marker that completes the loop. Two elements only, so it stays legible at
 * favicon size, and it carries the diamond equity from the previous mark.
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
        {/* Open ring: arc sweeps the long way, leaving a gap at the top right */}
        <path
          d="M 16.03 5.55 A 7.6 7.6 0 1 0 19.43 10.42"
          stroke={isLight ? "#0F766E" : "#67E8F9"}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {/* Evidence diamond seals the opening */}
        <path
          d="M 18.23 4.84 L 21.03 7.64 L 18.23 10.44 L 15.43 7.64 Z"
          fill={isLight ? "#E6FAF8" : "#0D2A2E"}
          stroke={isLight ? "#0F3E47" : "#2DD4BF"}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="18.23" cy="7.64" r="1.05" fill={isLight ? "#0F766E" : "#CFFAFE"} />
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
      <Title className={cn("truncate text-[15px] font-semibold tracking-normal", titleColor, titleClassName)}>
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
