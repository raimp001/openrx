import { cn } from "@/lib/utils"
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"

type ClinicalSectionProps = {
  kicker?: string
  title: string
  description?: string
  children: ReactNode
  className?: string
  aside?: ReactNode
}

export function ClinicalSection({
  kicker,
  title,
  description,
  children,
  className,
  aside,
}: ClinicalSectionProps) {
  return (
    <section className={cn("surface-card overflow-hidden p-5 sm:p-6", className)}>
      <div className="grid gap-5 lg:grid-cols-[1.22fr_0.78fr] lg:items-start">
        <div>
          {kicker ? <p className="shell-kicker">{kicker}</p> : null}
          <h2 className="mt-2 font-serif text-[1.9rem] leading-tight text-primary">{title}</h2>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">{description}</p> : null}
        </div>
        {aside ? <div className="surface-muted p-4 sm:p-5">{aside}</div> : null}
      </div>
      <div className="subtle-rule mt-5" />
      <div className="mt-5">{children}</div>
    </section>
  )
}

type ClinicalFieldProps = {
  label: string
  hint?: string
  optional?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}

export function ClinicalField({
  label,
  hint,
  optional = false,
  htmlFor,
  className,
  children,
}: ClinicalFieldProps) {
  const labelRow = (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      {optional ? (
        <span className="rounded-full border border-[rgba(82,108,139,0.12)] bg-white/86 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
          Optional
        </span>
      ) : null}
    </div>
  )
  const hintNode = hint ? <p className="mt-2 text-sm leading-6 text-secondary">{hint}</p> : null

  if (htmlFor) {
    return (
      <div className={cn("block", className)}>
        <label htmlFor={htmlFor}>{labelRow}</label>
        {hintNode}
        <div className="mt-3">{children}</div>
      </div>
    )
  }

  return (
    <label className={cn("block", className)}>
      {labelRow}
      {hintNode}
      <div className="mt-3">{children}</div>
    </label>
  )
}

export function ClinicalInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-[18px] border border-[rgba(82,108,139,0.14)] bg-[rgba(255,255,255,0.92)] px-4 py-3.5 text-sm text-primary shadow-sm transition placeholder:text-muted focus:border-teal/35 focus:outline-none focus:ring-1 focus:ring-teal/15",
        className
      )}
    />
  )
}

export function ClinicalTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-[18px] border border-[rgba(82,108,139,0.14)] bg-[rgba(255,255,255,0.92)] px-4 py-3.5 text-sm text-primary shadow-sm transition placeholder:text-muted focus:border-teal/35 focus:outline-none focus:ring-1 focus:ring-teal/15",
        className
      )}
    />
  )
}

type FieldsetCardProps = {
  legend: string
  description?: string
  className?: string
  children: ReactNode
}

export function FieldsetCard({
  legend,
  description,
  className,
  children,
}: FieldsetCardProps) {
  return (
    <fieldset className={cn("surface-muted rounded-[22px] p-4 sm:p-5", className)}>
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {legend}
      </legend>
      {description ? <p className="mt-1 text-sm leading-6 text-secondary">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </fieldset>
  )
}

type ChoiceChipProps = {
  active?: boolean
  children: ReactNode
  className?: string
}

export function ChoiceChip({ active = false, children, className }: ChoiceChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
        active
          ? "border-teal/24 bg-[rgba(47,107,255,0.08)] text-teal"
          : "border-[rgba(82,108,139,0.12)] bg-white/84 text-secondary",
        className
      )}
    >
      {children}
    </span>
  )
}
