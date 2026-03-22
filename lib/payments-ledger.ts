import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getDatabaseHealth } from "@/lib/database-health"

const DEFAULT_TREASURY_WALLET = "0x09aeac8822F72AD49676c4DfA38519C98484730c"
const DEFAULT_CURRENCY = "USDC" as const
const FALLBACK_LEDGER_FILE = path.join("/tmp", "openrx-ledger.json")
let hasWarnedEphemeralLedgerFallback = false
let hasWarnedDatabaseFallback = false

export type PaymentCategory =
  | "copay"
  | "prescription"
  | "lab"
  | "screening"
  | "subscription"
  | "other"

export type PaymentStatus =
  | "initiated"
  | "pending_verification"
  | "verified"
  | "failed"
  | "refunded"

export type RefundStatus = "requested" | "approved" | "sent" | "failed"

export type LedgerDirection = "debit" | "credit" | "memo"

export type LedgerEventType =
  | "payment_intent_created"
  | "payment_verified"
  | "receipt_issued"
  | "attestation_recorded"
  | "refund_requested"
  | "refund_sent"
  | "refund_failed"
  | "treasury_transfer_initiated"
  | "treasury_transfer_confirmed"
  | "treasury_transfer_failed"

export interface PaymentRecord {
  id: string
  intentId: string
  walletAddress: string
  senderAddress?: string
  recipientAddress: string
  category: PaymentCategory
  description: string
  expectedAmount: string
  settledAmount?: string
  currency: typeof DEFAULT_CURRENCY
  txHash?: string
  status: PaymentStatus
  verificationMessage?: string
  metadata?: Record<string, unknown>
  createdAt: string
  verifiedAt?: string
  refundedAmount: string
}

export interface ReceiptLineItem {
  label: string
  amount: string
}

export interface ReceiptRecord {
  id: string
  receiptNumber: string
  paymentId?: string
  refundId?: string
  walletAddress: string
  kind: "payment" | "refund"
  amount: string
  currency: typeof DEFAULT_CURRENCY
  txHash?: string
  issuedAt: string
  lineItems: ReceiptLineItem[]
  complianceHash: string
  attestationId?: string
}

export interface AttestationRecord {
  id: string
  schema: string
  subjectType: "payment" | "receipt" | "refund" | "ledger"
  subjectId: string
  attestor: string
  payloadHash: string
  payload: Record<string, unknown>
  chainTxHash?: string
  createdAt: string
}

export interface RefundRecord {
  id: string
  paymentId: string
  walletAddress: string
  amount: string
  currency: typeof DEFAULT_CURRENCY
  reason: string
  status: RefundStatus
  requestedBy: string
  approvedBy?: string
  txHash?: string
  requestedAt: string
  processedAt?: string
  receiptId?: string
  attestationId?: string
}

export interface LedgerEntry {
  id: string
  eventType: LedgerEventType
  direction: LedgerDirection
  accountCode: string
  amount: string
  currency: string
  description: string
  paymentId?: string
  refundId?: string
  receiptId?: string
  reference?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface TreasuryActionRecord {
  id: string
  kind: "transfer" | "refund"
  asset: "ETH" | "USDC"
  amount: string
  chain: string
  tokenAddress?: string
  fromAddress: string
  toAddress: string
  initiatedBy: string
  reason: string
  status: "initiated" | "submitted" | "confirmed" | "failed"
  walletId?: string
  transactionHash?: string
  privyTransferId?: string
  metadata?: Record<string, unknown>
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

interface BasePayStatus {
  status: "completed" | "pending" | "failed" | "not_found"
  id: string
  message?: string
  sender?: string
  amount?: string
  recipient?: string
  error?: unknown
}

interface LedgerStore {
  payments: PaymentRecord[]
  receipts: ReceiptRecord[]
  attestations: AttestationRecord[]
  refunds: RefundRecord[]
  entries: LedgerEntry[]
  serial: number
}

interface LedgerSnapshot {
  payments: PaymentRecord[]
  receipts: ReceiptRecord[]
  refunds: RefundRecord[]
  attestations: AttestationRecord[]
  entries: LedgerEntry[]
  summary: {
    verifiedVolume: string
    refundedVolume: string
    netSettledVolume: string
    pendingVerificationCount: number
    openRefundCount: number
    receiptCount: number
    attestationCount: number
  }
}

export interface PaymentIntentInput {
  walletAddress: string
  amount: string
  category?: PaymentCategory
  description?: string
  recipientAddress?: string
  metadata?: Record<string, unknown>
}

export interface VerifyPaymentInput {
  paymentId?: string
  intentId?: string
  txHash: string
  walletAddress: string
  expectedAmount?: string
  expectedRecipient?: string
  testnet?: boolean
}

export interface RequestRefundInput {
  paymentId: string
  amount: string
  reason: string
  requestedBy: string
}

export interface FinalizeRefundInput {
  refundId: string
  status: "sent" | "failed"
  txHash?: string
  approvedBy: string
}

function resolveLedgerFile(): string {
  const configured = process.env.OPENRX_LEDGER_PATH?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    if (!hasWarnedEphemeralLedgerFallback) {
      hasWarnedEphemeralLedgerFallback = true
      console.warn(
        "OPENRX_LEDGER_PATH is not set in production. Falling back to /tmp/openrx-ledger.json (ephemeral storage). Set OPENRX_LEDGER_PATH for durable compliance records."
      )
    }
    return FALLBACK_LEDGER_FILE
  }
  return path.join(process.cwd(), ".openrx-ledger.json")
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeAddress(address?: string): string {
  return (address || "").trim().toLowerCase()
}

function toAmount(amount: string): string {
  const numeric = Number.parseFloat(amount)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Amount must be a positive decimal number.")
  }
  return numeric.toFixed(2)
}

function toAmountNumber(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

function toReceiptNumber(serial: number): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "")
  return `ORX-${day}-${String(serial).padStart(6, "0")}`
}

function parseReceiptSerial(receiptNumber?: string | null): number {
  if (!receiptNumber) return 0
  const last = receiptNumber.split("-").at(-1) || "0"
  const value = Number.parseInt(last, 10)
  return Number.isFinite(value) ? value : 0
}

function emptyStore(): LedgerStore {
  return {
    payments: [],
    receipts: [],
    attestations: [],
    refunds: [],
    entries: [],
    serial: 1,
  }
}

function getFileStore(): LedgerStore {
  const globalStore = globalThis as typeof globalThis & { __openrxLedgerStore?: LedgerStore }
  if (!globalStore.__openrxLedgerStore) {
    globalStore.__openrxLedgerStore = loadPersistedStore() || emptyStore()
  }
  return globalStore.__openrxLedgerStore
}

function loadPersistedStore(): LedgerStore | null {
  const ledgerFile = resolveLedgerFile()
  try {
    if (!fs.existsSync(ledgerFile)) return null
    const raw = fs.readFileSync(ledgerFile, "utf8")
    const parsed = JSON.parse(raw) as LedgerStore
    if (!parsed || typeof parsed !== "object") return null
    return {
      payments: parsed.payments || [],
      receipts: parsed.receipts || [],
      attestations: parsed.attestations || [],
      refunds: parsed.refunds || [],
      entries: parsed.entries || [],
      serial: parsed.serial || 1,
    }
  } catch (error) {
    throw new Error(
      `Unable to load compliance ledger at ${ledgerFile}: ${error instanceof Error ? error.message : "unknown error"}`
    )
  }
}

function persistStore(store: LedgerStore): void {
  const ledgerFile = resolveLedgerFile()
  const directory = path.dirname(ledgerFile)
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
  try {
    fs.writeFileSync(ledgerFile, JSON.stringify(store, null, 2), "utf8")
  } catch (error) {
    throw new Error(
      `Unable to persist compliance ledger at ${ledgerFile}: ${error instanceof Error ? error.message : "unknown error"}`
    )
  }
}

function appendLedgerEntry(store: LedgerStore, entry: Omit<LedgerEntry, "id" | "createdAt">): LedgerEntry {
  const next: LedgerEntry = {
    id: createId("led"),
    createdAt: new Date().toISOString(),
    ...entry,
  }
  store.entries.unshift(next)
  return next
}

function createAttestationInFileStore(params: {
  schema: string
  subjectType: AttestationRecord["subjectType"]
  subjectId: string
  attestor: string
  payload: Record<string, unknown>
  chainTxHash?: string
}): AttestationRecord {
  const store = getFileStore()
  const payloadHash = hashPayload(params.payload)
  const attestation: AttestationRecord = {
    id: createId("att"),
    schema: params.schema,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    attestor: params.attestor,
    payloadHash,
    payload: params.payload,
    chainTxHash: params.chainTxHash,
    createdAt: new Date().toISOString(),
  }
  store.attestations.unshift(attestation)

  appendLedgerEntry(store, {
    eventType: "attestation_recorded",
    direction: "memo",
    accountCode: "9990-COMPLIANCE",
    amount: "0.00",
    currency: DEFAULT_CURRENCY,
    description: `Attestation ${params.schema} created`,
    reference: attestation.id,
    metadata: {
      subjectType: attestation.subjectType,
      subjectId: attestation.subjectId,
      payloadHash: attestation.payloadHash,
    },
  })

  persistStore(store)
  return attestation
}

function createPaymentIntentInFileStore(input: PaymentIntentInput): PaymentRecord {
  const store = getFileStore()
  const expectedAmount = toAmount(input.amount)
  const walletAddress = normalizeAddress(input.walletAddress)
  const payment: PaymentRecord = {
    id: createId("pay"),
    intentId: createId("intent"),
    walletAddress,
    recipientAddress: input.recipientAddress || process.env.OPENRX_TREASURY_WALLET || DEFAULT_TREASURY_WALLET,
    category: input.category || "other",
    description: input.description || "OpenRx healthcare charge",
    expectedAmount,
    currency: DEFAULT_CURRENCY,
    status: "initiated",
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
    refundedAmount: "0.00",
  }
  store.payments.unshift(payment)

  appendLedgerEntry(store, {
    eventType: "payment_intent_created",
    direction: "memo",
    accountCode: "1200-PATIENT-AR",
    amount: payment.expectedAmount,
    currency: payment.currency,
    description: `Payment intent created for ${payment.category}`,
    paymentId: payment.id,
    reference: payment.intentId,
    metadata: {
      recipientAddress: payment.recipientAddress,
      walletAddress: payment.walletAddress,
    },
  })

  persistStore(store)
  return payment
}

async function resolveBasePaymentStatus(params: { txHash: string; testnet?: boolean }): Promise<BasePayStatus> {
  const { getPaymentStatus } = await import("@base-org/account")
  return (await getPaymentStatus({
    id: params.txHash.trim(),
    testnet: params.testnet ?? false,
  })) as BasePayStatus
}

function createReceiptForPaymentInFileStore(store: LedgerStore, payment: PaymentRecord): ReceiptRecord {
  const existing = store.receipts.find((receipt) => receipt.paymentId === payment.id && receipt.kind === "payment")
  if (existing) return existing

  const receiptPayload = {
    paymentId: payment.id,
    txHash: payment.txHash,
    amount: payment.settledAmount || payment.expectedAmount,
    walletAddress: payment.walletAddress,
    recipientAddress: payment.recipientAddress,
    verifiedAt: payment.verifiedAt,
  }

  const receipt: ReceiptRecord = {
    id: createId("rct"),
    receiptNumber: toReceiptNumber(store.serial++),
    paymentId: payment.id,
    walletAddress: payment.walletAddress,
    kind: "payment",
    amount: payment.settledAmount || payment.expectedAmount,
    currency: payment.currency,
    txHash: payment.txHash,
    issuedAt: new Date().toISOString(),
    lineItems: [{ label: payment.description, amount: payment.settledAmount || payment.expectedAmount }],
    complianceHash: hashPayload(receiptPayload),
  }
  store.receipts.unshift(receipt)

  appendLedgerEntry(store, {
    eventType: "receipt_issued",
    direction: "memo",
    accountCode: "9990-COMPLIANCE",
    amount: "0.00",
    currency: DEFAULT_CURRENCY,
    description: "Payment receipt issued",
    paymentId: payment.id,
    receiptId: receipt.id,
    reference: receipt.receiptNumber,
  })

  return receipt
}

function createReceiptForRefundInFileStore(store: LedgerStore, refund: RefundRecord): ReceiptRecord {
  const existing = store.receipts.find((receipt) => receipt.refundId === refund.id && receipt.kind === "refund")
  if (existing) return existing

  const receiptPayload = {
    refundId: refund.id,
    paymentId: refund.paymentId,
    txHash: refund.txHash,
    amount: refund.amount,
    walletAddress: refund.walletAddress,
    reason: refund.reason,
    processedAt: refund.processedAt,
  }

  const receipt: ReceiptRecord = {
    id: createId("rct"),
    receiptNumber: toReceiptNumber(store.serial++),
    paymentId: refund.paymentId,
    refundId: refund.id,
    walletAddress: refund.walletAddress,
    kind: "refund",
    amount: refund.amount,
    currency: refund.currency,
    txHash: refund.txHash,
    issuedAt: new Date().toISOString(),
    lineItems: [{ label: `Refund: ${refund.reason}`, amount: refund.amount }],
    complianceHash: hashPayload(receiptPayload),
  }
  store.receipts.unshift(receipt)

  appendLedgerEntry(store, {
    eventType: "receipt_issued",
    direction: "memo",
    accountCode: "9990-COMPLIANCE",
    amount: "0.00",
    currency: DEFAULT_CURRENCY,
    description: "Refund receipt issued",
    paymentId: refund.paymentId,
    refundId: refund.id,
    receiptId: receipt.id,
    reference: receipt.receiptNumber,
  })

  return receipt
}

async function verifyAndRecordPaymentInFileStore(input: VerifyPaymentInput): Promise<{
  payment: PaymentRecord
  receipt?: ReceiptRecord
  attestation?: AttestationRecord
  status: BasePayStatus["status"]
}> {
  const store = getFileStore()
  const walletAddress = normalizeAddress(input.walletAddress)

  let payment =
    (input.paymentId ? store.payments.find((candidate) => candidate.id === input.paymentId) : undefined) ||
    (input.intentId ? store.payments.find((candidate) => candidate.intentId === input.intentId) : undefined)

  if (!payment) {
    payment = createPaymentIntentInFileStore({
      walletAddress,
      amount: input.expectedAmount || "0.01",
      description: "Ad-hoc verification",
      category: "other",
      recipientAddress: input.expectedRecipient,
    })
  }

  if (payment.status === "verified" && payment.txHash === input.txHash) {
    const existingReceipt = store.receipts.find((receipt) => receipt.paymentId === payment!.id)
    const existingAttestation = store.attestations.find(
      (attestation) => attestation.subjectType === "payment" && attestation.subjectId === payment!.id
    )
    return {
      payment,
      receipt: existingReceipt,
      attestation: existingAttestation,
      status: "completed",
    }
  }

  const status = await resolveBasePaymentStatus({
    txHash: input.txHash,
    testnet: input.testnet,
  })

  payment.txHash = input.txHash
  payment.status = status.status === "completed" ? "verified" : status.status === "failed" ? "failed" : "pending_verification"
  payment.verificationMessage = status.message
  payment.senderAddress = status.sender

  if (status.status !== "completed") {
    persistStore(store)
    return { payment, status: status.status }
  }

  const settledAmount = toAmount(status.amount || payment.expectedAmount)
  const expectedAmount = toAmount(input.expectedAmount || payment.expectedAmount)
  const expectedRecipient = normalizeAddress(input.expectedRecipient || payment.recipientAddress)
  const actualRecipient = normalizeAddress(status.recipient)
  const senderAddress = normalizeAddress(status.sender)

  if (settledAmount !== expectedAmount) {
    payment.status = "failed"
    payment.verificationMessage = "Amount mismatch detected during verification."
    persistStore(store)
    return { payment, status: "failed" }
  }
  if (actualRecipient !== expectedRecipient) {
    payment.status = "failed"
    payment.verificationMessage = "Recipient mismatch detected during verification."
    persistStore(store)
    return { payment, status: "failed" }
  }
  if (senderAddress && senderAddress !== normalizeAddress(walletAddress)) {
    payment.status = "failed"
    payment.verificationMessage = "Sender mismatch detected during verification."
    persistStore(store)
    return { payment, status: "failed" }
  }

  payment.status = "verified"
  payment.settledAmount = settledAmount
  payment.verifiedAt = new Date().toISOString()
  payment.walletAddress = walletAddress

  const alreadyBooked = store.entries.some(
    (entry) => entry.eventType === "payment_verified" && entry.reference === payment!.txHash && entry.paymentId === payment!.id
  )

  if (!alreadyBooked) {
    appendLedgerEntry(store, {
      eventType: "payment_verified",
      direction: "debit",
      accountCode: "1010-CASH-USDC",
      amount: settledAmount,
      currency: DEFAULT_CURRENCY,
      description: `USDC settled for ${payment.category}`,
      paymentId: payment.id,
      reference: payment.txHash,
    })
    appendLedgerEntry(store, {
      eventType: "payment_verified",
      direction: "credit",
      accountCode: "1200-PATIENT-AR",
      amount: settledAmount,
      currency: DEFAULT_CURRENCY,
      description: `Receivable cleared for ${payment.category}`,
      paymentId: payment.id,
      reference: payment.txHash,
    })
  }

  const receipt = createReceiptForPaymentInFileStore(store, payment)
  const attestation = createAttestationInFileStore({
    schema: "openrx.payment.verification.v1",
    subjectType: "payment",
    subjectId: payment.id,
    attestor: "openrx-verifier",
    payload: {
      paymentId: payment.id,
      txHash: payment.txHash,
      senderAddress: payment.senderAddress,
      recipientAddress: payment.recipientAddress,
      amount: payment.settledAmount,
      walletAddress: payment.walletAddress,
      verifiedAt: payment.verifiedAt,
    },
  })
  receipt.attestationId = attestation.id
  persistStore(store)

  return { payment, receipt, attestation, status: "completed" }
}

function requestRefundInFileStore(input: RequestRefundInput): RefundRecord {
  const store = getFileStore()
  const payment = store.payments.find((candidate) => candidate.id === input.paymentId)
  if (!payment) throw new Error("Payment not found.")
  if (payment.status !== "verified" && payment.status !== "refunded") {
    throw new Error("Only verified payments can be refunded.")
  }

  const amount = toAmount(input.amount)
  const settled = Number.parseFloat(payment.settledAmount || payment.expectedAmount)
  const refunded = Number.parseFloat(payment.refundedAmount)
  const requested = Number.parseFloat(amount)

  if (requested + refunded > settled) {
    throw new Error("Refund exceeds remaining settled amount.")
  }

  const refund: RefundRecord = {
    id: createId("ref"),
    paymentId: payment.id,
    walletAddress: payment.walletAddress,
    amount,
    currency: DEFAULT_CURRENCY,
    reason: input.reason,
    status: "requested",
    requestedBy: input.requestedBy,
    requestedAt: new Date().toISOString(),
  }
  store.refunds.unshift(refund)

  appendLedgerEntry(store, {
    eventType: "refund_requested",
    direction: "memo",
    accountCode: "2410-REFUND-LIABILITY",
    amount,
    currency: DEFAULT_CURRENCY,
    description: "Refund requested by user or agent",
    paymentId: payment.id,
    refundId: refund.id,
    reference: refund.id,
  })

  persistStore(store)
  return refund
}

function updateRefundApprovalInFileStore(refundId: string, approvedBy: string): RefundRecord {
  const store = getFileStore()
  const refund = store.refunds.find((candidate) => candidate.id === refundId)
  if (!refund) throw new Error("Refund not found.")
  if (refund.status !== "requested") throw new Error("Refund is not in requested state.")
  refund.status = "approved"
  refund.approvedBy = approvedBy
  persistStore(store)
  return refund
}

function finalizeRefundInFileStore(input: FinalizeRefundInput): {
  refund: RefundRecord
  payment: PaymentRecord
  receipt?: ReceiptRecord
  attestation?: AttestationRecord
} {
  const store = getFileStore()
  const refund = store.refunds.find((candidate) => candidate.id === input.refundId)
  if (!refund) throw new Error("Refund not found.")

  const payment = store.payments.find((candidate) => candidate.id === refund.paymentId)
  if (!payment) throw new Error("Original payment not found.")

  refund.approvedBy = input.approvedBy
  refund.txHash = input.txHash
  refund.status = input.status
  refund.processedAt = new Date().toISOString()

  if (refund.status === "failed") {
    appendLedgerEntry(store, {
      eventType: "refund_failed",
      direction: "memo",
      accountCode: "2410-REFUND-LIABILITY",
      amount: refund.amount,
      currency: DEFAULT_CURRENCY,
      description: "Refund failed",
      paymentId: payment.id,
      refundId: refund.id,
      reference: refund.txHash || refund.id,
    })
    persistStore(store)
    return { refund, payment }
  }

  appendLedgerEntry(store, {
    eventType: "refund_sent",
    direction: "debit",
    accountCode: "5100-REFUNDS",
    amount: refund.amount,
    currency: DEFAULT_CURRENCY,
    description: "Refund issued to patient wallet",
    paymentId: payment.id,
    refundId: refund.id,
    reference: refund.txHash || refund.id,
  })
  appendLedgerEntry(store, {
    eventType: "refund_sent",
    direction: "credit",
    accountCode: "1010-CASH-USDC",
    amount: refund.amount,
    currency: DEFAULT_CURRENCY,
    description: "USDC outflow for refund",
    paymentId: payment.id,
    refundId: refund.id,
    reference: refund.txHash || refund.id,
  })

  const refundedTotal = (Number.parseFloat(payment.refundedAmount) + Number.parseFloat(refund.amount)).toFixed(2)
  payment.refundedAmount = refundedTotal
  if (Number.parseFloat(refundedTotal) >= Number.parseFloat(payment.settledAmount || payment.expectedAmount)) {
    payment.status = "refunded"
  }

  const receipt = createReceiptForRefundInFileStore(store, refund)
  const attestation = createAttestationInFileStore({
    schema: "openrx.refund.settlement.v1",
    subjectType: "refund",
    subjectId: refund.id,
    attestor: "openrx-refund-engine",
    payload: {
      refundId: refund.id,
      paymentId: payment.id,
      amount: refund.amount,
      walletAddress: refund.walletAddress,
      txHash: refund.txHash,
      processedAt: refund.processedAt,
      approvedBy: refund.approvedBy,
    },
    chainTxHash: refund.txHash,
  })
  receipt.attestationId = attestation.id
  refund.receiptId = receipt.id
  refund.attestationId = attestation.id
  persistStore(store)

  return { refund, payment, receipt, attestation }
}

function buildSnapshot(params: { store: LedgerStore; walletAddress?: string }): LedgerSnapshot {
  const walletAddress = params.walletAddress ? normalizeAddress(params.walletAddress) : undefined
  const { store } = params

  const payments = walletAddress
    ? store.payments.filter((payment) => normalizeAddress(payment.walletAddress) === walletAddress)
    : [...store.payments]

  const paymentIds = new Set(payments.map((payment) => payment.id))
  const refunds = walletAddress
    ? store.refunds.filter((refund) => normalizeAddress(refund.walletAddress) === walletAddress)
    : [...store.refunds]
  const refundIds = new Set(refunds.map((refund) => refund.id))
  const receipts = walletAddress
    ? store.receipts.filter(
        (receipt) =>
          normalizeAddress(receipt.walletAddress) === walletAddress ||
          (!!receipt.paymentId && paymentIds.has(receipt.paymentId)) ||
          (!!receipt.refundId && refundIds.has(receipt.refundId))
      )
    : [...store.receipts]

  const receiptIds = new Set(receipts.map((receipt) => receipt.id))
  const attestations = walletAddress
    ? store.attestations.filter((attestation) => {
        if (attestation.subjectType === "payment") return paymentIds.has(attestation.subjectId)
        if (attestation.subjectType === "refund") return refundIds.has(attestation.subjectId)
        if (attestation.subjectType === "receipt") return receiptIds.has(attestation.subjectId)
        return false
      })
    : [...store.attestations]

  const entries = walletAddress
    ? store.entries.filter(
        (entry) =>
          (!!entry.paymentId && paymentIds.has(entry.paymentId)) ||
          (!!entry.refundId && refundIds.has(entry.refundId)) ||
          (!!entry.receiptId && receiptIds.has(entry.receiptId))
      )
    : [...store.entries]

  const verifiedVolume = payments
    .filter((payment) => payment.status === "verified" || payment.status === "refunded")
    .reduce((sum, payment) => sum + toAmountNumber(payment.settledAmount || payment.expectedAmount), 0)
  const refundedVolume = refunds
    .filter((refund) => refund.status === "sent")
    .reduce((sum, refund) => sum + toAmountNumber(refund.amount), 0)

  return {
    payments,
    receipts,
    refunds,
    attestations,
    entries,
    summary: {
      verifiedVolume: verifiedVolume.toFixed(2),
      refundedVolume: refundedVolume.toFixed(2),
      netSettledVolume: (verifiedVolume - refundedVolume).toFixed(2),
      pendingVerificationCount: payments.filter((payment) => payment.status === "pending_verification").length,
      openRefundCount: refunds.filter((refund) => refund.status === "requested" || refund.status === "approved").length,
      receiptCount: receipts.length,
      attestationCount: attestations.length,
    },
  }
}

function getLedgerSnapshotFromFileStore(params?: { walletAddress?: string }): LedgerSnapshot {
  return buildSnapshot({ store: getFileStore(), walletAddress: params?.walletAddress })
}

function mapPaymentRow(row: {
  id: string
  intentId: string
  walletAddress: string
  senderAddress: string | null
  recipientAddress: string
  category: string
  description: string
  expectedAmount: string
  settledAmount: string | null
  currency: string
  txHash: string | null
  status: string
  verificationMessage: string | null
  metadata: unknown
  createdAt: Date
  verifiedAt: Date | null
  refundedAmount: string
}): PaymentRecord {
  return {
    id: row.id,
    intentId: row.intentId,
    walletAddress: row.walletAddress,
    senderAddress: row.senderAddress || undefined,
    recipientAddress: row.recipientAddress,
    category: row.category as PaymentCategory,
    description: row.description,
    expectedAmount: row.expectedAmount,
    settledAmount: row.settledAmount || undefined,
    currency: DEFAULT_CURRENCY,
    txHash: row.txHash || undefined,
    status: row.status as PaymentStatus,
    verificationMessage: row.verificationMessage || undefined,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
    createdAt: row.createdAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString(),
    refundedAmount: row.refundedAmount,
  }
}

function mapReceiptRow(row: {
  id: string
  receiptNumber: string
  paymentId: string | null
  refundId: string | null
  walletAddress: string
  kind: string
  amount: string
  currency: string
  txHash: string | null
  issuedAt: Date
  lineItems: unknown
  complianceHash: string
  attestationId: string | null
}): ReceiptRecord {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    paymentId: row.paymentId || undefined,
    refundId: row.refundId || undefined,
    walletAddress: row.walletAddress,
    kind: row.kind as ReceiptRecord["kind"],
    amount: row.amount,
    currency: DEFAULT_CURRENCY,
    txHash: row.txHash || undefined,
    issuedAt: row.issuedAt.toISOString(),
    lineItems: Array.isArray(row.lineItems) ? (row.lineItems as ReceiptLineItem[]) : [],
    complianceHash: row.complianceHash,
    attestationId: row.attestationId || undefined,
  }
}

function mapAttestationRow(row: {
  id: string
  schema: string
  subjectType: string
  subjectId: string
  attestor: string
  payloadHash: string
  payload: unknown
  chainTxHash: string | null
  createdAt: Date
}): AttestationRecord {
  return {
    id: row.id,
    schema: row.schema,
    subjectType: row.subjectType as AttestationRecord["subjectType"],
    subjectId: row.subjectId,
    attestor: row.attestor,
    payloadHash: row.payloadHash,
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    chainTxHash: row.chainTxHash || undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapRefundRow(row: {
  id: string
  paymentId: string
  walletAddress: string
  amount: string
  currency: string
  reason: string
  status: string
  requestedBy: string
  approvedBy: string | null
  txHash: string | null
  requestedAt: Date
  processedAt: Date | null
  receiptId: string | null
  attestationId: string | null
}): RefundRecord {
  return {
    id: row.id,
    paymentId: row.paymentId,
    walletAddress: row.walletAddress,
    amount: row.amount,
    currency: DEFAULT_CURRENCY,
    reason: row.reason,
    status: row.status as RefundStatus,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy || undefined,
    txHash: row.txHash || undefined,
    requestedAt: row.requestedAt.toISOString(),
    processedAt: row.processedAt?.toISOString(),
    receiptId: row.receiptId || undefined,
    attestationId: row.attestationId || undefined,
  }
}

function mapEntryRow(row: {
  id: string
  eventType: string
  direction: string
  accountCode: string
  amount: string
  currency: string
  description: string
  paymentId: string | null
  refundId: string | null
  receiptId: string | null
  reference: string | null
  metadata: unknown
  createdAt: Date
}): LedgerEntry {
  return {
    id: row.id,
    eventType: row.eventType as LedgerEventType,
    direction: row.direction as LedgerDirection,
    accountCode: row.accountCode,
    amount: row.amount,
    currency: DEFAULT_CURRENCY,
    description: row.description,
    paymentId: row.paymentId || undefined,
    refundId: row.refundId || undefined,
    receiptId: row.receiptId || undefined,
    reference: row.reference || undefined,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

function isMissingLedgerTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  return message.includes("ledger_") || message.includes("treasury_actions") || message.includes("does not exist")
}

async function shouldUseDatabaseLedger(): Promise<boolean> {
  const databaseHealth = await getDatabaseHealth()
  return databaseHealth.reachable
}

function warnLedgerFallback(error: unknown): void {
  if (hasWarnedDatabaseFallback) return
  hasWarnedDatabaseFallback = true
  console.warn(
    `Falling back to file-backed payments ledger. ${error instanceof Error ? error.message : "Database ledger unavailable."}`
  )
}

async function getLedgerSnapshotFromDatabase(params?: { walletAddress?: string }): Promise<LedgerSnapshot> {
  const walletAddress = params?.walletAddress ? normalizeAddress(params.walletAddress) : undefined
  const [paymentRows, receiptRows, refundRows, attestationRows, entryRows] = await Promise.all([
    prisma.ledgerPaymentRecord.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.ledgerReceiptRecord.findMany({ orderBy: { issuedAt: "desc" } }),
    prisma.ledgerRefundRecord.findMany({ orderBy: { requestedAt: "desc" } }),
    prisma.ledgerAttestationRecord.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.ledgerEntryRecord.findMany({ orderBy: { createdAt: "desc" } }),
  ])

  const store: LedgerStore = {
    payments: paymentRows.map(mapPaymentRow),
    receipts: receiptRows.map(mapReceiptRow),
    refunds: refundRows.map(mapRefundRow),
    attestations: attestationRows.map(mapAttestationRow),
    entries: entryRows.map(mapEntryRow),
    serial: Math.max(1, ...receiptRows.map((row) => parseReceiptSerial(row.receiptNumber))) + 1,
  }

  return buildSnapshot({ store, walletAddress })
}

async function nextReceiptSerialInDatabase(tx: typeof prisma): Promise<number> {
  const latest = await tx.ledgerReceiptRecord.findFirst({ orderBy: { issuedAt: "desc" }, select: { receiptNumber: true } })
  return parseReceiptSerial(latest?.receiptNumber) + 1 || 1
}

async function createAttestationInDatabase(params: {
  schema: string
  subjectType: AttestationRecord["subjectType"]
  subjectId: string
  attestor: string
  payload: Record<string, unknown>
  chainTxHash?: string
}): Promise<AttestationRecord> {
  const payloadHash = hashPayload(params.payload)
  const attestation: AttestationRecord = {
    id: createId("att"),
    schema: params.schema,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    attestor: params.attestor,
    payloadHash,
    payload: params.payload,
    chainTxHash: params.chainTxHash,
    createdAt: new Date().toISOString(),
  }

  await prisma.$transaction([
    prisma.ledgerAttestationRecord.create({
      data: {
        id: attestation.id,
        schema: attestation.schema,
        subjectType: attestation.subjectType,
        subjectId: attestation.subjectId,
        attestor: attestation.attestor,
        payloadHash: attestation.payloadHash,
        payload: attestation.payload as Prisma.InputJsonValue,
        chainTxHash: attestation.chainTxHash,
        createdAt: new Date(attestation.createdAt),
      },
    }),
    prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "attestation_recorded",
        direction: "memo",
        accountCode: "9990-COMPLIANCE",
        amount: "0.00",
        currency: DEFAULT_CURRENCY,
        description: `Attestation ${params.schema} created`,
        reference: attestation.id,
        metadata: {
          subjectType: attestation.subjectType,
          subjectId: attestation.subjectId,
          payloadHash: attestation.payloadHash,
        } as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    }),
  ])

  return attestation
}

async function createPaymentIntentInDatabase(input: PaymentIntentInput): Promise<PaymentRecord> {
  const payment: PaymentRecord = {
    id: createId("pay"),
    intentId: createId("intent"),
    walletAddress: normalizeAddress(input.walletAddress),
    recipientAddress: input.recipientAddress || process.env.OPENRX_TREASURY_WALLET || DEFAULT_TREASURY_WALLET,
    category: input.category || "other",
    description: input.description || "OpenRx healthcare charge",
    expectedAmount: toAmount(input.amount),
    currency: DEFAULT_CURRENCY,
    status: "initiated",
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
    refundedAmount: "0.00",
  }

  await prisma.$transaction([
    prisma.ledgerPaymentRecord.create({
      data: {
        id: payment.id,
        intentId: payment.intentId,
        walletAddress: payment.walletAddress,
        recipientAddress: payment.recipientAddress,
        category: payment.category,
        description: payment.description,
        expectedAmount: payment.expectedAmount,
        currency: payment.currency,
        status: payment.status,
        metadata: payment.metadata as Prisma.InputJsonValue | undefined,
        createdAt: new Date(payment.createdAt),
        refundedAmount: payment.refundedAmount,
      },
    }),
    prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "payment_intent_created",
        direction: "memo",
        accountCode: "1200-PATIENT-AR",
        amount: payment.expectedAmount,
        currency: DEFAULT_CURRENCY,
        description: `Payment intent created for ${payment.category}`,
        paymentId: payment.id,
        reference: payment.intentId,
        metadata: {
          recipientAddress: payment.recipientAddress,
          walletAddress: payment.walletAddress,
        } as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    }),
  ])

  return payment
}

async function createPaymentReceiptInDatabase(payment: PaymentRecord): Promise<ReceiptRecord> {
  const existing = await prisma.ledgerReceiptRecord.findFirst({
    where: { paymentId: payment.id, kind: "payment" },
  })
  if (existing) return mapReceiptRow(existing)

  const serial = await nextReceiptSerialInDatabase(prisma)
  const receipt: ReceiptRecord = {
    id: createId("rct"),
    receiptNumber: toReceiptNumber(serial),
    paymentId: payment.id,
    walletAddress: payment.walletAddress,
    kind: "payment",
    amount: payment.settledAmount || payment.expectedAmount,
    currency: DEFAULT_CURRENCY,
    txHash: payment.txHash,
    issuedAt: new Date().toISOString(),
    lineItems: [{ label: payment.description, amount: payment.settledAmount || payment.expectedAmount }],
    complianceHash: hashPayload({
      paymentId: payment.id,
      txHash: payment.txHash,
      amount: payment.settledAmount || payment.expectedAmount,
      walletAddress: payment.walletAddress,
      recipientAddress: payment.recipientAddress,
      verifiedAt: payment.verifiedAt,
    }),
  }

  await prisma.$transaction([
    prisma.ledgerReceiptRecord.create({
      data: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        walletAddress: receipt.walletAddress,
        kind: receipt.kind,
        amount: receipt.amount,
        currency: receipt.currency,
        txHash: receipt.txHash,
        issuedAt: new Date(receipt.issuedAt),
        lineItems: receipt.lineItems as unknown as Prisma.InputJsonValue,
        complianceHash: receipt.complianceHash,
      },
    }),
    prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "receipt_issued",
        direction: "memo",
        accountCode: "9990-COMPLIANCE",
        amount: "0.00",
        currency: DEFAULT_CURRENCY,
        description: "Payment receipt issued",
        paymentId: payment.id,
        receiptId: receipt.id,
        reference: receipt.receiptNumber,
        createdAt: new Date(),
      },
    }),
  ])

  return receipt
}

async function createRefundReceiptInDatabase(refund: RefundRecord): Promise<ReceiptRecord> {
  const existing = await prisma.ledgerReceiptRecord.findFirst({
    where: { refundId: refund.id, kind: "refund" },
  })
  if (existing) return mapReceiptRow(existing)

  const serial = await nextReceiptSerialInDatabase(prisma)
  const receipt: ReceiptRecord = {
    id: createId("rct"),
    receiptNumber: toReceiptNumber(serial),
    paymentId: refund.paymentId,
    refundId: refund.id,
    walletAddress: refund.walletAddress,
    kind: "refund",
    amount: refund.amount,
    currency: DEFAULT_CURRENCY,
    txHash: refund.txHash,
    issuedAt: new Date().toISOString(),
    lineItems: [{ label: `Refund: ${refund.reason}`, amount: refund.amount }],
    complianceHash: hashPayload({
      refundId: refund.id,
      paymentId: refund.paymentId,
      txHash: refund.txHash,
      amount: refund.amount,
      walletAddress: refund.walletAddress,
      reason: refund.reason,
      processedAt: refund.processedAt,
    }),
  }

  await prisma.$transaction([
    prisma.ledgerReceiptRecord.create({
      data: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        refundId: receipt.refundId,
        walletAddress: receipt.walletAddress,
        kind: receipt.kind,
        amount: receipt.amount,
        currency: receipt.currency,
        txHash: receipt.txHash,
        issuedAt: new Date(receipt.issuedAt),
        lineItems: receipt.lineItems as unknown as Prisma.InputJsonValue,
        complianceHash: receipt.complianceHash,
      },
    }),
    prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "receipt_issued",
        direction: "memo",
        accountCode: "9990-COMPLIANCE",
        amount: "0.00",
        currency: DEFAULT_CURRENCY,
        description: "Refund receipt issued",
        paymentId: refund.paymentId,
        refundId: refund.id,
        receiptId: receipt.id,
        reference: receipt.receiptNumber,
        createdAt: new Date(),
      },
    }),
  ])

  return receipt
}

async function verifyAndRecordPaymentInDatabase(input: VerifyPaymentInput): Promise<{
  payment: PaymentRecord
  receipt?: ReceiptRecord
  attestation?: AttestationRecord
  status: BasePayStatus["status"]
}> {
  const walletAddress = normalizeAddress(input.walletAddress)

  let paymentRow =
    (input.paymentId
      ? await prisma.ledgerPaymentRecord.findUnique({ where: { id: input.paymentId } })
      : null) ||
    (input.intentId
      ? await prisma.ledgerPaymentRecord.findUnique({ where: { intentId: input.intentId } })
      : null)

  if (!paymentRow) {
    const created = await createPaymentIntentInDatabase({
      walletAddress,
      amount: input.expectedAmount || "0.01",
      description: "Ad-hoc verification",
      category: "other",
      recipientAddress: input.expectedRecipient,
    })
    paymentRow = await prisma.ledgerPaymentRecord.findUniqueOrThrow({ where: { id: created.id } })
  }

  let payment = mapPaymentRow(paymentRow)
  if (payment.status === "verified" && payment.txHash === input.txHash) {
    const [existingReceipt, existingAttestation] = await Promise.all([
      prisma.ledgerReceiptRecord.findFirst({ where: { paymentId: payment.id, kind: "payment" } }),
      prisma.ledgerAttestationRecord.findFirst({ where: { subjectType: "payment", subjectId: payment.id } }),
    ])
    return {
      payment,
      receipt: existingReceipt ? mapReceiptRow(existingReceipt) : undefined,
      attestation: existingAttestation ? mapAttestationRow(existingAttestation) : undefined,
      status: "completed",
    }
  }

  const status = await resolveBasePaymentStatus({ txHash: input.txHash, testnet: input.testnet })

  const partialStatus: PaymentStatus =
    status.status === "completed" ? "verified" : status.status === "failed" ? "failed" : "pending_verification"

  payment = mapPaymentRow(
    await prisma.ledgerPaymentRecord.update({
      where: { id: payment.id },
      data: {
        txHash: input.txHash,
        status: partialStatus,
        verificationMessage: status.message,
        senderAddress: status.sender,
      },
    })
  )

  if (status.status !== "completed") {
    return { payment, status: status.status }
  }

  const settledAmount = toAmount(status.amount || payment.expectedAmount)
  const expectedAmount = toAmount(input.expectedAmount || payment.expectedAmount)
  const expectedRecipient = normalizeAddress(input.expectedRecipient || payment.recipientAddress)
  const actualRecipient = normalizeAddress(status.recipient)
  const senderAddress = normalizeAddress(status.sender)

  if (settledAmount !== expectedAmount) {
    payment = mapPaymentRow(
      await prisma.ledgerPaymentRecord.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          verificationMessage: "Amount mismatch detected during verification.",
        },
      })
    )
    return { payment, status: "failed" }
  }

  if (actualRecipient !== expectedRecipient) {
    payment = mapPaymentRow(
      await prisma.ledgerPaymentRecord.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          verificationMessage: "Recipient mismatch detected during verification.",
        },
      })
    )
    return { payment, status: "failed" }
  }

  if (senderAddress && senderAddress !== walletAddress) {
    payment = mapPaymentRow(
      await prisma.ledgerPaymentRecord.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          verificationMessage: "Sender mismatch detected during verification.",
        },
      })
    )
    return { payment, status: "failed" }
  }

  payment = mapPaymentRow(
    await prisma.ledgerPaymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "verified",
        settledAmount,
        verifiedAt: new Date(),
        walletAddress,
      },
    })
  )

  const alreadyBooked = await prisma.ledgerEntryRecord.count({
    where: {
      eventType: "payment_verified",
      reference: payment.txHash,
      paymentId: payment.id,
    },
  })

  if (alreadyBooked === 0) {
    await prisma.$transaction([
      prisma.ledgerEntryRecord.create({
        data: {
          id: createId("led"),
          eventType: "payment_verified",
          direction: "debit",
          accountCode: "1010-CASH-USDC",
          amount: settledAmount,
          currency: DEFAULT_CURRENCY,
          description: `USDC settled for ${payment.category}`,
          paymentId: payment.id,
          reference: payment.txHash,
          createdAt: new Date(),
        },
      }),
      prisma.ledgerEntryRecord.create({
        data: {
          id: createId("led"),
          eventType: "payment_verified",
          direction: "credit",
          accountCode: "1200-PATIENT-AR",
          amount: settledAmount,
          currency: DEFAULT_CURRENCY,
          description: `Receivable cleared for ${payment.category}`,
          paymentId: payment.id,
          reference: payment.txHash,
          createdAt: new Date(),
        },
      }),
    ])
  }

  const receipt = await createPaymentReceiptInDatabase(payment)
  const attestation = await createAttestationInDatabase({
    schema: "openrx.payment.verification.v1",
    subjectType: "payment",
    subjectId: payment.id,
    attestor: "openrx-verifier",
    payload: {
      paymentId: payment.id,
      txHash: payment.txHash,
      senderAddress: payment.senderAddress,
      recipientAddress: payment.recipientAddress,
      amount: payment.settledAmount,
      walletAddress: payment.walletAddress,
      verifiedAt: payment.verifiedAt,
    },
  })

  await prisma.ledgerReceiptRecord.update({
    where: { id: receipt.id },
    data: { attestationId: attestation.id },
  })

  return {
    payment,
    receipt: { ...receipt, attestationId: attestation.id },
    attestation,
    status: "completed",
  }
}

async function requestRefundInDatabase(input: RequestRefundInput): Promise<RefundRecord> {
  const paymentRow = await prisma.ledgerPaymentRecord.findUnique({ where: { id: input.paymentId } })
  if (!paymentRow) throw new Error("Payment not found.")
  const payment = mapPaymentRow(paymentRow)
  if (payment.status !== "verified" && payment.status !== "refunded") {
    throw new Error("Only verified payments can be refunded.")
  }

  const amount = toAmount(input.amount)
  const settled = Number.parseFloat(payment.settledAmount || payment.expectedAmount)
  const refunded = Number.parseFloat(payment.refundedAmount)
  const requested = Number.parseFloat(amount)
  if (requested + refunded > settled) {
    throw new Error("Refund exceeds remaining settled amount.")
  }

  const refund: RefundRecord = {
    id: createId("ref"),
    paymentId: payment.id,
    walletAddress: payment.walletAddress,
    amount,
    currency: DEFAULT_CURRENCY,
    reason: input.reason,
    status: "requested",
    requestedBy: input.requestedBy,
    requestedAt: new Date().toISOString(),
  }

  await prisma.$transaction([
    prisma.ledgerRefundRecord.create({
      data: {
        id: refund.id,
        paymentId: refund.paymentId,
        walletAddress: refund.walletAddress,
        amount: refund.amount,
        currency: refund.currency,
        reason: refund.reason,
        status: refund.status,
        requestedBy: refund.requestedBy,
        requestedAt: new Date(refund.requestedAt),
      },
    }),
    prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "refund_requested",
        direction: "memo",
        accountCode: "2410-REFUND-LIABILITY",
        amount: refund.amount,
        currency: DEFAULT_CURRENCY,
        description: "Refund requested by user or agent",
        paymentId: payment.id,
        refundId: refund.id,
        reference: refund.id,
        createdAt: new Date(),
      },
    }),
  ])

  return refund
}

async function updateRefundApprovalInDatabase(refundId: string, approvedBy: string): Promise<RefundRecord> {
  const refund = await prisma.ledgerRefundRecord.findUnique({ where: { id: refundId } })
  if (!refund) throw new Error("Refund not found.")
  if (refund.status !== "requested") throw new Error("Refund is not in requested state.")
  return mapRefundRow(
    await prisma.ledgerRefundRecord.update({
      where: { id: refundId },
      data: {
        status: "approved",
        approvedBy,
      },
    })
  )
}

async function finalizeRefundInDatabase(input: FinalizeRefundInput): Promise<{
  refund: RefundRecord
  payment: PaymentRecord
  receipt?: ReceiptRecord
  attestation?: AttestationRecord
}> {
  const refundRow = await prisma.ledgerRefundRecord.findUnique({ where: { id: input.refundId } })
  if (!refundRow) throw new Error("Refund not found.")
  const paymentRow = await prisma.ledgerPaymentRecord.findUnique({ where: { id: refundRow.paymentId } })
  if (!paymentRow) throw new Error("Original payment not found.")

  let refund = mapRefundRow(
    await prisma.ledgerRefundRecord.update({
      where: { id: input.refundId },
      data: {
        approvedBy: input.approvedBy,
        txHash: input.txHash,
        status: input.status,
        processedAt: new Date(),
      },
    })
  )
  let payment = mapPaymentRow(paymentRow)

  if (refund.status === "failed") {
    await prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "refund_failed",
        direction: "memo",
        accountCode: "2410-REFUND-LIABILITY",
        amount: refund.amount,
        currency: DEFAULT_CURRENCY,
        description: "Refund failed",
        paymentId: payment.id,
        refundId: refund.id,
        reference: refund.txHash || refund.id,
        createdAt: new Date(),
      },
    })
    return { refund, payment }
  }

  await prisma.$transaction([
    prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "refund_sent",
        direction: "debit",
        accountCode: "5100-REFUNDS",
        amount: refund.amount,
        currency: DEFAULT_CURRENCY,
        description: "Refund issued to patient wallet",
        paymentId: payment.id,
        refundId: refund.id,
        reference: refund.txHash || refund.id,
        createdAt: new Date(),
      },
    }),
    prisma.ledgerEntryRecord.create({
      data: {
        id: createId("led"),
        eventType: "refund_sent",
        direction: "credit",
        accountCode: "1010-CASH-USDC",
        amount: refund.amount,
        currency: DEFAULT_CURRENCY,
        description: "USDC outflow for refund",
        paymentId: payment.id,
        refundId: refund.id,
        reference: refund.txHash || refund.id,
        createdAt: new Date(),
      },
    }),
  ])

  const refundedTotal = (Number.parseFloat(payment.refundedAmount) + Number.parseFloat(refund.amount)).toFixed(2)
  payment = mapPaymentRow(
    await prisma.ledgerPaymentRecord.update({
      where: { id: payment.id },
      data: {
        refundedAmount: refundedTotal,
        status:
          Number.parseFloat(refundedTotal) >= Number.parseFloat(payment.settledAmount || payment.expectedAmount)
            ? "refunded"
            : payment.status,
      },
    })
  )

  const receipt = await createRefundReceiptInDatabase(refund)
  const attestation = await createAttestationInDatabase({
    schema: "openrx.refund.settlement.v1",
    subjectType: "refund",
    subjectId: refund.id,
    attestor: "openrx-refund-engine",
    payload: {
      refundId: refund.id,
      paymentId: payment.id,
      amount: refund.amount,
      walletAddress: refund.walletAddress,
      txHash: refund.txHash,
      processedAt: refund.processedAt,
      approvedBy: refund.approvedBy,
    },
    chainTxHash: refund.txHash,
  })

  refund = mapRefundRow(
    await prisma.ledgerRefundRecord.update({
      where: { id: refund.id },
      data: {
        receiptId: receipt.id,
        attestationId: attestation.id,
      },
    })
  )
  await prisma.ledgerReceiptRecord.update({
    where: { id: receipt.id },
    data: { attestationId: attestation.id },
  })

  return {
    refund,
    payment,
    receipt: { ...receipt, attestationId: attestation.id },
    attestation,
  }
}

export async function createAttestation(params: {
  schema: string
  subjectType: AttestationRecord["subjectType"]
  subjectId: string
  attestor: string
  payload: Record<string, unknown>
  chainTxHash?: string
}): Promise<AttestationRecord> {
  if (await shouldUseDatabaseLedger()) {
    try {
      return await createAttestationInDatabase(params)
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return createAttestationInFileStore(params)
}

export async function createPaymentIntent(input: PaymentIntentInput): Promise<PaymentRecord> {
  if (await shouldUseDatabaseLedger()) {
    try {
      return await createPaymentIntentInDatabase(input)
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return createPaymentIntentInFileStore(input)
}

export async function verifyAndRecordPayment(input: VerifyPaymentInput): Promise<{
  payment: PaymentRecord
  receipt?: ReceiptRecord
  attestation?: AttestationRecord
  status: BasePayStatus["status"]
}> {
  if (await shouldUseDatabaseLedger()) {
    try {
      return await verifyAndRecordPaymentInDatabase(input)
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return verifyAndRecordPaymentInFileStore(input)
}

export async function requestRefund(input: RequestRefundInput): Promise<RefundRecord> {
  if (await shouldUseDatabaseLedger()) {
    try {
      return await requestRefundInDatabase(input)
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return requestRefundInFileStore(input)
}

export async function finalizeRefund(input: FinalizeRefundInput): Promise<{
  refund: RefundRecord
  payment: PaymentRecord
  receipt?: ReceiptRecord
  attestation?: AttestationRecord
}> {
  if (await shouldUseDatabaseLedger()) {
    try {
      return await finalizeRefundInDatabase(input)
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return finalizeRefundInFileStore(input)
}

export async function updateRefundApproval(refundId: string, approvedBy: string): Promise<RefundRecord> {
  if (await shouldUseDatabaseLedger()) {
    try {
      return await updateRefundApprovalInDatabase(refundId, approvedBy)
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return updateRefundApprovalInFileStore(refundId, approvedBy)
}

export async function getLedgerSnapshot(params?: { walletAddress?: string }): Promise<LedgerSnapshot> {
  if (await shouldUseDatabaseLedger()) {
    try {
      return await getLedgerSnapshotFromDatabase(params)
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return getLedgerSnapshotFromFileStore(params)
}

export async function recordTreasuryAction(action: Omit<TreasuryActionRecord, "id" | "createdAt" | "updatedAt">): Promise<TreasuryActionRecord> {
  const next: TreasuryActionRecord = {
    id: createId("treasury"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...action,
  }

  if (await shouldUseDatabaseLedger()) {
    try {
      await prisma.$transaction([
        prisma.treasuryActionRecord.create({
          data: {
            id: next.id,
            kind: next.kind,
            asset: next.asset,
            amount: next.amount,
            chain: next.chain,
            tokenAddress: next.tokenAddress,
            fromAddress: next.fromAddress,
            toAddress: next.toAddress,
            initiatedBy: next.initiatedBy,
            reason: next.reason,
            status: next.status,
            walletId: next.walletId,
            transactionHash: next.transactionHash,
            privyTransferId: next.privyTransferId,
            metadata: next.metadata as Prisma.InputJsonValue | undefined,
            errorMessage: next.errorMessage,
            createdAt: new Date(next.createdAt),
            updatedAt: new Date(next.updatedAt),
          },
        }),
        prisma.ledgerEntryRecord.create({
          data: {
            id: createId("led"),
            eventType:
              next.status === "failed"
                ? "treasury_transfer_failed"
                : next.status === "confirmed"
                  ? "treasury_transfer_confirmed"
                  : "treasury_transfer_initiated",
            direction: next.status === "failed" ? "memo" : "credit",
            accountCode: next.asset === "USDC" ? "1010-CASH-USDC" : "1015-CASH-ETH",
            amount: next.amount,
            currency: next.asset,
            description: `${next.kind} ${next.status}`,
            reference: next.transactionHash || next.id,
            metadata: {
              fromAddress: next.fromAddress,
              toAddress: next.toAddress,
              reason: next.reason,
              walletId: next.walletId,
            } as Prisma.InputJsonValue,
            createdAt: new Date(next.createdAt),
          },
        }),
      ])
      return next
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  const store = getFileStore()
  appendLedgerEntry(store, {
    eventType:
      next.status === "failed"
        ? "treasury_transfer_failed"
        : next.status === "confirmed"
          ? "treasury_transfer_confirmed"
          : "treasury_transfer_initiated",
    direction: next.status === "failed" ? "memo" : "credit",
    accountCode: next.asset === "USDC" ? "1010-CASH-USDC" : "1015-CASH-ETH",
    amount: next.amount,
    currency: next.asset,
    description: `${next.kind} ${next.status}`,
    reference: next.transactionHash || next.id,
    metadata: {
      fromAddress: next.fromAddress,
      toAddress: next.toAddress,
      reason: next.reason,
      walletId: next.walletId,
    },
  })
  persistStore(store)
  return next
}

export async function listTreasuryActions(limit = 20): Promise<TreasuryActionRecord[]> {
  if (await shouldUseDatabaseLedger()) {
    try {
      const rows = await prisma.treasuryActionRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      })
      return rows.map((row) => ({
        id: row.id,
        kind: row.kind as TreasuryActionRecord["kind"],
        asset: row.asset as TreasuryActionRecord["asset"],
        amount: row.amount,
        chain: row.chain,
        tokenAddress: row.tokenAddress || undefined,
        fromAddress: row.fromAddress,
        toAddress: row.toAddress,
        initiatedBy: row.initiatedBy,
        reason: row.reason,
        status: row.status as TreasuryActionRecord["status"],
        walletId: row.walletId || undefined,
        transactionHash: row.transactionHash || undefined,
        privyTransferId: row.privyTransferId || undefined,
        metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
        errorMessage: row.errorMessage || undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    } catch (error) {
      if (!isMissingLedgerTableError(error)) throw error
      warnLedgerFallback(error)
    }
  }

  return []
}
