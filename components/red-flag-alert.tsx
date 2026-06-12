"use client"

import { AlertTriangle, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RedFlagResult } from "@/lib/red-flag"

type RedFlagTone = "dark" | "light"

interface RedFlagAlertProps {
  finding: RedFlagResult
  acknowledged: boolean
  onAcknowledge: () => void
  tone?: RedFlagTone
}

const TONE_STYLES: Record<RedFlagTone, {
  shell: string
  icon: string
  body: string
  finePrint: string
  cta: string
  acknowledge: string
}> = {
  dark: {
    shell: "border-red-300/25 bg-red-500/[0.1] text-red-50",
    icon: "text-red-200",
    body: "text-red-100",
    finePrint: "text-red-100/85",
    cta: "bg-red-100 text-red-950",
    acknowledge: "border-red-200/25 bg-black/12 text-red-50 hover:bg-black/20",
  },
  light: {
    shell: "border-red-200 bg-red-50 text-red-900",
    icon: "text-red-600",
    body: "text-red-800",
    finePrint: "text-red-700/85",
    cta: "bg-red-600 text-white hover:bg-red-700",
    acknowledge: "border-red-200 bg-white text-red-700 hover:bg-red-100",
  },
}

export function RedFlagAlert({ finding, acknowledged, onAcknowledge, tone = "dark" }: RedFlagAlertProps) {
  const styles = TONE_STYLES[tone]
  return (
    <section
      data-testid="red-flag-alert"
      role="alert"
      className={cn("rounded-[18px] border p-4", styles.shell)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className={cn("mt-0.5 shrink-0", styles.icon)} />
        <div className="space-y-2">
          <p className="text-sm font-semibold">{finding.label}: routine navigation paused</p>
          <p className={cn("text-sm leading-6", styles.body)}>{finding.emergencyMessage}</p>
          <p className={cn("text-[12px] leading-5", styles.finePrint)}>
            OpenRx will not treat this as routine screening or scheduling. This warning is not a diagnosis.
          </p>
          {finding.crisisResource ? (
            <a href={finding.crisisResource} className={cn("inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold transition", styles.cta)}>
              Call or text 988
            </a>
          ) : (
            <a href="tel:911" className={cn("inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold transition", styles.cta)}>
              Call 911
            </a>
          )}
        </div>
      </div>
      <button
        type="button"
        data-testid="red-flag-acknowledge"
        onClick={onAcknowledge}
        disabled={acknowledged}
        className={cn("mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition disabled:opacity-70", styles.acknowledge)}
      >
        {acknowledged ? <Check size={13} /> : null}
        {acknowledged ? "Acknowledged" : "I understand. Keep emergency guidance visible."}
      </button>
    </section>
  )
}
