import {
  createPaymentIntent,
  getLedgerSnapshot,
  type PaymentRecord,
} from "@/lib/payments-ledger"
import { toCents, fromCents, addAmounts } from "@/lib/money"

export const DEFAULT_SCREENING_FEE_USDC = "0.50"
export const SCREENING_PAYMENT_CATEGORY = "screening" as const
export const MAX_SCREENING_TIP_USDC = "25"

/** Tips are optional, capped, and never block access: invalid input is 0. */
export function normalizeTipAmount(raw?: string): string {
  if (!raw) return "0.00"
  const cents = toCents(raw)
  if (cents <= 0) return "0.00"
  return fromCents(Math.min(cents, toCents(MAX_SCREENING_TIP_USDC)))
}

export function getScreeningTotalWithTip(tipAmount?: string): string {
  return addAmounts(getScreeningFeeUsd(), normalizeTipAmount(tipAmount))
}

function toAmountNumber(value: string | undefined): number {
  const parsed = toCents(value || "0") / 100
  return Number.isFinite(parsed) ? parsed : 0
}

export function getScreeningFeeUsd(): string {
  const configured = process.env.OPENRX_SCREENING_FEE_USDC || DEFAULT_SCREENING_FEE_USDC
  const cents = toCents(configured)
  if (cents <= 0) return DEFAULT_SCREENING_FEE_USDC
  return fromCents(cents)
}

export function getScreeningRecipientWallet(): string {
  return (
    process.env.OPENRX_SCREENING_FEE_WALLET ||
    process.env.OPENRX_TREASURY_WALLET ||
    "0x09aeac8822F72AD49676c4DfA38519C98484730c"
  )
}

export async function createScreeningPaymentIntent(
  walletAddress: string,
  tipAmount?: string
): Promise<PaymentRecord> {
  const fee = getScreeningFeeUsd()
  const tip = normalizeTipAmount(tipAmount)
  const total = addAmounts(fee, tip)
  return createPaymentIntent({
    walletAddress,
    amount: total,
    category: SCREENING_PAYMENT_CATEGORY,
    description:
      tip !== "0.00"
        ? `Personalized AI screening access (+${tip} USDC tip)`
        : "Personalized AI screening access",
    recipientAddress: getScreeningRecipientWallet(),
    metadata: {
      service: "personalized-screening",
      requiredFee: fee,
      tipAmount: tip,
    },
  })
}

export async function verifyScreeningAccess(input: {
  walletAddress?: string
  paymentId?: string
}): Promise<{
  ok: boolean
  reason?: string
  payment?: PaymentRecord
  fee: string
  recipientAddress: string
}> {
  const fee = getScreeningFeeUsd()
  const recipientAddress = getScreeningRecipientWallet()
  const walletAddress = (input.walletAddress || "").toLowerCase().trim()
  const paymentId = (input.paymentId || "").trim()

  if (!walletAddress) {
    return { ok: false, reason: "Connect your wallet to unlock personalized screening.", fee, recipientAddress }
  }
  if (!paymentId) {
    return { ok: false, reason: "Screening payment is required before personalized recommendations.", fee, recipientAddress }
  }

  const snapshot = await getLedgerSnapshot({ walletAddress })
  const payment = snapshot.payments.find((item) => item.id === paymentId)
  if (!payment) {
    return { ok: false, reason: "Screening payment record not found for this wallet.", fee, recipientAddress }
  }
  if (payment.status !== "verified") {
    return { ok: false, reason: "Screening payment must be verified before recommendations are generated.", fee, recipientAddress }
  }
  if (payment.category !== SCREENING_PAYMENT_CATEGORY) {
    return { ok: false, reason: "Provided payment is not a screening access payment.", fee, recipientAddress }
  }
  if ((payment.recipientAddress || "").toLowerCase() !== recipientAddress.toLowerCase()) {
    return { ok: false, reason: "Screening payment recipient does not match the configured screening wallet.", fee, recipientAddress }
  }

  const minimum = toCents(fee) / 100
  const settled = toAmountNumber(payment.settledAmount || payment.expectedAmount)
  if (settled < minimum) {
    return { ok: false, reason: `Screening payment must be at least ${fee} USDC.`, fee, recipientAddress }
  }

  return { ok: true, fee, recipientAddress, payment }
}
