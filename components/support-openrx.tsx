"use client"

import { useState } from "react"
import Link from "next/link"
import { HeartHandshake, Loader2, ShieldCheck } from "lucide-react"
import { BaseUsdcTransaction } from "@/components/payments/base-usdc-transaction"
import { useWalletIdentity } from "@/lib/wallet-context"
import { trackWorkflowEvent } from "@/lib/product-analytics"
import type { PaymentRecord } from "@/lib/payments-ledger"

const TIP_AMOUNTS = ["1.00", "5.00", "10.00"] as const

export function SupportOpenRx() {
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
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-200/25 hover:text-cyan-100"
      >
        <HeartHandshake size={12} />
        Support OpenRx
      </button>
    )
  }

  return (
    <section data-testid="support-openrx-panel" className="rounded-[16px] border border-white/10 bg-white/[0.035] p-4 text-[12px] text-zinc-300">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-zinc-100"><HeartHandshake size={14} className="text-cyan-200" />Support OpenRx</p>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-100">Close</button>
      </div>
      {success ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/18 bg-emerald-300/[0.08] p-3 text-emerald-100">
          <ShieldCheck size={14} />
          Thanks - this helps keep free screening guidance available.
        </p>
      ) : (
        <>
          <p className="mt-2 leading-5">Optional USDC tip on Base. Medical help stays free and never requires a wallet.</p>
          {!isConnected ? (
            <div className="mt-3 space-y-2">
              <Link href="/wallet" className="inline-flex rounded-full bg-cyan-200 px-3 py-2 font-semibold text-black">Connect wallet for tipping</Link>
              <p className="text-zinc-400">Continue without wallet: simply close this panel and keep using care guidance.</p>
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
                    className={`rounded-full border px-3 py-1.5 font-semibold ${amount === option ? "border-cyan-200/30 bg-cyan-200/[0.1] text-cyan-100" : "border-white/10 text-zinc-300"}`}
                  >
                    ${Number(option)}
                  </button>
                ))}
                <button type="button" onClick={() => setAmount("custom")} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-zinc-300">Custom</button>
              </div>
              {amount === "custom" ? (
                <input
                  aria-label="Custom support amount in USDC"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder="Amount in USDC"
                  className="mt-3 w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-zinc-100 outline-none focus:border-cyan-200/35"
                />
              ) : null}
              <button
                type="button"
                onClick={() => void startTip()}
                disabled={loading || !selectedAmount}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-cyan-200 px-3.5 py-2 font-semibold text-black disabled:opacity-45"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                Tip {selectedAmount || "0"} USDC
              </button>
            </>
          )}
          {error ? <p className="mt-3 text-red-200">{error} Care features remain available.</p> : null}
          <p className="mt-3 text-zinc-500">Wallet is optional and is not your medical identity. PHI and clinical recommendations are never written on-chain.</p>
        </>
      )}
    </section>
  )
}
