"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUpRight, Check, Copy, Loader2, Wallet } from "lucide-react"
import { getOnrampBuyUrl, setupOnrampEventListeners } from "@coinbase/onchainkit/fund"
import { buildRobinhoodUsdcUrl, getPaymentRails, normalizeFundingAmount } from "@/lib/basebuilder/onramp"
import { cn } from "@/lib/utils"

interface FundingRailsProps {
  walletAddress?: string
  amount: string
  /** Tailwind classes for the surrounding card so the host page controls the theme. */
  className?: string
  onFunded?: () => void
}

type RailState = "idle" | "loading" | "opened" | "complete" | "fallback" | "error"

export function FundingRails({ walletAddress, amount, className, onFunded }: FundingRailsProps) {
  const [state, setState] = useState<RailState>("idle")
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const rails = getPaymentRails()
  const robinhoodUrl = buildRobinhoodUsdcUrl()

  useEffect(() => {
    return () => {
      popupRef.current = null
    }
  }, [])

  const copyAddress = useCallback(async () => {
    if (!walletAddress) return
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }, [walletAddress])

  const openCoinbaseOnramp = useCallback(async () => {
    if (!walletAddress) {
      setState("error")
      setMessage("Connect a payment address before funding.")
      return
    }
    setState("loading")
    setMessage("")
    try {
      const response = await fetch("/api/payments/onramp-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, asset: "USDC" }),
      })
      const data = (await response.json()) as { sessionToken?: string; error?: string; fallback?: boolean }

      if (!response.ok || !data.sessionToken) {
        // Onramp not configured on this deployment (missing CDP keys) or the
        // upstream session request failed — fall back to the manual path.
        setState("fallback")
        setMessage(data.error || "Hosted onramp is unavailable on this deployment.")
        return
      }

      const url = getOnrampBuyUrl({
        sessionToken: data.sessionToken,
        presetFiatAmount: normalizeFundingAmount(amount),
        fiatCurrency: "USD",
      })

      const popup = window.open(
        url,
        "openrx-coinbase-onramp",
        "width=500,height=720,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no"
      )
      popupRef.current = popup

      setupOnrampEventListeners({
        onSuccess: () => {
          setState("complete")
          setMessage("USDC purchase submitted. It will appear in the connected address on Base shortly.")
          popupRef.current?.close()
          onFunded?.()
        },
        onExit: () => {
          popupRef.current?.close()
          setState((current) => (current === "complete" ? current : "idle"))
        },
      })

      setState("opened")
    } catch {
      setState("fallback")
      setMessage("Could not start the hosted onramp. Use the manual funding options below.")
    }
  }, [amount, onFunded, walletAddress])

  const disabled = state === "loading" || state === "opened"

  return (
    <div className={cn("space-y-3", className)} data-testid="funding-rails">
      <div className="flex items-center gap-2">
        <Wallet size={13} aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Need USDC? Funding rails</p>
      </div>

      <button
        type="button"
        data-testid="funding-rail-coinbase"
        onClick={() => void openCoinbaseOnramp()}
        disabled={disabled || !walletAddress}
        className="flex w-full items-center justify-between gap-2 rounded-[16px] border border-[rgba(0,82,255,0.3)] bg-[#0052FF] px-4 py-3 text-left text-xs font-semibold text-white transition hover:bg-[#0045d8] disabled:opacity-60"
      >
        <span>
          {state === "loading"
            ? "Starting Coinbase Onramp..."
            : state === "complete"
              ? "Purchase submitted"
              : `Buy ~$${normalizeFundingAmount(amount) || amount} USDC with Coinbase Onramp`}
        </span>
        {state === "loading" ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
      </button>
      <p className="text-[10px] leading-4 opacity-70">
        {rails[0].description}
      </p>

      <a
        data-testid="funding-rail-robinhood"
        href={robinhoodUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-between gap-2 rounded-[16px] border border-emerald-700/25 bg-emerald-950/10 px-4 py-3 text-left text-xs font-semibold transition hover:bg-emerald-950/20"
      >
        <span>Buy USDC on Robinhood, withdraw on Base</span>
        <ArrowUpRight size={13} />
      </a>
      <p className="text-[10px] leading-4 opacity-70">
        {rails[1].description}
      </p>

      {walletAddress ? (
        <div className="rounded-[14px] border border-current/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Your receive address (Base network)</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="break-all font-mono text-[10px]">{walletAddress}</code>
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-[10px] leading-4 opacity-70">
            Paste this as the withdrawal address in Robinhood or any exchange, and select the Base network for USDC.
          </p>
        </div>
      ) : null}

      {state === "fallback" || state === "error" ? (
        <p className="text-[10px] leading-4 opacity-80" role="status">
          {message}
        </p>
      ) : null}
      {state === "complete" ? (
        <p className="text-[10px] leading-4 opacity-80" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
