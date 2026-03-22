import {
  createPaymentIntent,
  getLedgerSnapshot,
  type PaymentRecord,
} from "@/lib/payments-ledger"

export const DEFAULT_SCREENING_FEE_USDC = "0.50"
export const SCREENING_PAYMENT_CATEGORY = "screening" as const

function toAmountNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value || "")
  return Number.isFinite(parsed) ? parsed : 0
}

export function getScreeningFeeUsd(): string {
  const configured = process.env.OPENRX_SCREENING_FEE_USDC || DEFAULT_SCREENING_FEE_USDC
  const parsed = Number.parseFloat(configured)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SCREENING_FEE_USDC
  return parsed.toFixed(2)
}

export function getScreeningRecipientWallet(): string {
  return (
    process.env.OPENRX_SCREENING_FEE_WALLET ||
    process.env.OPENRX_TREASURY_WALLET ||
    "0x09aeac8822F72AD49676c4DfA38519C98484730c"
  )
}

export async function createScreeningPaymentIntent(walletAddress: string): Promise<PaymentRecord> {
  const fee = getScreeningFeeUsd()
  return createPaymentIntent({
    walletAddress,
    amount: fee,
    category: SCREENING_PAYMENT_CATEGORY,
    description: "Personalized AI screening access",
    recipientAddress: getScreeningRecipientWallet(),
    metadata: {
      service: "personalized-screening",
      requiredFee: fee,
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

  const minimum = Number.parseFloat(fee)
  const settled = toAmountNumber(payment.settledAmount || payment.expectedAmount)
  if (settled < minimum) {
    return { ok: false, reason: `Screening payment must be at least ${fee} USDC.`, fee, recipientAddress }
  }

  return { ok: true, fee, recipientAddress, payment }
}
