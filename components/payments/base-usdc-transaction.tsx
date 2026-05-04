"use client"

import { useMemo, useState } from "react"
import type { ComponentType } from "react"
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
  type LifecycleStatus,
  type TransactionButtonProps,
  type TransactionResponseType,
  type TransactionStatusActionProps,
  type TransactionStatusLabelProps,
  type TransactionStatusProps,
} from "@coinbase/onchainkit/transaction"
import type { Call, Hex } from "viem"
import { base } from "viem/chains"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { buildUsdcTransferCall } from "@/lib/basebuilder/usdc"
import { getBaseBuilderChainId } from "@/lib/basebuilder/config"
import { cn } from "@/lib/utils"

const SafeTransactionButton = TransactionButton as unknown as ComponentType<TransactionButtonProps>
const SafeTransactionStatus = TransactionStatus as unknown as ComponentType<TransactionStatusProps>
const SafeTransactionStatusLabel = TransactionStatusLabel as unknown as ComponentType<TransactionStatusLabelProps>
const SafeTransactionStatusAction = TransactionStatusAction as unknown as ComponentType<TransactionStatusActionProps>

interface BaseUsdcTransactionProps {
  amount: string
  recipientAddress: string
  disabled?: boolean
  className?: string
  onTransactionHash: (hash: string) => void
  onConfirmed?: (hash: string) => void
}

function readableStatus(status: LifecycleStatus["statusName"]): string {
  switch (status) {
    case "buildingTransaction":
      return "Preparing Base transaction..."
    case "transactionPending":
      return "Waiting for wallet approval..."
    case "transactionLegacyExecuted":
      return "Submitted on Base. Waiting for confirmation..."
    case "success":
      return "Base USDC transfer confirmed."
    case "error":
      return "Payment transaction needs attention."
    default:
      return "Ready for Base USDC payment."
  }
}

function firstHashFromStatus(status: LifecycleStatus): string {
  if (status.statusName === "transactionLegacyExecuted") {
    return status.statusData.transactionHashList[0] || ""
  }
  if (status.statusName === "success") {
    return status.statusData.transactionReceipts[0]?.transactionHash || ""
  }
  return ""
}

function firstHashFromSuccess(response: TransactionResponseType): string {
  return response.transactionReceipts[0]?.transactionHash || ""
}

export function BaseUsdcTransaction({
  amount,
  recipientAddress,
  disabled,
  className,
  onTransactionHash,
  onConfirmed,
}: BaseUsdcTransactionProps) {
  const [statusText, setStatusText] = useState("Ready for Base USDC payment.")
  const [statusTone, setStatusTone] = useState<"idle" | "pending" | "success" | "error">("idle")
  const [localError, setLocalError] = useState("")
  const chainId = getBaseBuilderChainId()
  const isSponsored = Boolean(process.env.NEXT_PUBLIC_CDP_PAYMASTER_URL || process.env.NEXT_PUBLIC_ONCHAINKIT_PAYMASTER_URL)

  const prepared = useMemo<{ calls: Call[]; error: string }>(() => {
    if (!recipientAddress || disabled) return { calls: [], error: "" }
    try {
      const call = buildUsdcTransferCall({ amount, recipientAddress })
      return { calls: [{ to: call.to as Hex, data: call.data as Hex, value: call.value }], error: "" }
    } catch (error) {
      return { calls: [], error: error instanceof Error ? error.message : "Unable to prepare Base USDC transfer." }
    }
  }, [amount, disabled, recipientAddress])
  const calls = prepared.calls

  function handleStatus(status: LifecycleStatus) {
    const hash = firstHashFromStatus(status)
    if (hash) onTransactionHash(hash)

    setStatusText(readableStatus(status.statusName))
    if (status.statusName === "error") {
      setStatusTone("error")
      const issue = status.statusData as { message?: string }
      setLocalError(issue.message || "The wallet transaction did not complete.")
    } else if (status.statusName === "success") {
      setStatusTone("success")
    } else if (status.statusName === "buildingTransaction" || status.statusName === "transactionPending" || status.statusName === "transactionLegacyExecuted") {
      setStatusTone("pending")
    } else {
      setStatusTone("idle")
    }
  }

  function handleSuccess(response: TransactionResponseType) {
    const hash = firstHashFromSuccess(response)
    if (hash) {
      onTransactionHash(hash)
      onConfirmed?.(hash)
    }
  }

  const cannotPay = disabled || calls.length === 0
  const visibleError = localError || prepared.error

  return (
    <div className={cn("space-y-2", className)}>
      <Transaction
        chainId={chainId || base.id}
        calls={calls}
        isSponsored={isSponsored}
        onStatus={handleStatus}
        onSuccess={handleSuccess}
      >
        <SafeTransactionButton
          disabled={cannotPay}
          text={`Pay ${amount} USDC on Base`}
          pendingOverride={{ text: "Confirming payment..." }}
          successOverride={{ text: "Payment submitted" }}
          className="control-button-primary w-full justify-center"
        />
        <SafeTransactionStatus className="rounded-[14px] border border-white/12 bg-white/8 px-3 py-2 text-[11px] text-white/74">
          <SafeTransactionStatusLabel />
          <SafeTransactionStatusAction />
        </SafeTransactionStatus>
      </Transaction>

      <div className={cn(
        "flex items-center gap-2 rounded-[14px] px-3 py-2 text-[11px]",
        statusTone === "success" && "bg-emerald-400/12 text-emerald-100",
        statusTone === "pending" && "bg-white/10 text-white/78",
        statusTone === "error" && "bg-red-400/12 text-red-100",
        statusTone === "idle" && "bg-white/8 text-white/64"
      )}>
        {statusTone === "success" ? <CheckCircle2 size={13} /> : statusTone === "pending" ? <Loader2 size={13} className="animate-spin" /> : <AlertCircle size={13} />}
        <span>{visibleError || statusText}</span>
      </div>
    </div>
  )
}
