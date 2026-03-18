"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
  WalletDropdownFundLink,
  WalletDropdownLink,
} from "@coinbase/onchainkit/wallet"
import { Address, Avatar, Name, Identity } from "@coinbase/onchainkit/identity"
import { useWalletIdentity } from "@/lib/wallet-context"
import { PLATFORM_WALLET, DEVELOPER_WALLET } from "@/app/providers"
import {
  getBaseBuilderChainId,
  getBaseBuilderExplorerRootUrl,
  getBaseBuilderNetwork,
  toBaseBuilderTxUrl,
} from "@/lib/basebuilder/config"
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
  return "bg-sand text-warm-600"
}

export default function WalletPage() {
  const {
    isConnected,
    walletAddress,
    profile,
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
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load payment ledger.")
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
        setPaymentsError(issue instanceof Error ? issue.message : "Failed to load payment ledger.")
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

  return (
    <div className="animate-slide-up space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif text-warm-800">Wallet & Identity</h1>
        <p className="text-sm text-warm-500 mt-1">
          Your Coinbase Smart Wallet is your identity on OpenRx.
        </p>
      </div>

      {/* Connect / Status */}
      <div className="bg-pampas rounded-2xl border border-sand p-6">
        {!isConnected ? (
          <div className="text-center py-8">
            <WalletIcon size={32} className="text-terra mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-warm-800 mb-1">Connect Your Wallet</h2>
            <p className="text-sm text-warm-500 mb-4 max-w-md mx-auto">
              Connect your Coinbase Smart Wallet to create your OpenRx identity.
              Your profile, preferences, and health data will be linked to your wallet address.
            </p>
            <Wallet>
              <ConnectWallet className="!bg-terra !text-white !rounded-xl !text-sm !font-semibold !py-3 !px-6 hover:!bg-terra-dark !transition mx-auto">
                <Avatar className="h-5 w-5" />
                <Name />
              </ConnectWallet>
            </Wallet>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-terra to-terra-dark flex items-center justify-center">
                  <WalletIcon size={24} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Wallet>
                      <ConnectWallet className="!bg-transparent !p-0 !text-warm-800 !font-serif !text-lg">
                        <Avatar className="h-6 w-6" />
                        <Name className="text-lg font-serif" />
                      </ConnectWallet>
                      <WalletDropdown className="!bg-pampas !border-sand !rounded-xl">
                        <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                          <Avatar />
                          <Name className="text-warm-800 font-semibold" />
                          <Address className="text-cloudy text-[10px]" />
                        </Identity>
                        <WalletDropdownFundLink className="!text-warm-700" />
                        <WalletDropdownLink icon="wallet" href="/wallet" className="!text-warm-700">
                          Wallet Settings
                        </WalletDropdownLink>
                        <WalletDropdownDisconnect className="!text-soft-red" />
                      </WalletDropdown>
                    </Wallet>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-[9px] font-bold text-accent">
                      <CheckCircle2 size={8} />
                      Connected
                    </div>
                  </div>
                  <p className="text-[10px] text-cloudy font-mono mt-0.5">
                    {walletAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile status */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-cream/50 border border-sand/50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <UserCircle size={14} className="text-terra" />
                  <span className="text-xs font-bold text-warm-800">Identity</span>
                </div>
                {profile?.onboardingComplete ? (
                  <div>
                    <p className="text-sm font-semibold text-warm-800">{profile.fullName || "Profile Active"}</p>
                    <p className="text-[10px] text-cloudy mt-0.5">
                      Pharmacy: {profile.preferredPharmacy || "Not set"}
                    </p>
                    <p className="text-[10px] text-cloudy">
                      Last seen: {new Date(profile.lastSeen).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-warm-500">Profile not set up yet</p>
                    <Link
                      href="/onboarding"
                      className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-terra hover:underline"
                    >
                      <Sparkles size={8} />
                      Complete onboarding
                    </Link>
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-cream/50 border border-sand/50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield size={14} className="text-accent" />
                  <span className="text-xs font-bold text-warm-800">Network</span>
                </div>
                <p className="text-sm font-semibold text-warm-800">Base (Coinbase L2)</p>
                <p className="text-[10px] text-cloudy mt-0.5">Fast, low-cost healthcare payments</p>
                <p className="text-[10px] text-warm-600 mt-1">
                  BaseBuilder runtime: {baseBuilderLabel} (chain {baseBuilderChainId})
                </p>
                <a
                  href={baseBuilderExplorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-terra hover:underline"
                >
                  Open BaseScan <ArrowUpRight size={10} />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Options */}
      {isConnected && (
        <div className="bg-pampas rounded-2xl border border-sand p-6">
          <h2 className="text-base font-serif text-warm-800 mb-4">Healthcare Payments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-sand bg-cream/30 p-4">
              <CreditCard size={18} className="text-terra mb-2" />
              <h3 className="text-xs font-bold text-warm-800">Copays</h3>
              <p className="text-[10px] text-warm-500 mt-1">
                Pay appointment copays instantly in USDC on Base.
              </p>
            </div>
            <div className="rounded-xl border border-sand bg-cream/30 p-4">
              <Pill size={18} className="text-yellow-600 mb-2" />
              <h3 className="text-xs font-bold text-warm-800">Prescriptions</h3>
              <p className="text-[10px] text-warm-500 mt-1">
                Pay for Rx refills directly from your wallet.
              </p>
            </div>
            <div className="rounded-xl border border-sand bg-cream/30 p-4">
              <ArrowUpRight size={18} className="text-soft-blue mb-2" />
              <h3 className="text-xs font-bold text-warm-800">Lab & Tests</h3>
              <p className="text-[10px] text-warm-500 mt-1">
                Transparent pricing for lab work and diagnostics.
              </p>
            </div>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="bg-pampas rounded-2xl border border-sand p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-serif text-warm-800">Compliance Controls</h2>
              <p className="text-xs text-warm-500 mt-1">
                Base Pay-aligned verification, receipts, attestations, refunds, and ledger entries.
              </p>
            </div>
            <Link
              href="/compliance-ledger"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sand text-xs font-semibold text-warm-700 hover:border-terra/30 transition"
            >
              <BookText size={12} />
              Open Ledger
            </Link>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="bg-pampas rounded-2xl border border-sand p-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-serif text-warm-800">Recent BaseBuilder Transactions</h2>
              <p className="text-xs text-warm-500 mt-1">
                Latest wallet-linked payment events from the compliance ledger.
              </p>
            </div>
            <Link
              href="/compliance-ledger"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-terra hover:underline"
            >
              Full ledger <ArrowUpRight size={11} />
            </Link>
          </div>

          {loadingPayments && (
            <p className="text-xs text-cloudy inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Loading transactions...
            </p>
          )}

          {!loadingPayments && paymentsError && (
            <p className="text-xs text-soft-red">{paymentsError}</p>
          )}

          {!loadingPayments && !paymentsError && recentPayments.length === 0 && (
            <p className="text-xs text-cloudy">
              No payment activity yet for this wallet.
            </p>
          )}

          {!loadingPayments && !paymentsError && recentPayments.length > 0 && (
            <div className="space-y-2">
              {recentPayments.map((payment) => {
                const txUrl = txHashLooksValid(payment.txHash) ? toBaseBuilderTxUrl(payment.txHash!) : ""
                return (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-sand/70 bg-cream/30 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-warm-800 truncate">
                        {payment.category} · ${payment.settledAmount || payment.expectedAmount} USDC
                      </p>
                      <p className="text-[10px] text-cloudy truncate mt-0.5">
                        {payment.description}
                      </p>
                      <p className="text-[10px] text-cloudy mt-0.5">
                        {new Date(payment.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full uppercase", statusColor(payment.status))}>
                        {payment.status.replaceAll("_", " ")}
                      </span>
                      {txUrl && (
                        <a
                          href={txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-1 text-[10px] font-semibold text-terra hover:underline"
                        >
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
            <p className="text-[10px] text-cloudy mt-2">
              Transactions resolve on {baseBuilderLabel}.
            </p>
          )}
        </div>
      )}

      {/* Agent Auto-Pay */}
      {isConnected && (
        <div className="bg-pampas rounded-2xl border border-sand p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={18} className="text-terra" />
            <h2 className="text-base font-serif text-warm-800">Agent Auto-Pay</h2>
          </div>
          <p className="text-xs text-warm-500 mb-4">
            Allow your AI care team to make payments on your behalf for routine healthcare expenses.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-cream/50 border border-sand/50">
              <div className="flex items-center gap-3">
                <Zap size={14} className="text-terra" />
                <div>
                  <p className="text-xs font-semibold text-warm-800">Auto-pay copays under ${profile?.agentAutoPayLimit || 50}</p>
                  <p className="text-[10px] text-warm-500">Agents can pay routine copays automatically</p>
                </div>
              </div>
              <button
                onClick={() => setAgentAutoPay(!profile?.agentAutoPay)}
                className={cn(
                  "w-10 h-5 rounded-full transition relative",
                  profile?.agentAutoPay ? "bg-accent" : "bg-sand"
                )}
                aria-label="Toggle auto-pay for copays"
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                    profile?.agentAutoPay ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-cream/50 border border-sand/50">
              <div className="flex items-center gap-3">
                <Pill size={14} className="text-yellow-600" />
                <div>
                  <p className="text-xs font-semibold text-warm-800">Auto-pay Rx refills</p>
                  <p className="text-[10px] text-warm-500">Maya can process prescription payments</p>
                </div>
              </div>
              <button
                onClick={() => setAgentRxAutoPay(!profile?.agentRxAutoPay)}
                className={cn(
                  "w-10 h-5 rounded-full transition relative",
                  profile?.agentRxAutoPay ? "bg-accent" : "bg-sand"
                )}
                aria-label="Toggle auto-pay for prescriptions"
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                    profile?.agentRxAutoPay ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Info */}
      <div className="bg-pampas rounded-2xl border border-sand p-6">
        <h3 className="text-xs font-bold text-warm-800 mb-3">Platform Wallets</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-warm-500">Platform Treasury</span>
            <code className="text-cloudy font-mono">{PLATFORM_WALLET}</code>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-warm-500">Developer</span>
            <code className="text-cloudy font-mono">{DEVELOPER_WALLET}</code>
          </div>
        </div>
      </div>
    </div>
  )
}
