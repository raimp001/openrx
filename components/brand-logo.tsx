import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  iconClassName?: string
  size?: "xs" | "sm" | "md" | "lg"
  tone?: "light" | "dark"
  /** Render the mark as a flat vector with no surrounding chip — useful in tight headers. */
  bare?: boolean
}

const SIZE_PX: Record<NonNullable<BrandMarkProps["size"]>, { box: number; svg: number }> = {
  xs: { box: 24, svg: 14 },
  sm: { box: 30, svg: 16 },
  md: { box: 38, svg: 20 },
  lg: { box: 56, svg: 30 },
}

/**
 * OpenRx mark — a "decision node":
 *
 *   three nodes forming a forward-leaning isosceles triangle, joined by quiet
 *   slate strokes, with a single muted-teal accent on the leading node. Reads
 *   as guidance, branches, and a recommendation — not as a generic AI sparkle,
 *   not as a pill or cross. The bounding chip uses a deep navy in dark mode
 *   and a near-white field in light mode, both with a 12-pixel rounded square
 *   so it remains crisp at 16 px.
 */
export function BrandMark({
  className,
  iconClassName,
  size = "md",
  tone = "dark",
  bare = false,
}: BrandMarkProps) {
  const dims = SIZE_PX[size]
  const isLight = tone === "light"

  // Stroke and fill colors per tone.
  const stroke = isLight ? "#0B1B33" : "#FFFFFF"
  const accent = isLight ? "#0F766E" : "#5EEAD4"

  const svg = (
    <svg
      width={dims.svg}
      height={dims.svg}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("relative", iconClassName)}
      aria-hidden
    >
      {/* connecting paths — leading edge points right, like a recommendation */}
      <path
        d="M6.5 17 L17.5 11.5 L6.5 6.5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.9"
      />
      {/* anchor nodes */}
      <circle cx="6.5" cy="6.5" r="1.7" fill={stroke} />
      <circle cx="6.5" cy="17" r="1.7" fill={stroke} />
      {/* lead node — accent */}
      <circle cx="17.5" cy="11.5" r="2.2" fill={accent} />
    </svg>
  )

  if (bare) {
    return <span className={cn("inline-flex items-center justify-center", className)}>{svg}</span>
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
        isLight
          ? "border border-[rgba(11,27,51,0.08)] bg-white shadow-[0_1px_2px_rgba(11,27,51,0.06)]"
          : "border border-[rgba(11,27,51,0.32)] bg-[#0B1B33] shadow-[0_2px_6px_rgba(11,27,51,0.18)]",
        className
      )}
      style={{ width: dims.box, height: dims.box }}
    >
      {svg}
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
  const subtitleColor = tone === "dark" ? "text-white/60" : "text-muted"

  return (
    <div className={cn("min-w-0", className)}>
      <Title
        className={cn(
          "truncate text-[15px] font-semibold tracking-[-0.02em]",
          titleColor,
          titleClassName
        )}
      >
        OpenRx
      </Title>
      {subtitle ? (
        <p
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.18em]",
            subtitleColor,
            subtitleClassName
          )}
        >
          Clinical answers, in chat
        </p>
      ) : null}
    </div>
  )
}

type BrandLockupProps = {
  className?: string
  size?: NonNullable<BrandMarkProps["size"]>
  tone?: NonNullable<BrandMarkProps["tone"]>
  showSubtitle?: boolean
}

/**
 * Reusable lockup: mark + wordmark in a horizontal row. Use this anywhere a
 * page header or footer needs the brand — it keeps spacing and tone in sync.
 */
export function BrandLockup({
  className,
  size = "sm",
  tone = "light",
  showSubtitle = false,
}: BrandLockupProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} tone={tone === "light" ? "light" : "dark"} />
      <BrandWordmark
        subtitle={showSubtitle}
        tone={tone}
        titleClassName={size === "lg" ? "text-[18px]" : undefined}
      />
    </div>
  )
}
