"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  RotateCcw,
  ShieldCheck,
  WalletCards,
} from "lucide-react"
import { PreparedDepositTransaction } from "@/components/commitments/prepared-deposit-transaction"
import type { CommitmentSnapshot, PreparedDeposit } from "@/lib/commitments/types"

interface PilotConfig {
  enabled: boolean
  network: "local-mock" | "base-sepolia" | null
  flags: {
    coinbaseOnrampPilot: boolean
    privateCompletionCredentials: boolean
    insurerVerifierDemo: boolean
  }
}

function money(minor = 0): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100)
}

async function readJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(value.error?.message || "The request could not be completed.")
  return value
}

export default function CommitmentDetailPage({ params }: { params: { id: string } }) {
  const [snapshot, setSnapshot] = useState<CommitmentSnapshot | null>(null)
  const [config, setConfig] = useState<PilotConfig | null>(null)
  const [prepared, setPrepared] = useState<PreparedDeposit | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState("")
  const [error, setError] = useState("")
  const [subdivision, setSubdivision] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("ACH_BANK_ACCOUNT")
  const [verifierName, setVerifierName] = useState("Sandbox insurer verifier")
  const [shareUrl, setShareUrl] = useState("")
  const id = params.id

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [commitmentResponse, configResponse] = await Promise.all([
        fetch(`/api/commitments/${encodeURIComponent(id)}`, { cache: "no-store" }),
        fetch("/api/commitments/config", { cache: "no-store" }),
      ])
      const commitment = await readJson<{ snapshot: CommitmentSnapshot }>(commitmentResponse)
      const pilotConfig = await readJson<PilotConfig>(configResponse)
      setSnapshot(commitment.snapshot)
      setConfig(pilotConfig)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The reservation is unavailable.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function action(
    name: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    setWorking(name)
    setError("")
    try {
      const response = await fetch(`/api/commitments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await readJson<{
        snapshot?: CommitmentSnapshot
        preparedDeposit?: PreparedDeposit
        onramp?: { url: string }
        offramp?: { available: boolean; url?: string; feeDisclosure: string; timingDisclosure: string }
      }>(response)
      if (data.snapshot) setSnapshot(data.snapshot)
      if (data.preparedDeposit) setPrepared(data.preparedDeposit)
      if (data.onramp?.url) window.open(data.onramp.url, "_blank", "noopener,noreferrer")
      if (data.offramp?.url) window.open(data.offramp.url, "_blank", "noopener,noreferrer")
      if (data.offramp && !data.offramp.available) {
        setError(`${data.offramp.feeDisclosure} ${data.offramp.timingDisclosure}`)
      }
      return data as Record<string, unknown>
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The request could not be completed.")
      return null
    } finally {
      setWorking("")
    }
  }

  async function activateLocalSandbox() {
    setWorking("activate")
    setError("")
    try {
      let current = snapshot
      if (!current?.identity || current.identity.status !== "verified") {
        const verified = await readJson<{ snapshot: CommitmentSnapshot }>(
          await fetch(`/api/commitments/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verify_identity" }),
          }),
        )
        current = verified.snapshot
        setSnapshot(current)
      }
      await readJson<{ snapshot: CommitmentSnapshot }>(
        await fetch(`/api/commitments/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "quote",
            paymentMethod: "sandbox_balance",
            country: "US",
          }),
        }),
      )
      const funded = await readJson<{ snapshot: CommitmentSnapshot }>(
        await fetch(`/api/commitments/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fund" }),
        }),
      )
      setSnapshot(funded.snapshot)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The sandbox deposit could not be completed.")
    } finally {
      setWorking("")
    }
  }

  async function quoteCoinbase() {
    if (!subdivision.trim()) {
      setError("Enter your two-letter state code to check available funding methods.")
      return
    }
    if (!snapshot?.identity || snapshot.identity.status !== "verified") {
      const result = await action("identity", { action: "verify_identity" })
      if (!result) return
    }
    await action("quote", {
      action: "quote",
      paymentMethod,
      country: "US",
      subdivision: subdivision.trim().toUpperCase(),
    })
  }

  async function createShare() {
    setWorking("share")
    setError("")
    try {
      const result = await readJson<{ url: string }>(
        await fetch(`/api/commitments/${encodeURIComponent(id)}/shares`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intendedVerifier: verifierName, ttlMinutes: 30 }),
        }),
      )
      setShareUrl(`${window.location.origin}${result.url}`)
      await load()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The private link could not be created.")
    } finally {
      setWorking("")
    }
  }

  async function revokeShare(shareId: string) {
    setWorking(`revoke-${shareId}`)
    try {
      const result = await readJson<{ snapshot: CommitmentSnapshot }>(
        await fetch(`/api/commitments/${encodeURIComponent(id)}/shares`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareId }),
        }),
      )
      setSnapshot(result.snapshot)
      setShareUrl("")
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The private link could not be revoked.")
    } finally {
      setWorking("")
    }
  }

  const timeline = useMemo(() => {
    if (!snapshot) return []
    return [
      { label: "Terms accepted", complete: true, detail: new Date(snapshot.commitment.consentedAt).toLocaleDateString() },
      { label: "Identity matched", complete: snapshot.identity?.status === "verified" },
      { label: "Deposit confirmed", complete: snapshot.commitment.fundingStatus === "confirmed" },
      { label: "Completion verified", complete: Boolean(snapshot.commitment.conditionVerifiedAt) },
      { label: "Deposit returned", complete: snapshot.commitment.refundStatus === "confirmed" },
    ]
  }, [snapshot])

  if (loading) {
    return (
      <main data-openrx-warm className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
        <p className="flex items-center gap-2 text-sm text-secondary">
          <Loader2 size={16} className="animate-spin" />
          Loading reservation...
        </p>
      </main>
    )
  }
  if (!snapshot || !config) {
    return (
      <main data-openrx-warm className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert" className="text-sm text-red-200">{error || "Reservation not found."}</p>
      </main>
    )
  }

  const { commitment } = snapshot
  const active = commitment.status === "funded" || commitment.status === "extended"
  const terminal = ["refunded", "cancelled", "expired"].includes(commitment.status)

  return (
    <main data-openrx-warm className="mx-auto w-full max-w-4xl px-0 py-5 sm:py-9">
      <Link href="/commitments" className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-primary">
        <ArrowLeft size={14} />
        Screening reservations
      </Link>

      <header className="mt-6 border-b border-white/10 pb-6">
        <p className="flex items-center gap-2 text-xs font-semibold text-teal">
          <CalendarCheck size={15} />
          Optional commitment
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-primary sm:text-3xl">{commitment.screeningLabel}</h1>
        <p className="mt-2 text-sm text-secondary">
          {active && commitment.currentDeadline
            ? `Complete by ${new Date(commitment.currentDeadline).toLocaleDateString()}.`
            : commitment.status === "refunded"
              ? "Completion verified and your full deposit was returned."
              : commitment.status === "cancelled"
                ? "This reservation was cancelled."
                : commitment.status === "expired"
                  ? "This reservation expired and the remaining deposit was returned."
                  : "Finish setup to start your 90-day window."}
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-5 rounded-[12px] border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-7">
          {commitment.status === "created" ? (
            <section aria-labelledby="commitment-setup-heading">
              <h2 id="commitment-setup-heading" className="text-lg font-semibold text-primary">Finish your reservation</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Your identity is matched off-chain before any deposit. Payment credentials are handled by the
                funding provider and are never stored by OpenRx.
              </p>

              {config.network === "local-mock" ? (
                <button
                  type="button"
                  data-testid="commitment-activate-sandbox"
                  disabled={Boolean(working)}
                  onClick={() => void activateLocalSandbox()}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-white px-4 text-sm font-semibold text-[#111514] disabled:opacity-50"
                >
                  {working === "activate" ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  Place sandbox deposit
                </button>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-secondary">
                      State
                      <input
                        value={subdivision}
                        onChange={(event) => setSubdivision(event.target.value.slice(0, 2))}
                        placeholder="CA"
                        className="mt-2 min-h-11 w-full rounded-[12px] border border-white/12 bg-white/5 px-3 text-sm uppercase text-primary outline-none focus:border-teal/55"
                      />
                    </label>
                    <label className="text-xs font-medium text-secondary">
                      Funding method
                      <select
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                        className="mt-2 min-h-11 w-full rounded-[12px] border border-white/12 bg-[#141817] px-3 text-sm text-primary outline-none focus:border-teal/55"
                      >
                        <option value="ACH_BANK_ACCOUNT">Eligible bank account</option>
                        <option value="CARD">Eligible debit card</option>
                        <option value="APPLE_PAY">Apple Pay</option>
                        <option value="FIAT_WALLET">Coinbase balance</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void quoteCoinbase()}
                    className="min-h-11 rounded-[12px] bg-white px-4 text-sm font-semibold text-[#111514] disabled:opacity-50"
                  >
                    Get current quote
                  </button>

                  {snapshot.quote ? (
                    <div className="border-y border-white/10 py-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-secondary">Coinbase fee</span>
                        <span className="text-primary">{money(snapshot.quote.feeMinor)}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-4">
                        <span className="text-secondary">Network fee</span>
                        <span className="text-primary">{money(snapshot.quote.networkFeeMinor)}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-4 font-semibold">
                        <span className="text-secondary">Total</span>
                        <span className="text-primary">{money(snapshot.quote.paymentTotalMinor)}</span>
                      </div>
                      <button
                        type="button"
                        disabled={!snapshot.quote.available || Boolean(working)}
                        onClick={() => void action("onramp", { action: "start_onramp" })}
                        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-white/15 px-4 text-sm font-semibold text-primary disabled:opacity-45"
                      >
                        Open Coinbase
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void action("prepare", { action: "prepare_deposit" })}
                    className="text-sm font-semibold text-teal"
                  >
                    I already have the required USDC
                  </button>
                  {prepared ? (
                    <PreparedDepositTransaction
                      prepared={prepared}
                      onConfirmed={async (transactionHash) => {
                        await action("confirm", { action: "confirm_deposit", transactionHash })
                      }}
                    />
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {active ? (
            <section aria-labelledby="commitment-deadline-heading">
              <h2 id="commitment-deadline-heading" className="text-lg font-semibold text-primary">Completion window</h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-secondary">
                <Clock3 size={15} />
                {commitment.currentDeadline
                  ? `Deadline: ${new Date(commitment.currentDeadline).toLocaleDateString()}`
                  : "Deadline pending"}
              </p>
              <p className="mt-3 text-sm leading-6 text-secondary">
                A trusted provider or laboratory confirms completion. OpenRx receives only the opaque completion
                signal required to return your deposit, not the result.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {!commitment.extensionUsed ? (
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void action("extend", { action: "extend" })}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-white/14 px-3 text-xs font-semibold text-primary"
                  >
                    <RotateCcw size={13} />
                    Request 90-day extension
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={Boolean(working)}
                  onClick={() => {
                    if (window.confirm(`Cancel this reservation? ${money(commitment.cancellationFeeMinor)} will be retained as the disclosed administrative fee.`)) {
                      void action("cancel", { action: "cancel" })
                    }
                  }}
                  className="min-h-10 rounded-[12px] px-3 text-xs font-semibold text-red-200 hover:bg-red-300/10"
                >
                  Cancel reservation
                </button>
              </div>
            </section>
          ) : null}

          {snapshot.credential ? (
            <section aria-labelledby="private-credential-heading" className="border-t border-white/10 pt-7">
              <p className="flex items-center gap-2 text-xs font-semibold text-teal">
                <ShieldCheck size={14} />
                Optional private proof
              </p>
              <h2 id="private-credential-heading" className="mt-2 text-lg font-semibold text-primary">
                Completion credential
              </h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                This signed credential says only that a condition was verified during a broad validity period. It
                excludes your identity, screening name, result, diagnosis, and exact completion date.
              </p>
              {config.flags.insurerVerifierDemo ? (
                <div className="mt-5 space-y-3">
                  <label className="block text-xs font-medium text-secondary">
                    Intended verifier
                    <input
                      value={verifierName}
                      onChange={(event) => setVerifierName(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-[12px] border border-white/12 bg-white/5 px-3 text-sm text-primary outline-none focus:border-teal/55"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void createShare()}
                    className="min-h-11 rounded-[12px] bg-white px-4 text-sm font-semibold text-[#111514] disabled:opacity-50"
                  >
                    Create 30-minute private link
                  </button>
                  {shareUrl ? (
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(shareUrl)}
                      className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-white/12 p-3 text-left text-xs text-secondary"
                    >
                      <span className="truncate">{shareUrl}</span>
                      <Copy size={14} className="shrink-0" />
                    </button>
                  ) : null}
                  {snapshot.shares.filter((share) => !share.revokedAt).map((share) => (
                    <div key={share.id} className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
                      <span className="text-secondary">
                        {share.intendedVerifier} · {share.accessCount} access
                        {share.accessCount === 1 ? "" : "es"} · expires{" "}
                        {new Date(share.expiresAt).toLocaleTimeString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => void revokeShare(share.id)}
                        className="font-semibold text-red-200"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {terminal && commitment.refundStatus === "confirmed" ? (
            <section className="border-t border-white/10 pt-7">
              <h2 className="text-lg font-semibold text-primary">Deposit returned</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                {money(snapshot.refundTransaction?.amountMinor)} was returned as USDC to your OpenRx wallet. It was
                not automatically returned to a card or bank account.
              </p>
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => void action("offramp", { action: "offramp" })}
                className="mt-4 min-h-10 rounded-[12px] border border-white/14 px-3 text-xs font-semibold text-primary"
              >
                Check cash-out availability
              </button>
            </section>
          ) : null}

          <details className="border-t border-white/10 pt-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-secondary">
              Advanced details
              <ChevronDown size={15} />
            </summary>
            <dl className="mt-4 grid gap-3 text-xs text-secondary sm:grid-cols-2">
              <div>
                <dt className="text-muted">Sandbox network</dt>
                <dd className="mt-1 font-mono">{commitment.network}</dd>
              </div>
              <div>
                <dt className="text-muted">Wallet</dt>
                <dd className="mt-1 truncate font-mono">{snapshot.wallet?.publicAddress || "Pending"}</dd>
              </div>
              <div>
                <dt className="text-muted">Opaque commitment</dt>
                <dd className="mt-1 truncate font-mono">{commitment.opaqueCommitmentId}</dd>
              </div>
              <div>
                <dt className="text-muted">Credential protocol</dt>
                <dd className="mt-1 font-mono">{snapshot.credential?.protocol || "Not issued"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted">
              Public data contains only a random commitment identifier, wallet, amount, timestamps, and generic
              status. No identity, screening type, result, code, appointment, or provider note is included.
            </p>
          </details>
        </div>

        <aside>
          <h2 className="text-xs font-semibold uppercase text-muted">Progress</h2>
          <ol className="mt-4 space-y-4">
            {timeline.map((item) => (
              <li key={item.label} className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    item.complete ? "bg-teal text-[#0c1412]" : "border border-white/20 text-transparent"
                  }`}
                >
                  <Check size={12} />
                </span>
                <div>
                  <p className={`text-xs font-medium ${item.complete ? "text-primary" : "text-muted"}`}>{item.label}</p>
                  {item.detail ? <p className="mt-1 text-[11px] text-muted">{item.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 border-t border-white/10 pt-5">
            <p className="flex items-center gap-2 text-xs font-semibold text-primary">
              <WalletCards size={14} />
              Refund terms
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Completion: {money(commitment.depositAmountMinor - commitment.completionFeeMinor)}. Cancellation or
              unresolved expiration: {money(commitment.depositAmountMinor - commitment.cancellationFeeMinor)}.
              The entire deposit is never forfeited in this pilot.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
