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
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(145deg,#07111F_0%,#10254A_58%,#064B5A_100%)] shadow-[0_16px_38px_rgba(8,24,46,0.16)]",
        isSmall ? "h-9 w-9" : "h-11 w-11",
        className
      )}
    >
      <div className="absolute inset-[1px] rounded-[14px] bg-[radial-gradient(circle_at_24%_18%,rgba(47,107,255,0.48),transparent_38%),radial-gradient(circle_at_82%_84%,rgba(17,167,183,0.34),transparent_34%),linear-gradient(160deg,#07111F_0%,#10254A_58%,#064B5A_100%)]" />
      <svg
        width={isSmall ? 19 : 22}
        height={isSmall ? 19 : 22}
        viewBox="0 0 24 24"
        fill="none"
        className={cn("relative", iconClassName)}
        aria-hidden
      >
        <path
          d="M12 4.45 19.25 8.68v6.64L12 19.55l-7.25-4.23V8.68L12 4.45Z"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path
          d="M5.05 8.82 12 13.08l6.95-4.26M12 13.08v6.02"
          stroke="#8FB3FF"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8.55 6.58 15.45 10.85" stroke="rgba(17,167,183,0.72)" strokeWidth="1.15" strokeLinecap="round" />
        <circle cx="12" cy="13.08" r="1.55" fill="#2F6BFF" />
        <circle cx="19.08" cy="8.76" r="1.05" fill="#5F8CFF" />
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
          Care intelligence
        </p>
      ) : null}
    </div>
  )
}
