"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarCheck, ChevronDown, Loader2, ShieldCheck, X } from "lucide-react"
import { useWalletIdentity } from "@/lib/wallet-context"

interface CommitmentOfferProps {
  recommendationId: string
  screeningLabel: string
  guidelineSource: string
  guidelineVersion: string
  engineVersion: string
  sourceUrl: string
  recommendationIssuedAt: string
  eligibilityToken: string
  eligible: boolean
}

interface PilotConfig {
  enabled: boolean
  network: "local-mock" | "base-sepolia" | null
  terms?: {
    depositAmountMinor: number
    cancellationFeeMinor: number
    completionFeeMinor: number
    initialWindowDays: number
    extensionDays: number
    maximumExtensions: number
    consentVersion: string
  } | null
}

function money(minor = 0): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100)
}

export function CommitmentOffer(props: CommitmentOfferProps) {
  const router = useRouter()
  const { walletAddress } = useWalletIdentity()
  const [config, setConfig] = useState<PilotConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    fetch("/api/commitments/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: PilotConfig) => {
        if (active) setConfig(value)
      })
      .catch(() => {
        if (active) setConfig({ enabled: false, network: null })
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  if (!props.eligible || !config?.enabled || !config.terms) return null

  async function createCommitment() {
    if (!accepted || !config?.terms) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/commitments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(walletAddress ? { "x-wallet-address": walletAddress } : {}),
        },
        body: JSON.stringify({
          recommendationId: props.recommendationId,
          screeningLabel: props.screeningLabel,
          guidelineSource: props.guidelineSource,
          guidelineVersion: props.guidelineVersion,
          engineVersion: props.engineVersion,
          sourceUrl: props.sourceUrl,
          recommendationIssuedAt: props.recommendationIssuedAt,
          eligibilityToken: props.eligibilityToken,
          consentVersion: config.terms.consentVersion,
          termsAccepted: true,
          existingWalletAddress: config.network === "base-sepolia" ? walletAddress : undefined,
        }),
      })
      const data = (await response.json()) as {
        snapshot?: { commitment: { id: string } }
        error?: { message?: string }
      }
      if (!response.ok || !data.snapshot) {
        throw new Error(data.error?.message || "The reservation could not be started.")
      }
      router.push(`/commitments/${encodeURIComponent(data.snapshot.commitment.id)}`)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The reservation could not be started.")
    } finally {
      setLoading(false)
    }
  }

  const terms = config.terms
  return (
    <>
      <button
        type="button"
        data-testid="reserve-screening"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-teal/25 bg-teal/10 px-3 py-2 text-xs font-semibold text-teal transition hover:border-teal/45 hover:bg-teal/15"
      >
        <CalendarCheck size={13} aria-hidden="true" />
        Reserve my screening
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="commitment-offer-title"
            className="max-h-[92vh] w-full overflow-y-auto border border-border bg-white p-5 text-primary shadow-2xl sm:max-w-xl sm:rounded-[12px] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-teal">Optional commitment</p>
                <h2 id="commitment-offer-title" className="mt-2 text-xl font-semibold text-primary">
                  Reserve {props.screeningLabel}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-secondary">
              Set aside {money(terms.depositAmountMinor)} while you arrange this screening. This is optional.
              Declining does not affect your care, recommendation, priority, or access.
            </p>

            <dl className="mt-5 divide-y divide-border border-y border-border text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Complete within</dt>
                <dd className="font-medium text-primary">{terms.initialWindowDays} days</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Verified completion refund</dt>
                <dd className="font-medium text-primary">{money(terms.depositAmountMinor)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Cancellation or expiration fee</dt>
                <dd className="font-medium text-primary">{money(terms.cancellationFeeMinor)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Scheduling extension</dt>
                <dd className="text-right font-medium text-primary">
                  One {terms.extensionDays}-day extension
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-3 rounded-[8px] border border-teal/20 bg-teal/5 p-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-teal-dark" size={17} />
              <p className="text-xs leading-5 text-secondary">
                Completion is confirmed by a trusted provider or laboratory. Results and screening details are
                never sent to a public network.
              </p>
            </div>

            <details className="mt-4 border-t border-border pt-3 text-xs text-muted">
              <summary className="flex cursor-pointer list-none items-center justify-between py-2 font-medium text-secondary">
                Advanced details
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <p className="mt-2 leading-5">
                The deposit is returned as USDC to your dedicated OpenRx wallet, not automatically to the original
                bank or card. You may keep it there or, where Coinbase offers an eligible cash-out method, authorize
                a separate transfer. Coinbase may apply eligibility checks, fees, spread, and settlement time.
                OpenRx does not receive or store Coinbase payment credentials.
              </p>
              <p className="mt-2 leading-5">
                Sandbox network: {config.network === "base-sepolia" ? "Base Sepolia" : "local simulation"}.
                No real funds are accepted in this pilot build.
              </p>
            </details>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[8px] border border-border p-3">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-cyan-400"
              />
              <span className="text-xs leading-5 text-secondary">
                I understand the deposit is optional, the refund terms above, and that this does not replace
                scheduling the screening with a clinician or facility.
              </span>
            </label>

            {error ? (
              <p role="alert" className="mt-3 rounded-[12px] border border-red-300/20 bg-red-300/10 p-3 text-xs text-red-100">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-[8px] px-4 text-sm font-medium text-secondary hover:bg-surface"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={!accepted || loading}
                onClick={() => void createCommitment()}
                className="control-button-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
