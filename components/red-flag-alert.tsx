"use client"

import { AlertTriangle, Check } from "lucide-react"
import type { RedFlagResult } from "@/lib/red-flag"

interface RedFlagAlertProps {
  finding: RedFlagResult
  acknowledged: boolean
  onAcknowledge: () => void
}

export function RedFlagAlert({ finding, acknowledged, onAcknowledge }: RedFlagAlertProps) {
  return (
    <section
      data-testid="red-flag-alert"
      role="alert"
      className="rounded-[18px] border border-red-300/25 bg-red-500/[0.1] p-4 text-red-50"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-200" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">{finding.label}: routine navigation paused</p>
          <p className="text-sm leading-6 text-red-100">{finding.emergencyMessage}</p>
          <p className="text-[12px] leading-5 text-red-100/85">
            OpenRx will not treat this as routine screening or scheduling. This warning is not a diagnosis.
          </p>
          {finding.crisisResource ? (
            <a href={finding.crisisResource} className="inline-flex rounded-full bg-red-100 px-3 py-1.5 text-[12px] font-semibold text-red-950">
              Call or text 988
            </a>
          ) : (
            <a href="tel:911" className="inline-flex rounded-full bg-red-100 px-3 py-1.5 text-[12px] font-semibold text-red-950">
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
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-200/25 bg-black/12 px-3 py-2 text-[12px] font-semibold text-red-50 transition hover:bg-black/20 disabled:opacity-70"
      >
        {acknowledged ? <Check size={13} /> : null}
        {acknowledged ? "Acknowledged" : "I understand. Keep emergency guidance visible."}
      </button>
    </section>
  )
}

