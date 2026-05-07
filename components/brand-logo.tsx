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
 * OpenRx mark: a soft-square monogram. Two geometric forms — an open arc
 * (the "O") and a single stroke that doubles as the leading bar of an "R" /
 * tally mark — sit on a deep navy field. Minimal, recognisable at 16px,
 * works on light and dark backgrounds.
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
      <svg
        width={dims.svg}
        height={dims.svg}
        viewBox="0 0 24 24"
        fill="none"
        className={cn("relative", iconClassName)}
        aria-hidden
      >
        {/* Open arc — the "O", deliberately gapped so the mark reads as motion forward */}
        <path
          d="M19.2 8.4a8 8 0 1 0 1.4 6.7"
          stroke={isLight ? "#0B1B33" : "#FFFFFF"}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Accent dot — a quiet teal node anchoring the mark */}
        <circle cx="20.4" cy="7.4" r="2" fill={isLight ? "#0F766E" : "#5EEAD4"} />
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
