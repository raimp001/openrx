"use client"

import { useState } from "react"
import Link from "next/link"
import { HeartHandshake, Loader2, ShieldCheck } from "lucide-react"
import { BaseUsdcTransaction } from "@/components/payments/base-usdc-transaction"
import { useWalletIdentity } from "@/lib/wallet-context"
import { cn } from "@/lib/utils"
import { trackWorkflowEvent } from "@/lib/product-analytics"
import type { PaymentRecord } from "@/lib/payments-ledger"

const TIP_AMOUNTS = ["1.00", "5.00", "10.00"] as const

type SupportTone = "dark" | "light"

const TONE_STYLES: Record<SupportTone, {
  trigger: string
  panel: string
  heading: string
  headingIcon: string
  close: string
  success: string
  primaryButton: string
  mutedNote: string
  amountActive: string
  amountIdle: string
  input: string
  error: string
  footnote: string
}> = {
  dark: {
    trigger: "border-white/10 bg-white/[0.035] text-zinc-300 hover:border-cyan-200/25 hover:text-cyan-100",
    panel: "border-white/10 bg-white/[0.035] text-zinc-300",
    heading: "text-zinc-100",
    headingIcon: "text-cyan-200",
    close: "text-zinc-400 hover:text-zinc-100",
    success: "border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-100",
    primaryButton: "bg-cyan-200 text-black",
    mutedNote: "text-zinc-400",
    amountActive: "border-cyan-200/30 bg-cyan-200/[0.1] text-cyan-100",
    amountIdle: "border-white/10 text-zinc-300",
    input: "border-white/12 bg-black/30 text-zinc-100 focus:border-cyan-200/35",
    error: "text-red-200",
    footnote: "text-zinc-500",
  },
  light: {
    trigger: "border-[#E7E5E0] bg-white text-[#57534E] hover:border-[#99F6E4] hover:text-[#0F766E]",
    panel: "border-[#E7E5E0] bg-white text-[#57534E]",
    heading: "text-[#1C1917]",
    headingIcon: "text-[#0F766E]",
    close: "text-[#A8A29E] hover:text-[#1C1917]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    primaryButton: "bg-[#0F766E] text-white hover:bg-[#115E59]",
    mutedNote: "text-[#A8A29E]",
    amountActive: "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]",
    amountIdle: "border-[#E7E5E0] text-[#57534E]",
    input: "border-[#E7E5E0] bg-white text-[#1C1917] focus:border-[#0F766E]/40",
    error: "text-red-600",
    footnote: "text-[#A8A29E]",
  },
}

export function SupportOpenRx({ tone = "dark" }: { tone?: SupportTone } = {}) {
  const styles = TONE_STYLES[tone]
  const { isConnected, walletAddress, getWalletAuthHeaders } = useWalletIdentity()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<string>("5.00")
  const [customAmount, setCustomAmount] = useState("")
  const [intent, setIntent] = useState<PaymentRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const selectedAmount = amount === "custom" ? customAmount.trim() : amount

  async function startTip() {
    if (!walletAddress || !selectedAmount) return
    setLoading(true)
    setError("")
    trackWorkflowEvent("tip_started", { amount: selectedAmount, surface: "answer" })
    try {
      const headers = await getWalletAuthHeaders()
      const response = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          walletAddress,
          amount: selectedAmount,
          category: "tip",
          description: "Optional support for free OpenRx screening guidance",
          metadata: { purpose: "optional_support" },
        }),
      })
      const result = (await response.json()) as { payment?: PaymentRecord; error?: string }
      if (!response.ok || !result.payment) throw new Error(result.error || "Unable to prepare support payment.")
      setIntent(result.payment)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to prepare support payment.")
      trackWorkflowEvent("tip_failed", { surface: "answer" })
    } finally {
      setLoading(false)
    }
  }

  async function verifyTip(hash: string) {
    if (!intent || !walletAddress) return
    try {
      const headers = await getWalletAuthHeaders()
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          paymentId: intent.id,
          txHash: hash,
          walletAddress,
          expectedAmount: intent.expectedAmount,
          expectedRecipient: intent.recipientAddress,
        }),
      })
      if (!response.ok) throw new Error("Support payment could not be verified.")
      setSuccess(true)
      trackWorkflowEvent("tip_completed", { amount: intent.expectedAmount, surface: "answer" })
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Support payment could not be verified.")
      trackWorkflowEvent("tip_failed", { surface: "answer" })
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="support-openrx-button"
        className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition", styles.trigger)}
      >
        <HeartHandshake size={12} />
        Support OpenRx
      </button>
    )
  }

  return (
    <section data-testid="support-openrx-panel" className={cn("rounded-[16px] border p-4 text-[12px]", styles.panel)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("flex items-center gap-2 font-semibold", styles.heading)}><HeartHandshake size={14} className={styles.headingIcon} />Support OpenRx</p>
        <button type="button" onClick={() => setOpen(false)} className={styles.close}>Close</button>
      </div>
      {success ? (
        <p className={cn("mt-3 flex items-center gap-2 rounded-xl border p-3", styles.success)}>
          <ShieldCheck size={14} />
          Thanks - this helps keep free screening guidance available.
        </p>
      ) : (
        <>
          <p className="mt-2 leading-5">Optional USDC tip on Base. Medical help stays free and never requires a wallet.</p>
          {!isConnected ? (
            <div className="mt-3 space-y-2">
              <Link href="/wallet" className={cn("inline-flex rounded-full px-3 py-2 font-semibold transition", styles.primaryButton)}>Connect wallet for tipping</Link>
              <p className={styles.mutedNote}>Continue without wallet: simply close this panel and keep using care guidance.</p>
            </div>
          ) : intent ? (
            <div className="mt-3">
              <BaseUsdcTransaction
                amount={intent.expectedAmount}
                recipientAddress={intent.recipientAddress}
                onTransactionHash={() => {}}
                onConfirmed={(hash) => void verifyTip(hash)}
              />
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {TIP_AMOUNTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAmount(option)}
                    className={cn("rounded-full border px-3 py-1.5 font-semibold", amount === option ? styles.amountActive : styles.amountIdle)}
                  >
                    ${Number(option)}
                  </button>
                ))}
                <button type="button" onClick={() => setAmount("custom")} className={cn("rounded-full border px-3 py-1.5 font-semibold", amount === "custom" ? styles.amountActive : styles.amountIdle)}>Custom</button>
              </div>
              {amount === "custom" ? (
                <input
                  aria-label="Custom support amount in USDC"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder="Amount in USDC"
                  className={cn("mt-3 w-full rounded-xl border px-3 py-2 outline-none", styles.input)}
                />
              ) : null}
              <button
                type="button"
                onClick={() => void startTip()}
                disabled={loading || !selectedAmount}
                className={cn("mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-semibold transition disabled:opacity-45", styles.primaryButton)}
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                Tip {selectedAmount || "0"} USDC
              </button>
            </>
          )}
          {error ? <p className={cn("mt-3", styles.error)}>{error} Care features remain available.</p> : null}
          <p className={cn("mt-3", styles.footnote)}>Wallet is optional and is not your medical identity. PHI and clinical recommendations are never written on-chain.</p>
        </>
      )}
    </section>
  )
}
