"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookText,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Undo2,
} from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"
import TreasuryConsole from "@/components/payments/treasury-console"
import { OpsBadge, OpsEmptyState, OpsMetricCard, OpsPanel } from "@/components/ui/ops-primitives"
import { launchBaseBuilderPay } from "@/lib/basebuilder/pay"
import { toBaseBuilderTxUrl } from "@/lib/basebuilder/config"
import type {
  AttestationRecord,
  LedgerEntry,
  PaymentCategory,
  PaymentRecord,
  ReceiptRecord,
  RefundRecord,
} from "@/lib/payments-ledger"
import { useWalletIdentity } from "@/lib/wallet-context"

interface SnapshotPayload {
  payments: PaymentRecord[]
  receipts: ReceiptRecord[]
  refunds: RefundRecord[]
  attestations: AttestationRecord[]
  entries: LedgerEntry[]
  summary: {
    verifiedVolume: string
    refundedVolume: string
    netSettledVolume: string
    pendingVerificationCount: number
    openRefundCount: number
    receiptCount: number
    attestationCount: number
  }
}

const PAYMENT_CATEGORIES: PaymentCategory[] = [
  "copay",
  "prescription",
  "lab",
  "screening",
  "subscription",
  "other",
]

function isBaseTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim())
}

function isPositiveMoney(value: string): boolean {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0
}

function defaultSnapshot(): SnapshotPayload {
  return {
    payments: [],
    receipts: [],
    refunds: [],
    attestations: [],
    entries: [],
    summary: {
      verifiedVolume: "0.00",
      refundedVolume: "0.00",
      netSettledVolume: "0.00",
      pendingVerificationCount: 0,
      openRefundCount: 0,
      receiptCount: 0,
      attestationCount: 0,
    },
  }
}

export default function ComplianceLedgerPage() {
  const { walletAddress, isConnected } = useWalletIdentity()
  const activeWallet = walletAddress || ""
  const [snapshot, setSnapshot] = useState<SnapshotPayload>(defaultSnapshot())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [amount, setAmount] = useState("25.00")
  const [category, setCategory] = useState<PaymentCategory>("copay")
  const [description, setDescription] = useState("Routine clinic copay")
  const [selectedPaymentId, setSelectedPaymentId] = useState("")
  const [verifyTxHash, setVerifyTxHash] = useState("")
  const [refundAmount, setRefundAmount] = useState("5.00")
  const [refundReason, setRefundReason] = useState("Duplicate charge")
  const [selectedRefundId, setSelectedRefundId] = useState("")
  const [refundTxHash, setRefundTxHash] = useState("")
  const [paying, setPaying] = useState(false)

  const latestPayments = useMemo(() => snapshot.payments.slice(0, 8), [snapshot.payments])
  const latestEntries = useMemo(() => snapshot.entries.slice(0, 12), [snapshot.entries])
  const selectedPayment = useMemo(
    () => snapshot.payments.find((item) => item.id === selectedPaymentId),
    [selectedPaymentId, snapshot.payments]
  )
  const verifyTxUrl = useMemo(() => (isBaseTxHash(verifyTxHash) ? toBaseBuilderTxUrl(verifyTxHash.trim()) : ""), [verifyTxHash])
  const refundTxUrl = useMemo(() => (isBaseTxHash(refundTxHash) ? toBaseBuilderTxUrl(refundTxHash.trim()) : ""), [refundTxHash])
  const canCreateIntent = isPositiveMoney(amount) && description.trim().length > 2
  const canRequestRefund = !!selectedPaymentId && isPositiveMoney(refundAmount) && refundReason.trim().length > 2

  function exportSnapshot() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })
    const href = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = href
    link.download = `openrx-ledger-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`
    link.click()
    URL.revokeObjectURL(href)
  }

  const loadSnapshot = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/payments/ledger?walletAddress=${encodeURIComponent(activeWallet)}`)
      const data = (await response.json()) as SnapshotPayload
      setSnapshot(data)
      setSelectedPaymentId((prev) => prev || data.payments[0]?.id || "")
      setSelectedRefundId((prev) => prev || data.refunds[0]?.id || "")
    } catch {
      setError("Unable to load compliance ledger data.")
    } finally {
      setLoading(false)
    }
  }, [activeWallet])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  async function createIntent() {
    if (!activeWallet) {
      setError("Connect a wallet before creating payment intents.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: activeWallet, amount, category, description }),
      })
      const data = (await response.json()) as { error?: string; payment?: PaymentRecord }
      if (!response.ok) throw new Error(data.error || "Failed to create payment intent.")
      if (data.payment) setSelectedPaymentId(data.payment.id)
      await loadSnapshot()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to create payment intent.")
    } finally {
      setBusy(false)
    }
  }

  async function launchBasePay() {
    const payment = snapshot.payments.find((item) => item.id === selectedPaymentId) || snapshot.payments[0]
    if (!payment) {
      setError("Create a payment intent before launching Base Pay.")
      return
    }

    setPaying(true)
    setError("")
    try {
      const result = await launchBaseBuilderPay({
        amount: payment.expectedAmount,
        recipientAddress: payment.recipientAddress,
      })
      setVerifyTxHash(result.paymentId)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to launch Base Pay flow.")
    } finally {
      setPaying(false)
    }
  }

  async function verifyPayment() {
    if (!activeWallet) {
      setError("Connect a wallet before verifying payments.")
      return
    }
    if (!selectedPaymentId || !verifyTxHash.trim()) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedPaymentId,
          txHash: verifyTxHash.trim(),
          walletAddress: activeWallet,
          expectedAmount: selectedPayment?.expectedAmount,
          expectedRecipient: selectedPayment?.recipientAddress,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Verification failed.")
      await loadSnapshot()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to verify payment.")
    } finally {
      setBusy(false)
    }
  }

  async function requestPaymentRefund() {
    if (!activeWallet) {
      setError("Connect a wallet before requesting refunds.")
      return
    }
    if (!selectedPaymentId || !refundAmount.trim()) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/payments/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedPaymentId,
          amount: refundAmount,
          reason: refundReason,
          requestedBy: activeWallet,
        }),
      })
      const data = (await response.json()) as { error?: string; refund?: RefundRecord }
      if (!response.ok) throw new Error(data.error || "Failed to request refund.")
      if (data.refund) setSelectedRefundId(data.refund.id)
      await loadSnapshot()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to request refund.")
    } finally {
      setBusy(false)
    }
  }

  async function approveRefund() {
    if (!activeWallet) {
      setError("Connect a wallet before approving refunds.")
      return
    }
    if (!selectedRefundId) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/payments/refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", refundId: selectedRefundId, approvedBy: activeWallet }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Failed to approve refund.")
      await loadSnapshot()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to approve refund.")
    } finally {
      setBusy(false)
    }
  }

  async function finalizeRefund() {
    if (!activeWallet) {
      setError("Connect a wallet before finalizing refunds.")
      return
    }
    if (!selectedRefundId) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/payments/refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          refundId: selectedRefundId,
          status: "sent",
          txHash: refundTxHash.trim() || undefined,
          approvedBy: activeWallet,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Failed to finalize refund.")
      await loadSnapshot()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to finalize refund.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Payments"
        title="Compliance ledger"
        description="Operational control for intents, verification, receipts, attestations, refunds, and treasury actions. The goal is fast review without losing audit depth."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone={isConnected ? "accent" : "gold"}>{isConnected ? "wallet connected" : "wallet required"}</OpsBadge>
            <OpsBadge tone="terra">{snapshot.entries.length} ledger entries</OpsBadge>
            <OpsBadge tone={snapshot.summary.openRefundCount ? "red" : "blue"}>
              {snapshot.summary.openRefundCount} open refunds
            </OpsBadge>
          </div>
        }
        actions={
          <>
            <button onClick={exportSnapshot} disabled={loading} className="control-button-secondary">
              <Download size={12} /> Export JSON
            </button>
            <button onClick={() => void loadSnapshot()} disabled={busy || loading} className="control-button-secondary">
              <RefreshCcw size={12} /> Refresh
            </button>
          </>
        }
      />

      {!isConnected ? (
        <div className="rounded-2xl border border-yellow-300/30 bg-yellow-100/30 px-4 py-3 text-sm text-primary">
          Wallet is not connected. Connect a wallet before creating intents, verifying Base Pay settlements, or running refunds.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-soft-red/20 bg-soft-red/5 px-4 py-3 text-sm text-soft-red">{error}</div>
      ) : null}

      {loading ? (
        <div className="surface-card px-6 py-10 text-center text-sm text-muted">
          <Loader2 size={16} className="mr-2 inline animate-spin" /> Loading compliance state...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OpsMetricCard label="Verified volume" value={`$${snapshot.summary.verifiedVolume}`} detail="Settlements confirmed against expected payment intents." icon={CreditCard} tone="terra" />
            <OpsMetricCard label="Net settled" value={`$${snapshot.summary.netSettledVolume}`} detail="Verified less refunded volume." icon={CheckCircle2} tone="accent" />
            <OpsMetricCard label="Pending verify" value={`${snapshot.summary.pendingVerificationCount}`} detail="Payment intents waiting on a chain hash." icon={RefreshCcw} tone="gold" />
            <OpsMetricCard label="Open refunds" value={`${snapshot.summary.openRefundCount}`} detail="Refund requests not finalized yet." icon={Undo2} tone={snapshot.summary.openRefundCount ? "red" : "blue"} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <OpsMetricCard label="Refunded volume" value={`$${snapshot.summary.refundedVolume}`} detail="Completed outbound refunds." icon={Undo2} tone="blue" />
            <OpsMetricCard label="Receipts" value={`${snapshot.summary.receiptCount}`} detail="Payment and refund receipts generated so far." icon={FileText} tone="terra" />
            <OpsMetricCard label="Attestations" value={`${snapshot.summary.attestationCount}`} detail="Recorded compliance attestations tied to receipts and refunds." icon={ShieldCheck} tone="accent" />
          </div>

          <TreasuryConsole />

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <OpsPanel eyebrow="Step 1" title="Create payment intent" description="Start with an expected amount, category, and human-readable reason before launching any pay flow.">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="control-label">
                    Amount (USDC)
                    <input value={amount} onChange={(event) => setAmount(event.target.value)} className="control-input" />
                  </label>
                  <label className="control-label">
                    Category
                    <select value={category} onChange={(event) => setCategory(event.target.value as PaymentCategory)} className="control-select">
                      {PAYMENT_CATEGORIES.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="control-label mt-3">
                  Description
                  <input value={description} onChange={(event) => setDescription(event.target.value)} className="control-input" />
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button onClick={() => void createIntent()} disabled={busy || !canCreateIntent} className="control-button-primary">
                    Create intent
                  </button>
                  {!canCreateIntent ? <span className="text-xs text-muted">Enter a positive amount and description.</span> : null}
                </div>
              </OpsPanel>

              <OpsPanel eyebrow="Step 2" title="Verify payment and issue receipt" description="Pick an intent, attach the onchain settlement hash, and verify against the expected recipient.">
                <div className="space-y-3">
                  <label className="control-label">
                    Intent
                    <select value={selectedPaymentId} onChange={(event) => setSelectedPaymentId(event.target.value)} className="control-select">
                      <option value="">Select payment</option>
                      {latestPayments.map((payment) => (
                        <option key={payment.id} value={payment.id}>{payment.category} · ${payment.expectedAmount} · {payment.status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="control-label">
                    Base tx hash
                    <input value={verifyTxHash} onChange={(event) => setVerifyTxHash(event.target.value)} className="control-input" />
                  </label>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    {selectedPayment ? <span>Expected ${selectedPayment.expectedAmount} to {truncate(selectedPayment.recipientAddress)}</span> : null}
                    {verifyTxUrl ? (
                      <a href={verifyTxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal hover:text-teal-dark">
                        View tx <ExternalLink size={11} />
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => void verifyPayment()} disabled={busy || !selectedPaymentId} className="control-button-primary">
                      Verify & issue receipt
                    </button>
                    <button onClick={() => void launchBasePay()} disabled={busy || paying || !selectedPaymentId} className="control-button-secondary">
                      {paying ? <><Loader2 size={12} className="animate-spin" /> Launching Base Pay</> : "Launch Base Pay"}
                    </button>
                  </div>
                </div>
              </OpsPanel>

              <OpsPanel eyebrow="Step 3" title="Refund workflow" description="Request a refund first, then approve and finalize it once the chain transfer is ready.">
                <div className="grid gap-3">
                  <label className="control-label">
                    Payment
                    <select value={selectedPaymentId} onChange={(event) => setSelectedPaymentId(event.target.value)} className="control-select">
                      <option value="">Select payment</option>
                      {snapshot.payments.filter((payment) => payment.status === "verified" || payment.status === "refunded").map((payment) => (
                        <option key={payment.id} value={payment.id}>{payment.category} · ${payment.settledAmount || payment.expectedAmount}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="control-label">
                      Refund amount
                      <input value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className="control-input" />
                    </label>
                    <label className="control-label">
                      Reason
                      <input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} className="control-input" />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => void requestPaymentRefund()} disabled={busy || !canRequestRefund} className="control-button-primary">
                      Request refund
                    </button>
                    {!canRequestRefund ? <span className="text-xs text-muted">Select a payment, a positive amount, and a reason.</span> : null}
                  </div>

                  <div className="mt-2 rounded-[24px] border border-border/70 bg-white/75 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-primary">Finalize selected refund</h3>
                      {refundTxUrl ? <a href={refundTxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:text-teal-dark">View refund tx <ExternalLink size={11} /></a> : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="control-label">
                        Selected refund ID
                        <input value={selectedRefundId} onChange={(event) => setSelectedRefundId(event.target.value)} className="control-input" />
                      </label>
                      <label className="control-label">
                        Refund tx hash
                        <input value={refundTxHash} onChange={(event) => setRefundTxHash(event.target.value)} className="control-input" />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button onClick={() => void approveRefund()} disabled={busy || !selectedRefundId} className="control-button-secondary">Approve</button>
                      <button onClick={() => void finalizeRefund()} disabled={busy || !selectedRefundId} className="control-button-primary">Finalize as sent</button>
                    </div>
                  </div>
                </div>
              </OpsPanel>
            </div>

            <div className="space-y-4">
              <OpsPanel eyebrow="Review queue" title="Pending refunds" description="Refunds that still need human approval or finalization.">
                <div className="space-y-3">
                  {snapshot.refunds.length === 0 ? (
                    <OpsEmptyState icon={Undo2} title="No refunds on deck" description="Refund requests will appear here once a payment is selected and submitted." />
                  ) : (
                    snapshot.refunds.slice(0, 6).map((refund) => (
                      <div key={refund.id} className="surface-muted px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-primary">${refund.amount}</p>
                            <p className="mt-1 text-xs text-muted">{refund.reason}</p>
                          </div>
                          <OpsBadge tone={refund.status === "sent" ? "accent" : refund.status === "failed" ? "red" : "gold"}>{refund.status}</OpsBadge>
                        </div>
                        <button onClick={() => setSelectedRefundId(refund.id)} className="mt-3 text-xs font-semibold text-teal hover:text-teal-dark">Select refund</button>
                      </div>
                    ))
                  )}
                </div>
              </OpsPanel>

              <OpsPanel eyebrow="Artifacts" title="Receipts and attestations" description="Recently generated documents and attestations tied to ledger events.">
                <div className="space-y-4">
                  <ArtifactSection title="Receipts" icon={FileText} emptyText="Receipts will appear after payment verification or refund settlement.">
                    {snapshot.receipts.slice(0, 6).map((receipt) => (
                      <ArtifactCard key={receipt.id} title={receipt.receiptNumber} subtitle={`${receipt.kind} · $${receipt.amount} USDC`} footnote={truncate(receipt.complianceHash, 9)} />
                    ))}
                  </ArtifactSection>
                  <ArtifactSection title="Attestations" icon={ShieldCheck} emptyText="Attestations are created automatically for verification and refund events.">
                    {snapshot.attestations.slice(0, 6).map((attestation) => (
                      <ArtifactCard key={attestation.id} title={attestation.schema} subtitle={`${attestation.subjectType} · ${attestation.attestor}`} footnote={truncate(attestation.payloadHash, 9)} />
                    ))}
                  </ArtifactSection>
                </div>
              </OpsPanel>
            </div>
          </div>

          <OpsPanel eyebrow="Journal" title="Ledger entries" description="The low-level audit trail remains available in a compact table for reconciliation and exports.">
            {latestEntries.length === 0 ? (
              <OpsEmptyState icon={BookText} title="No ledger entries yet" description="Entries start appearing once intents, receipts, refunds, or treasury actions are recorded." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-muted">
                      <th className="px-4 py-3 font-semibold">Time</th>
                      <th className="px-3 py-3 font-semibold">Event</th>
                      <th className="px-3 py-3 font-semibold">Account</th>
                      <th className="px-3 py-3 font-semibold">Direction</th>
                      <th className="px-3 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/30 text-primary last:border-b-0">
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-3 py-3">{entry.eventType}</td>
                        <td className="px-3 py-3">{entry.accountCode}</td>
                        <td className="px-3 py-3 uppercase">{entry.direction}</td>
                        <td className="px-3 py-3 text-right">${entry.amount}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">{entry.reference ? truncate(entry.reference, 10) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsPanel>
        </>
      )}
    </div>
  )
}

function truncate(value?: string, size = 8): string {
  if (!value) return "-"
  if (value.length <= size * 2) return value
  return `${value.slice(0, size)}...${value.slice(-size)}`
}

function ArtifactSection({
  title,
  icon: Icon,
  emptyText,
  children,
}: {
  title: string
  icon: typeof FileText
  emptyText: string
  children: React.ReactNode
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={14} className="text-teal" />
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
      </div>
      <div className="space-y-2">
        {Array.isArray(items) && items.length === 0 ? <p className="text-xs text-muted">{emptyText}</p> : items}
      </div>
    </div>
  )
}

function ArtifactCard({ title, subtitle, footnote }: { title: string; subtitle: string; footnote: string }) {
  return (
    <div className="surface-muted px-4 py-3">
      <div className="text-sm font-semibold text-primary">{title}</div>
      <div className="mt-1 text-xs text-secondary">{subtitle}</div>
      <div className="mt-2 font-mono text-[11px] text-muted">{footnote}</div>
    </div>
  )
}
