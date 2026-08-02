"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
  type LifecycleStatus,
} from "@coinbase/onchainkit/transaction"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import type { PreparedDeposit } from "@/lib/commitments/types"

interface TransactionButtonCompatProps {
  className?: string
  disabled?: boolean
  text?: string
  pendingOverride?: { text?: string }
  successOverride?: { text?: string }
}

interface TransactionStatusCompatProps {
  className?: string
  children?: ReactNode
}

interface TransactionResponseCompat {
  transactionReceipts: Array<{ transactionHash?: string }>
}

const SafeTransactionButton = TransactionButton as unknown as ComponentType<TransactionButtonCompatProps>
const SafeTransactionStatus = TransactionStatus as unknown as ComponentType<TransactionStatusCompatProps>
const SafeTransactionStatusLabel = TransactionStatusLabel as unknown as ComponentType
const SafeTransactionStatusAction = TransactionStatusAction as unknown as ComponentType

export function PreparedDepositTransaction({
  prepared,
  onConfirmed,
}: {
  prepared: PreparedDeposit
  onConfirmed: (transactionHash: string) => Promise<void> | void
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const calls = prepared.calls.map((call) => ({
    to: call.to,
    data: call.data,
    value: BigInt(call.value),
  }))
  const isValidBatch =
    prepared.network === "base-sepolia" &&
    prepared.chainId === 84_532 &&
    prepared.calls.length === 2 &&
    prepared.calls[0]?.purpose === "approve_exact_usdc" &&
    prepared.calls[1]?.purpose === "fund_conditional_deposit"

  function handleStatus(next: LifecycleStatus) {
    if (
      next.statusName === "buildingTransaction" ||
      next.statusName === "transactionPending" ||
      next.statusName === "transactionLegacyExecuted"
    ) {
      setStatus("pending")
      setMessage("Confirming your refundable deposit...")
    } else if (next.statusName === "error") {
      setStatus("error")
      setMessage(next.statusData.message || "The deposit did not complete.")
    } else if (next.statusName === "success") {
      setStatus("success")
      setMessage("Deposit submitted. OpenRx is checking the confirmation.")
    }
  }

  async function handleSuccess(response: TransactionResponseCompat) {
    const hash = response.transactionReceipts[0]?.transactionHash
    if (hash) await onConfirmed(hash)
  }

  return (
    <div className="space-y-3">
      <Transaction
        chainId={prepared.chainId}
        calls={calls}
        isSponsored={Boolean(process.env.NEXT_PUBLIC_COMMITMENT_PAYMASTER_URL)}
        onStatus={handleStatus}
        onSuccess={(response) => void handleSuccess(response)}
      >
        <SafeTransactionButton
          disabled={!isValidBatch}
          text={`Place $${(prepared.amountMinor / 100).toFixed(2)} refundable deposit`}
          pendingOverride={{ text: "Confirm in wallet" }}
          successOverride={{ text: "Deposit submitted" }}
          className="control-button-primary w-full justify-center"
        />
        <SafeTransactionStatus className="rounded-[12px] border border-white/12 bg-white/6 px-3 py-2 text-xs text-white/72">
          <SafeTransactionStatusLabel />
          <SafeTransactionStatusAction />
        </SafeTransactionStatus>
      </Transaction>
      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className="flex items-center gap-2 text-xs text-white/68"
        >
          {status === "pending" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : status === "success" ? (
            <CheckCircle2 size={14} className="text-emerald-300" />
          ) : (
            <AlertCircle size={14} className="text-red-300" />
          )}
          {message}
        </p>
      ) : null}
    </div>
  )
}
