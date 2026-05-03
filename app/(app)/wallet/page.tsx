"use client"

import { useEffect, useMemo, useState } from "react"
import { useWalletIdentity } from "@/lib/wallet-context"
import { PLATFORM_WALLET, DEVELOPER_WALLET } from "@/lib/platform-wallets"
import {
  getBaseBuilderChainId,
  getBaseBuilderExplorerRootUrl,
  getBaseBuilderNetwork,
  toBaseBuilderTxUrl,
} from "@/lib/basebuilder/config"
import { AppPageHeader } from "@/components/layout/app-page"
import {
  Wallet as WalletIcon,
  Shield,
  Zap,
  ArrowUpRight,
  CreditCard,
  Pill,
  Bot,
  CheckCircle2,
  UserCircle,
  Sparkles,
  BookText,
  Loader2,
  Copy,
  Check,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { PaymentRecord } from "@/lib/payments-ledger"

interface LedgerSnapshotResponse {
  payments: PaymentRecord[]
}

function txHashLooksValid(value?: string): boolean {
  if (!value) return false
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim())
}

function statusColor(status: PaymentRecord["status"]): string {
  if (status === "verified") return "bg-accent/10 text-accent"
  if (status === "pending_verification") return "bg-yellow-100/30 text-yellow-700"
  if (status === "failed") return "bg-soft-red/10 text-soft-red"
  if (status === "refunded") return "bg-soft-blue/10 text-soft-blue"
  return "bg-border text-secondary"
}

function maskAddress(value?: string | null) {
  if (!value) return "No payment account connected"
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function WalletFact({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-white/78 px-4 py-4 shadow-[0_18px_50px_-36px_rgba(17,24,39,0.35)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-2 text-sm font-semibold text-primary">{value}</div>
      <div className="mt-1 text-xs leading-5 text-muted">{detail}</div>
    </div>
  )
}

export default function WalletPage() {
  const {
    isConnected,
    walletAddress,
    profile,
    databaseSyncStatus,
    databaseSyncMessage,
    setAgentAutoPay,
    setAgentRxAutoPay,
  } = useWalletIdentity()
  const baseBuilderNetwork = getBaseBuilderNetwork()
  const baseBuilderChainId = getBaseBuilderChainId()
  const baseBuilderExplorer = getBaseBuilderExplorerRootUrl()
  const baseBuilderLabel = baseBuilderNetwork === "base-sepolia" ? "Base Sepolia" : "Base Mainnet"
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [paymentsError, setPaymentsError] = useState("")
  const [copiedField, setCopiedField] = useState<"wallet" | "treasury" | "developer" | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setRecentPayments([])
      setPaymentsError("")
      setLoadingPayments(false)
      return
    }

    let active = true
    setLoadingPayments(true)
    setPaymentsError("")

    fetch(`/api/payments/ledger?walletAddress=${encodeURIComponent(walletAddress)}`, {
      cache: "no-store",
      headers: { "x-wallet-address": walletAddress },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load payment records.")
        }
        return (await response.json()) as LedgerSnapshotResponse
      })
      .then((payload) => {
        if (!active) return
        setRecentPayments((payload.payments || []).slice(0, 5))
      })
      .catch((issue) => {
        if (!active) return
        setRecentPayments([])
        setPaymentsError(issue instanceof Error ? issue.message : "Failed to load payment records.")
      })
      .finally(() => {
        if (!active) return
        setLoadingPayments(false)
      })

    return () => {
      active = false
    }
  }, [walletAddress])

  const paymentsWithTx = useMemo(
    () => recentPayments.filter((payment) => txHashLooksValid(payment.txHash)),
    [recentPayments]
  )

  const copyValue = async (value: string, field: "wallet" | "treasury" | "developer") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current))
      }, 1800)
    } catch {
      setCopiedField(null)
    }
  }

  return (
    <div className="animate-slide-up mx-auto max-w-4xl space-y-6">
      <AppPageHeader
        eyebrow="Account and payments"
        title="Account payment access"
        description="Connect payment access when you want profile sync, Base Pay receipts, refunds, or paid screening features."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
                isConnected ? "bg-accent/10 text-accent" : "bg-white/85 text-secondary ring-1 ring-border"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-accent" : "bg-border")} />
              {isConnected ? "payment access connected" : "payment access not connected"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-secondary ring-1 ring-border">
              {baseBuilderLabel}
            </span>
          </div>
        }
      />

      <div className="surface-hero px-6 py-6">
        {!isConnected ? (
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary text-white shadow-soft-card">
                <WalletIcon size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-serif text-primary">Connect once. Use it only when needed.</h2>
                <p className="mt-2 max-w-xl text-sm leading-7 text-secondary">
                  The account control already lives in the app header. Connect there to activate profile sync,
                  screening payments, receipts, and future care-approval actions without duplicating payment UI here.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/onboarding" className="control-button-primary">
                  Start onboarding
                </Link>
                <p className="rounded-full border border-border/70 bg-white/80 px-4 py-2 text-xs text-muted">
                  Use the top-right account control to connect or switch accounts.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <WalletFact
                label="What unlocks"
                value="Identity + payments + receipts"
                detail="Connected payment access ties the patient profile, receipts, and future payment approvals to one verifiable address."
              />
              <WalletFact
                label="Settlement rail"
                value={`${baseBuilderLabel} · chain ${baseBuilderChainId}`}
                detail="OpenRx settles healthcare transactions on Base for low-cost payments and verifiable receipts."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-primary to-[#064B5A] text-white shadow-soft-card">
                    <WalletIcon size={24} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-serif text-primary">Payment access active</h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                        <CheckCircle2 size={10} />
                        verified session
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-secondary">
                      Manage funding, disconnect, or account switching from the header account control.
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-white/78 px-4 py-4 shadow-[0_18px_50px_-36px_rgba(17,24,39,0.35)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Payment address</div>
                      <div className="mt-2 text-lg font-semibold text-primary">{maskAddress(walletAddress)}</div>
                      <div className="mt-1 break-all font-mono text-[11px] text-muted">{walletAddress}</div>
                    </div>
                    {walletAddress ? (
                      <button
                        type="button"
                        onClick={() => void copyValue(walletAddress, "wallet")}
                        className="control-button-secondary h-auto min-h-0 px-3 py-2 text-[11px]"
                      >
                        {copiedField === "wallet" ? <Check size={12} /> : <Copy size={12} />}
                        {copiedField === "wallet" ? "Copied" : "Copy"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <WalletFact
                  label="Settlement network"
                  value={`BaseBuilder · chain ${baseBuilderChainId}`}
                  detail="Compliance-linked payment references and receipts resolve against the BaseBuilder runtime."
                />
                <WalletFact
                  label="Explorer"
                  value="View address activity"
                  detail="Use BaseScan for raw chain activity, then return here for healthcare-specific receipts and payment records."
                />
                <a
                  href={baseBuilderExplorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="control-button-secondary w-full justify-center"
                >
                  Open BaseScan
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-border/60 bg-white/72 p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <UserCircle size={14} className="text-teal" />
                  <span className="text-xs font-bold text-primary">Identity</span>
                </div>
                {profile?.onboardingComplete ? (
                  <div>
                    <p className="text-sm font-semibold text-primary">{profile.fullName || "Profile Active"}</p>
                    <p className="mt-0.5 text-[10px] text-muted">Pharmacy: {profile.preferredPharmacy || "Not set"}</p>
                    <p className="text-[10px] text-muted">Last seen: {new Date(profile.lastSeen).toLocaleDateString()}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px] font-semibold",
                        databaseSyncStatus === "synced" && "text-accent",
                        databaseSyncStatus === "syncing" && "text-soft-blue",
                        databaseSyncStatus === "database_missing" && "text-yellow-700",
                        databaseSyncStatus === "error" && "text-soft-red"
                      )}
                    >
                      {databaseSyncMessage ||
                        (databaseSyncStatus === "synced"
                          ? "Live records connected."
                          : "Live records will sync after setup.")}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted">Profile not set up yet</p>
                    <Link href="/onboarding" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-teal hover:underline">
                      <Sparkles size={8} />
                      Complete onboarding
                    </Link>
                  </div>
                )}
              </div>
              <div className="rounded-[22px] border border-border/60 bg-white/72 p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Shield size={14} className="text-accent" />
                  <span className="text-xs font-bold text-primary">Network</span>
                </div>
                <p className="text-sm font-semibold text-primary">Base (Coinbase L2)</p>
                <p className="mt-0.5 text-[10px] text-muted">Fast, low-cost healthcare payments.</p>
                <p className="mt-1 text-[10px] text-secondary">
                  BaseBuilder runtime: {baseBuilderLabel} (chain {baseBuilderChainId})
                </p>
                <p className="mt-1 text-[10px] text-muted">Account controls stay in the global header to keep this page lighter and clearer.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="surface-card p-6">
          <h2 className="text-base font-serif text-primary">Healthcare payments</h2>
          <p className="mt-1 text-xs text-muted">Connected payment access can be used for copays, refills, and diagnostic pricing with receipts linked to payment records.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-border bg-white/70 p-4">
              <CreditCard size={18} className="mb-2 text-teal" />
              <h3 className="text-xs font-bold text-primary">Copays</h3>
              <p className="mt-1 text-[10px] text-muted">Pay appointment copays instantly in USDC on Base.</p>
            </div>
            <div className="rounded-[22px] border border-border bg-white/70 p-4">
              <Pill size={18} className="mb-2 text-yellow-600" />
              <h3 className="text-xs font-bold text-primary">Prescriptions</h3>
              <p className="mt-1 text-[10px] text-muted">Pay for refills directly from the same connected payment account.</p>
            </div>
            <div className="rounded-[22px] border border-border bg-white/70 p-4">
              <ArrowUpRight size={18} className="mb-2 text-soft-blue" />
              <h3 className="text-xs font-bold text-primary">Lab & tests</h3>
              <p className="mt-1 text-[10px] text-muted">Transparent pricing for diagnostics, imaging, and lab work.</p>
            </div>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-serif text-primary">Payment record controls</h2>
              <p className="mt-1 text-xs text-muted">
                Verification, receipts, attestations, refunds, and payment entries all reconcile here.
              </p>
            </div>
            <Link href="/compliance-ledger" className="control-button-secondary">
              <BookText size={12} />
              Open records
            </Link>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="surface-card p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-serif text-primary">Recent Base Pay transactions</h2>
              <p className="mt-1 text-xs text-muted">Latest connected-account payment events from payment records.</p>
            </div>
            <Link href="/compliance-ledger" className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:underline">
              Full records <ArrowUpRight size={11} />
            </Link>
          </div>

          {loadingPayments && (
            <p className="inline-flex items-center gap-2 text-xs text-muted">
              <Loader2 size={12} className="animate-spin" />
              Loading transactions...
            </p>
          )}

          {!loadingPayments && paymentsError && <p className="text-xs text-soft-red">{paymentsError}</p>}

          {!loadingPayments && !paymentsError && recentPayments.length === 0 && (
            <p className="text-xs text-muted">No payment activity yet for this connected account.</p>
          )}

          {!loadingPayments && !paymentsError && recentPayments.length > 0 && (
            <div className="space-y-2">
              {recentPayments.map((payment) => {
                const txUrl = txHashLooksValid(payment.txHash) ? toBaseBuilderTxUrl(payment.txHash!) : ""
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 rounded-[22px] border border-border/70 bg-white/72 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-primary">
                        {payment.category} · ${payment.settledAmount || payment.expectedAmount} USDC
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted">{payment.description}</p>
                      <p className="mt-0.5 text-[10px] text-muted">{new Date(payment.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", statusColor(payment.status))}>
                        {payment.status.replaceAll("_", " ")}
                      </span>
                      {txUrl && (
                        <a href={txUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[10px] font-semibold text-teal hover:underline">
                          View tx
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loadingPayments && !paymentsError && paymentsWithTx.length > 0 && (
            <p className="mt-2 text-[10px] text-muted">Transactions resolve on {baseBuilderLabel}.</p>
          )}
        </div>
      )}

      {isConnected && (
        <div className="surface-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bot size={18} className="text-teal" />
            <h2 className="text-base font-serif text-primary">Agent auto-pay</h2>
          </div>
          <p className="mb-4 text-xs text-muted">
            Allow your AI care team to handle routine healthcare payments within your limits.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[22px] border border-border/60 bg-white/72 p-4">
              <div className="flex items-center gap-3">
                <Zap size={14} className="text-teal" />
                <div>
                  <p className="text-xs font-semibold text-primary">Auto-pay copays under ${profile?.agentAutoPayLimit || 50}</p>
                  <p className="text-[10px] text-muted">Agents can clear routine copays automatically.</p>
                </div>
              </div>
              <button
                onClick={() => setAgentAutoPay(!profile?.agentAutoPay)}
                className={cn("relative h-5 w-10 rounded-full transition", profile?.agentAutoPay ? "bg-accent" : "bg-border")}
                aria-label="Toggle auto-pay for copays"
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                    profile?.agentAutoPay ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-[22px] border border-border/60 bg-white/72 p-4">
              <div className="flex items-center gap-3">
                <Pill size={14} className="text-yellow-600" />
                <div>
                  <p className="text-xs font-semibold text-primary">Auto-pay Rx refills</p>
                  <p className="text-[10px] text-muted">Prescription payments can be processed here when enabled.</p>
                </div>
              </div>
              <button
                onClick={() => setAgentRxAutoPay(!profile?.agentRxAutoPay)}
                className={cn("relative h-5 w-10 rounded-full transition", profile?.agentRxAutoPay ? "bg-accent" : "bg-border")}
                aria-label="Toggle auto-pay for prescriptions"
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                    profile?.agentRxAutoPay ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Platform payment accounts</h3>
            <p className="mt-2 text-sm text-secondary">
              Reference addresses used for treasury settlement and platform-level routing.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-[22px] border border-border/60 bg-white/72 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Platform treasury</div>
                <code className="mt-2 block break-all font-mono text-[12px] text-primary">{PLATFORM_WALLET}</code>
              </div>
              <button
                type="button"
                onClick={() => void copyValue(PLATFORM_WALLET, "treasury")}
                className="control-button-secondary h-auto min-h-0 px-3 py-2 text-[11px]"
              >
                {copiedField === "treasury" ? <Check size={12} /> : <Copy size={12} />}
                {copiedField === "treasury" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="rounded-[22px] border border-border/60 bg-white/72 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Developer payment account</div>
                <code className="mt-2 block break-all font-mono text-[12px] text-primary">{DEVELOPER_WALLET}</code>
              </div>
              <button
                type="button"
                onClick={() => void copyValue(DEVELOPER_WALLET, "developer")}
                className="control-button-secondary h-auto min-h-0 px-3 py-2 text-[11px]"
              >
                {copiedField === "developer" ? <Check size={12} /> : <Copy size={12} />}
                {copiedField === "developer" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
