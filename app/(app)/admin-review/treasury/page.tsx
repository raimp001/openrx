import type { Metadata } from "next"
import { LockKeyhole } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge } from "@/components/ui/ops-primitives"
import TreasuryConsole from "@/components/payments/treasury-console"
import PaymentSelfTestPanel from "@/components/payments/payment-self-test-panel"

export const metadata: Metadata = {
  title: "Treasury console | OpenRx admin",
  description:
    "Restricted OpenRx admin surface for treasury balances and outbound actions. Requires the admin API key; nothing renders for anonymous visitors.",
}

export default function AdminTreasuryPage() {
  return (
    <div className="animate-slide-up max-w-5xl space-y-6">
      <AppPageHeader
        eyebrow="Admin operations"
        title="Treasury console"
        description="Restricted treasury operations. This surface is not linked from patient-facing pages and stays locked until a valid admin API key is supplied; every action is authorized server-side."
        meta={
          <>
            <OpsBadge tone="accent">admin only</OpsBadge>
            <OpsBadge tone="terra">server-authorized actions</OpsBadge>
          </>
        }
      />
      <div className="surface-card flex items-start gap-3 border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-secondary">
        <LockKeyhole size={14} className="mt-0.5 shrink-0 text-muted" />
        <span>
          Treasury controls were removed from the public compliance ledger. They live only here, behind the admin
          API key check, so anonymous visitors never see admin controls.
        </span>
      </div>
      <TreasuryConsole />
      <PaymentSelfTestPanel />
    </div>
  )
}
