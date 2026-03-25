"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Loader2, LockKeyhole, RefreshCcw, SendHorizontal, ShieldCheck, WalletCards } from "lucide-react"
import { toBaseBuilderTxUrl } from "@/lib/basebuilder/config"
import type { TreasuryActionRecord } from "@/lib/payments-ledger"
import type { DatabaseHealth } from "@/lib/database-health"
import type { PrivyBalance, PrivyTransaction } from "@/lib/privy-treasury"

type TreasuryPayload = {
  ok: boolean
  database: DatabaseHealth
  treasury: {
    configured: boolean
    message: string
    walletId?: string
    walletAddress?: string
    balances: PrivyBalance[]
    recentTransactions: PrivyTransaction[]
    recentActions: TreasuryActionRecord[]
  }
  config: {
    configured: boolean
    message: string
  }
}

const STORAGE_KEY = "openrx.admin.api.key"

function truncate(value?: string, size = 10): string {
  if (!value) return "-"
  if (value.length <= size * 2) return value
  return `${value.slice(0, size)}...${value.slice(-size)}`
}

export default function TreasuryConsole() {
  const [adminApiKey, setAdminApiKey] = useState("")
  const [payload, setPayload] = useState<TreasuryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [asset, setAsset] = useState<"ETH" | "USDC">("USDC")
  const [amount, setAmount] = useState("0.50")
  const [toAddress, setToAddress] = useState("")
  const [reason, setReason] = useState("Treasury payout")
  const [kind, setKind] = useState<"transfer" | "refund">("transfer")
  const [successMessage, setSuccessMessage] = useState("")

  const totalUsd = useMemo(() => {
    if (!payload) return "0.00"
    const total = payload.treasury.balances.reduce((sum, balance) => sum + Number.parseFloat(balance.usd || "0"), 0)
    return total.toFixed(2)
  }, [payload])

  const load = useCallback(async (key = adminApiKey) => {
    if (!key.trim()) {
      setError("Enter the admin API key to unlock treasury controls.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/payments/treasury", {
        headers: {
          "x-admin-api-key": key.trim(),
        },
        cache: "no-store",
      })
      const data = (await response.json()) as TreasuryPayload & { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load treasury console.")
      }
      window.sessionStorage.setItem(STORAGE_KEY, key.trim())
      setPayload(data)
    } catch (issue) {
      setPayload(null)
      setError(issue instanceof Error ? issue.message : "Failed to load treasury console.")
    } finally {
      setLoading(false)
    }
  }, [adminApiKey])

  useEffect(() => {
    const existing = window.sessionStorage.getItem(STORAGE_KEY)
    if (existing) {
      setAdminApiKey(existing)
      void load(existing)
    }
  }, [load])

  function lockConsole() {
    window.sessionStorage.removeItem(STORAGE_KEY)
    setPayload(null)
    setAdminApiKey("")
    setError("")
    setSuccessMessage("")
  }

  async function submitAction() {
    if (!adminApiKey.trim()) {
      setError("Enter the admin API key to submit treasury actions.")
      return
    }
    setSubmitting(true)
    setError("")
    setSuccessMessage("")
    try {
      const response = await fetch("/api/payments/treasury", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-api-key": adminApiKey.trim(),
        },
        body: JSON.stringify({
          asset,
          amount,
          toAddress,
          reason,
          kind,
        }),
      })
      const data = (await response.json()) as {
        error?: string
        action?: TreasuryActionRecord
        transactionHash?: string
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit treasury action.")
      }
      setSuccessMessage(data.transactionHash ? `Submitted ${asset} transfer ${truncate(data.transactionHash, 12)}.` : "Treasury action submitted.")
      await load(adminApiKey)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to submit treasury action.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="surface-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards size={15} className="text-teal" />
            <h2 className="text-sm font-bold text-primary">Treasury Console</h2>
          </div>
          <p className="text-xs text-muted mt-1">
            Privy-backed treasury balances, outbound transfers, and recorded actions. Server credentials stay off the client.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading || !adminApiKey.trim()}
            className="control-button-secondary"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
            Refresh
          </button>
          <button
            onClick={lockConsole}
            className="control-button-secondary"
          >
            <LockKeyhole size={11} />
            Lock
          </button>
        </div>
      </div>

      {!payload && (
        <div className="grid grid-cols-1 gap-3 rounded-[24px] border border-border/70 bg-white/65 p-4 md:grid-cols-[1fr_auto]">
          <label className="control-label">
            Admin API key
            <input
              type="password"
              value={adminApiKey}
              onChange={(event) => setAdminApiKey(event.target.value)}
              className="control-input"
              placeholder="OPENRX_ADMIN_API_KEY"
            />
          </label>
          <button
            onClick={() => void load()}
            disabled={!adminApiKey.trim() || loading}
            className="control-button-primary self-end"
          >
            Unlock Treasury
          </button>
        </div>
      )}

      {error && <div className="rounded-xl border border-soft-red/20 bg-soft-red/5 p-3 text-xs text-soft-red">{error}</div>}
      {successMessage && <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs text-accent">{successMessage}</div>}

      {payload && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <TreasuryStat label="Database" value={payload.database.reachable ? "Connected" : "Attention"} sublabel={payload.database.status} />
            <TreasuryStat label="Wallet" value={truncate(payload.treasury.walletAddress, 8)} sublabel={payload.treasury.walletId || "No wallet id"} />
            <TreasuryStat label="Balances" value={`${payload.treasury.balances.length}`} sublabel="tracked assets" />
            <TreasuryStat label="Portfolio" value={`$${totalUsd}`} sublabel="reported USD" />
          </div>

          {!payload.config.configured && (
            <div className="rounded-xl border border-yellow-300/30 bg-yellow-100/20 p-3 text-xs text-primary">
              {payload.config.message}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="surface-muted space-y-3 p-4">
              <h3 className="text-xs font-bold text-primary">Balances</h3>
              <div className="space-y-2">
                {payload.treasury.balances.length === 0 && <p className="text-[11px] text-muted">No balances returned by Privy.</p>}
                {payload.treasury.balances.map((balance) => (
                  <div key={`${balance.chain}-${balance.asset}`} className="flex items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold text-primary">{balance.asset}</p>
                      <p className="text-[10px] text-muted">{balance.chain}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-primary">{balance.display}</p>
                      <p className="text-[10px] text-muted">{balance.usd ? `$${balance.usd}` : balance.rawValue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-muted space-y-3 p-4">
              <h3 className="text-xs font-bold text-primary">Admin Transfer</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="control-label">
                  Kind
                  <select value={kind} onChange={(event) => setKind(event.target.value as "transfer" | "refund")} className="control-select">
                    <option value="transfer">Transfer</option>
                    <option value="refund">Refund</option>
                  </select>
                </label>
                <label className="control-label">
                  Asset
                  <select value={asset} onChange={(event) => setAsset(event.target.value as "ETH" | "USDC")} className="control-select">
                    <option value="USDC">USDC</option>
                    <option value="ETH">ETH</option>
                  </select>
                </label>
              </div>
              <label className="control-label">
                Amount
                <input value={amount} onChange={(event) => setAmount(event.target.value)} className="control-input" />
              </label>
              <label className="control-label">
                Recipient address
                <input value={toAddress} onChange={(event) => setToAddress(event.target.value)} className="control-input" placeholder="0x..." />
              </label>
              <label className="control-label">
                Reason
                <input value={reason} onChange={(event) => setReason(event.target.value)} className="control-input" />
              </label>
              <button
                onClick={() => void submitAction()}
                disabled={submitting || !payload.config.configured}
                className="control-button-primary w-full"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <SendHorizontal size={12} />}
                Submit Treasury Action
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="surface-muted space-y-3 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={13} className="text-accent" />
                <h3 className="text-xs font-bold text-primary">Recorded Treasury Actions</h3>
              </div>
              <div className="space-y-2">
                {payload.treasury.recentActions.length === 0 && <p className="text-[11px] text-muted">No treasury actions recorded yet.</p>}
                {payload.treasury.recentActions.map((action) => (
                  <div key={action.id} className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">{action.kind} {action.asset} ${action.amount}</span>
                      <span className="text-[10px] uppercase text-muted">{action.status}</span>
                    </div>
                    <p className="text-[10px] text-muted mt-1">To {truncate(action.toAddress, 8)} • {action.reason}</p>
                    {action.transactionHash && (
                      <a href={toBaseBuilderTxUrl(action.transactionHash)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-teal hover:underline">
                        View tx <ArrowUpRight size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-muted space-y-3 p-4">
              <h3 className="text-xs font-bold text-primary">Recent Privy Transactions</h3>
              <div className="space-y-2">
                {payload.treasury.recentTransactions.length === 0 && <p className="text-[11px] text-muted">No recent transactions returned by Privy.</p>}
                {payload.treasury.recentTransactions.map((transaction, index) => (
                  <div key={`${transaction.hash || transaction.createdAt}-${index}`} className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">{transaction.asset || "Asset"} {transaction.type || "transaction"}</span>
                      <span className="text-[10px] uppercase text-muted">{transaction.status}</span>
                    </div>
                    <p className="text-[10px] text-muted mt-1">{truncate(transaction.sender, 8)} → {truncate(transaction.recipient, 8)}</p>
                    {transaction.hash && (
                      <a href={toBaseBuilderTxUrl(transaction.hash)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-teal hover:underline">
                        {truncate(transaction.hash, 10)} <ArrowUpRight size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TreasuryStat({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="surface-muted p-3">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-sm font-semibold text-primary mt-1">{value}</p>
      <p className="text-[10px] text-muted mt-1">{sublabel}</p>
    </div>
  )
}
