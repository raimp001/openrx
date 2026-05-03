import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  iconClassName?: string
  size?: "sm" | "md"
}

export function BrandMark({ className, iconClassName, size = "md" }: BrandMarkProps) {
  const isSmall = size === "sm"

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(145deg,#07111F_0%,#10254A_56%,#064B5A_100%)] shadow-[0_16px_38px_rgba(8,24,46,0.16)]",
        isSmall ? "h-9 w-9" : "h-11 w-11",
        className
      )}
    >
      <div className="absolute inset-[1px] rounded-[14px] bg-[radial-gradient(circle_at_26%_18%,rgba(95,140,255,0.44),transparent_38%),radial-gradient(circle_at_78%_82%,rgba(17,167,183,0.38),transparent_34%),linear-gradient(160deg,#07111F_0%,#10254A_56%,#064B5A_100%)]" />
      <div className="absolute inset-x-2 top-1 h-px bg-gradient-to-r from-transparent via-white/32 to-transparent" />
      <svg
        width={isSmall ? 22 : 26}
        height={isSmall ? 22 : 26}
        viewBox="0 0 32 32"
        fill="none"
        className={cn("relative", iconClassName)}
        aria-hidden
      >
        <path
          d="M23.9 8.65A11.2 11.2 0 1 0 27.05 17.05"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2.35"
          strokeLinecap="round"
        />
        <path
          d="M9.85 16.35 14.1 20.55 22.8 10.9"
          stroke="#9CB9FF"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22.75 10.9c1.45 1.55 2.15 3.35 2.15 5.5 0 4.75-3.55 8.5-8.62 8.5-2.05 0-3.78-.48-5.22-1.43"
          stroke="rgba(17,167,183,0.82)"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
        <circle cx="23" cy="10.65" r="2.15" fill="#11A7B7" />
        <circle cx="14.1" cy="20.55" r="1.45" fill="#5F8CFF" />
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
      <Title className={cn("truncate text-[15px] font-semibold tracking-[-0.05em] text-primary", titleClassName)}>
        OpenRx
      </Title>
      {subtitle ? (
        <p className={cn("text-[9px] font-semibold uppercase tracking-[0.16em] text-muted", subtitleClassName)}>
          Screening to follow-up
        </p>
      ) : null}
    </div>
  )
}
