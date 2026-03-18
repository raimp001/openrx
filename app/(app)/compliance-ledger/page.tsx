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
import { useWalletIdentity } from "@/lib/wallet-context"
import { cn } from "@/lib/utils"
import { toBaseBuilderTxUrl } from "@/lib/basebuilder/config"
import { launchBaseBuilderPay } from "@/lib/basebuilder/pay"
import type {
  AttestationRecord,
  LedgerEntry,
  PaymentCategory,
  PaymentRecord,
  ReceiptRecord,
  RefundRecord,
} from "@/lib/payments-ledger"

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
  const verifyTxUrl = useMemo(() => {
    if (!isBaseTxHash(verifyTxHash)) return ""
    return toBaseBuilderTxUrl(verifyTxHash.trim())
  }, [verifyTxHash])
  const refundTxUrl = useMemo(() => {
    if (!isBaseTxHash(refundTxHash)) return ""
    return toBaseBuilderTxUrl(refundTxHash.trim())
  }, [refundTxHash])
  const canCreateIntent = isPositiveMoney(amount) && description.trim().length > 2
  const canRequestRefund = !!selectedPaymentId && isPositiveMoney(refundAmount) && refundReason.trim().length > 2

  function exportSnapshot() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    })
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
      const response = await fetch(
        `/api/payments/ledger?walletAddress=${encodeURIComponent(activeWallet)}`
      )
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
        body: JSON.stringify({
          walletAddress: activeWallet,
          amount,
          category,
          description,
        }),
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
    const payment =
      snapshot.payments.find((item) => item.id === selectedPaymentId) ||
      snapshot.payments[0]
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
      setError(
        issue instanceof Error
          ? issue.message
          : "Failed to launch Base Pay flow."
      )
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
        body: JSON.stringify({
          action: "approve",
          refundId: selectedRefundId,
          approvedBy: activeWallet,
        }),
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">Payments Compliance Ledger</h1>
          <p className="text-sm text-warm-500 mt-1">
            Base Pay-aligned payment verification, receipts, attestations, refunds, and ledger controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportSnapshot}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sand text-xs font-semibold text-warm-700 hover:border-terra/30 transition disabled:opacity-60"
          >
            <Download size={12} />
            Export JSON
          </button>
          <button
            onClick={() => void loadSnapshot()}
            disabled={busy || loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sand text-xs font-semibold text-warm-700 hover:border-terra/30 transition disabled:opacity-60"
          >
            <RefreshCcw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="bg-yellow-100/20 border border-yellow-300/30 rounded-xl p-3 text-xs text-warm-600">
          Wallet is not connected. Connect a wallet to run payment, receipt, attestation, and refund actions.
        </div>
      )}

      {error && (
        <div className="bg-soft-red/5 border border-soft-red/20 rounded-xl p-3 text-xs text-soft-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-pampas rounded-2xl border border-sand p-8 text-center text-sm text-cloudy">
          <Loader2 size={16} className="animate-spin inline mr-2" />
          Loading compliance state...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Verified Volume" value={`$${snapshot.summary.verifiedVolume}`} icon={CreditCard} />
            <SummaryCard label="Net Settled" value={`$${snapshot.summary.netSettledVolume}`} icon={CheckCircle2} />
            <SummaryCard label="Pending Verify" value={`${snapshot.summary.pendingVerificationCount}`} icon={RefreshCcw} />
            <SummaryCard label="Open Refunds" value={`${snapshot.summary.openRefundCount}`} icon={Undo2} />
            <SummaryCard label="Refunded Volume" value={`$${snapshot.summary.refundedVolume}`} icon={Undo2} />
            <SummaryCard label="Receipts" value={`${snapshot.summary.receiptCount}`} icon={FileText} />
            <SummaryCard label="Attestations" value={`${snapshot.summary.attestationCount}`} icon={ShieldCheck} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-pampas rounded-2xl border border-sand p-4 space-y-3">
              <h2 className="text-sm font-bold text-warm-800">1) Payment Intent</h2>
              <label className="block text-[11px] text-warm-500">
                Amount (USDC)
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                />
              </label>
              <label className="block text-[11px] text-warm-500">
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PaymentCategory)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                >
                  {PAYMENT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-warm-500">
                Description
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                />
              </label>
              <button
                onClick={() => void createIntent()}
                disabled={busy || !canCreateIntent}
                className="w-full px-3 py-2 rounded-lg bg-terra text-white text-xs font-semibold hover:bg-terra-dark transition disabled:opacity-60"
              >
                Create Intent
              </button>
              {!canCreateIntent && (
                <p className="text-[10px] text-cloudy">
                  Enter a positive amount and description to create an intent.
                </p>
              )}
            </div>

            <div className="bg-pampas rounded-2xl border border-sand p-4 space-y-3">
              <h2 className="text-sm font-bold text-warm-800">2) Verify Payment</h2>
              <label className="block text-[11px] text-warm-500">
                Intent
                <select
                  value={selectedPaymentId}
                  onChange={(event) => setSelectedPaymentId(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                >
                  <option value="">Select payment</option>
                  {latestPayments.map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      {payment.category} - ${payment.expectedAmount} - {payment.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-warm-500">
                Base tx hash
                <input
                  value={verifyTxHash}
                  onChange={(event) => setVerifyTxHash(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                />
              </label>
              {verifyTxUrl && (
                <a
                  href={verifyTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-terra hover:text-terra-dark"
                >
                  View verify tx on BaseScan <ExternalLink size={11} />
                </a>
              )}
              {selectedPayment && (
                <p className="text-[10px] text-cloudy">
                  Expected: ${selectedPayment.expectedAmount} to {selectedPayment.recipientAddress.slice(0, 10)}...
                </p>
              )}
              <p className="text-[10px] text-cloudy">Use a real Base Pay transaction hash from settlement.</p>
              <button
                onClick={() => void verifyPayment()}
                disabled={busy || !selectedPaymentId}
                className="w-full px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
              >
                Verify & Issue Receipt
              </button>
              <button
                onClick={() => void launchBasePay()}
                disabled={busy || paying || !selectedPaymentId}
                className="w-full px-3 py-2 rounded-lg border border-sand text-xs font-semibold text-warm-700 hover:border-terra/30 transition disabled:opacity-60"
              >
                {paying ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Launching Base Pay
                  </span>
                ) : (
                  "Launch Base Pay"
                )}
              </button>
            </div>

            <div className="bg-pampas rounded-2xl border border-sand p-4 space-y-3">
              <h2 className="text-sm font-bold text-warm-800">3) Refund Workflow</h2>
              <label className="block text-[11px] text-warm-500">
                Payment
                <select
                  value={selectedPaymentId}
                  onChange={(event) => setSelectedPaymentId(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                >
                  <option value="">Select payment</option>
                  {snapshot.payments
                    .filter((payment) => payment.status === "verified" || payment.status === "refunded")
                    .map((payment) => (
                      <option key={payment.id} value={payment.id}>
                        {payment.category} - ${payment.settledAmount || payment.expectedAmount}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-[11px] text-warm-500">
                Refund amount
                <input
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                />
              </label>
              <label className="block text-[11px] text-warm-500">
                Reason
                <input
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                />
              </label>
              <button
                onClick={() => void requestPaymentRefund()}
                disabled={busy || !canRequestRefund}
                className="w-full px-3 py-2 rounded-lg bg-soft-blue text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
              >
                Request Refund
              </button>
              {!canRequestRefund && (
                <p className="text-[10px] text-cloudy">
                  Select a payment, positive refund amount, and reason.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-pampas rounded-2xl border border-sand p-4">
              <h2 className="text-sm font-bold text-warm-800 mb-3">Pending Refunds</h2>
              <div className="space-y-2">
                {snapshot.refunds.length === 0 && (
                  <p className="text-xs text-cloudy">No refunds in the ledger.</p>
                )}
                {snapshot.refunds.slice(0, 6).map((refund) => (
                  <div key={refund.id} className="rounded-xl border border-sand/70 bg-cream/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-warm-800">${refund.amount}</span>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          refund.status === "sent"
                            ? "bg-accent/10 text-accent"
                            : refund.status === "failed"
                            ? "bg-soft-red/10 text-soft-red"
                            : "bg-yellow-100/20 text-yellow-500"
                        )}
                      >
                        {refund.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-warm-500 mt-1">{refund.reason}</p>
                    <button
                      onClick={() => setSelectedRefundId(refund.id)}
                      className="mt-2 text-[10px] font-semibold text-terra hover:underline"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-pampas rounded-2xl border border-sand p-4 space-y-3">
              <h2 className="text-sm font-bold text-warm-800">Finalize Selected Refund</h2>
              <label className="block text-[11px] text-warm-500">
                Selected refund ID
                <input
                  value={selectedRefundId}
                  onChange={(event) => setSelectedRefundId(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                />
              </label>
              <label className="block text-[11px] text-warm-500">
                Refund tx hash
                <input
                  value={refundTxHash}
                  onChange={(event) => setRefundTxHash(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm text-warm-800 focus:outline-none focus:border-terra/40"
                />
              </label>
              {refundTxUrl && (
                <a
                  href={refundTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-terra hover:text-terra-dark"
                >
                  View refund tx on BaseScan <ExternalLink size={11} />
                </a>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void approveRefund()}
                  disabled={busy || !selectedRefundId}
                  className="px-3 py-2 rounded-lg border border-sand text-xs font-semibold text-warm-700 hover:border-terra/30 transition disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  onClick={() => void finalizeRefund()}
                  disabled={busy || !selectedRefundId}
                  className="px-3 py-2 rounded-lg bg-terra text-white text-xs font-semibold hover:bg-terra-dark transition disabled:opacity-60"
                >
                  Finalize as Sent
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-pampas rounded-2xl border border-sand p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-terra" />
                <h2 className="text-sm font-bold text-warm-800">Recent Receipts</h2>
              </div>
              <div className="space-y-2">
                {snapshot.receipts.slice(0, 6).map((receipt) => (
                  <div key={receipt.id} className="rounded-xl border border-sand/70 bg-cream/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-warm-800">{receipt.receiptNumber}</span>
                      <span className="text-[10px] text-cloudy uppercase">{receipt.kind}</span>
                    </div>
                    <p className="text-xs text-warm-600 mt-1">${receipt.amount} USDC</p>
                    <p className="text-[10px] text-cloudy mt-1 font-mono">{receipt.complianceHash.slice(0, 18)}...</p>
                  </div>
                ))}
                {snapshot.receipts.length === 0 && (
                  <p className="text-xs text-cloudy">Receipts will appear after payment verification or refunds.</p>
                )}
              </div>
            </div>

            <div className="bg-pampas rounded-2xl border border-sand p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={14} className="text-accent" />
                <h2 className="text-sm font-bold text-warm-800">Recent Attestations</h2>
              </div>
              <div className="space-y-2">
                {snapshot.attestations.slice(0, 6).map((attestation) => (
                  <div key={attestation.id} className="rounded-xl border border-sand/70 bg-cream/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-warm-800">{attestation.schema}</span>
                      <span className="text-[10px] text-cloudy uppercase">{attestation.subjectType}</span>
                    </div>
                    <p className="text-[10px] text-warm-500 mt-1">Attestor: {attestation.attestor}</p>
                    <p className="text-[10px] text-cloudy mt-1 font-mono">{attestation.payloadHash.slice(0, 18)}...</p>
                  </div>
                ))}
                {snapshot.attestations.length === 0 && (
                  <p className="text-xs text-cloudy">Attestations are generated automatically on verification/refunds.</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-pampas rounded-2xl border border-sand p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookText size={14} className="text-terra" />
              <h2 className="text-sm font-bold text-warm-800">Ledger Entries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-cloudy border-b border-sand/60">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Dir</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {latestEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-sand/30 text-warm-600">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 pr-3">{entry.eventType}</td>
                      <td className="py-2 pr-3">{entry.accountCode}</td>
                      <td className="py-2 pr-3 uppercase">{entry.direction}</td>
                      <td className="py-2 pr-3">${entry.amount}</td>
                      <td className="py-2 font-mono text-[10px] text-cloudy">
                        {entry.reference ? `${entry.reference.slice(0, 16)}...` : "-"}
                      </td>
                    </tr>
                  ))}
                  {latestEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-cloudy">
                        No ledger entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof CreditCard
}) {
  return (
    <div className="bg-pampas rounded-xl border border-sand p-3">
      <Icon size={14} className="text-terra mb-1.5" />
      <div className="text-base font-semibold text-warm-800">{value}</div>
      <div className="text-[10px] text-cloudy">{label}</div>
    </div>
  )
}
