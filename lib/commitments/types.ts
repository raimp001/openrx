import type { CommitmentPilotNetwork } from "@/lib/commitments/flags"

export type CommitmentStatus =
  | "created"
  | "funded"
  | "extended"
  | "condition_verified"
  | "refunded"
  | "cancelled"
  | "expired"

export type FundingStatus = "not_started" | "quoted" | "pending" | "confirmed" | "failed" | "abandoned"
export type RefundStatus = "not_started" | "pending" | "confirmed" | "failed"
export type IdentityVerificationStatus = "pending" | "verified" | "failed" | "expired"
export type CredentialStatus = "active" | "revoked" | "expired"
export type PilotCohort = "reminders_only" | "commitment_offer"

export interface WalletBinding {
  id: string
  patientId: string
  provider: "mock" | "coinbase_cdp" | "existing_openrx"
  providerReference: string
  encryptedWalletAddress: string
  publicAddress: string
  dedicated: boolean
  recoverySupported: boolean
  createdAt: string
}

export interface IdentityVerification {
  id: string
  patientId: string
  walletBindingId: string
  provider: "mock" | "partner_oidc" | "identity_vendor"
  assuranceLevel: string
  status: IdentityVerificationStatus
  providerReferenceToken: string
  verifiedAt?: string
  expiresAt?: string
  createdAt: string
}

export interface PaymentQuote {
  id: string
  commitmentId: string
  provider: "mock" | "coinbase_onramp"
  paymentMethod: string
  paymentSubtotalMinor: number
  feeMinor: number
  networkFeeMinor: number
  paymentTotalMinor: number
  paymentCurrency: "USD"
  purchaseAmountMinor: number
  purchaseCurrency: "USDC"
  expiresAt: string
  available: boolean
  providerReference?: string
}

export interface PaymentTransaction {
  id: string
  commitmentId: string
  kind: "deposit" | "refund"
  provider: "mock" | "coinbase_cdp"
  amountMinor: number
  currency: "USDC"
  status: "pending" | "confirmed" | "failed"
  opaqueTransactionReference: string
  createdAt: string
  confirmedAt?: string
}

export interface PreparedDepositCall {
  to: `0x${string}`
  data: `0x${string}`
  value: "0"
  purpose: "approve_exact_usdc" | "fund_conditional_deposit"
}

export interface PreparedDeposit {
  network: "base-sepolia"
  chainId: 84532
  amountMinor: number
  currency: "USDC"
  calls: PreparedDepositCall[]
}

export interface PrivateCompletionCredential {
  id: string
  commitmentId: string
  status: CredentialStatus
  protocol: "eas-compatible-offchain-v1"
  schemaVersion: "openrx-private-completion-v1"
  issuerOrganizationId: string
  issuerKeyId: string
  issuerAddress: string
  broadValidityPeriod: string
  issuedAt: string
  expiresAt: string
  revokedAt?: string
  signature: string
  payload: {
    commitmentId: string
    completionStatus: "verified"
    broadValidityPeriod: string
    issuerOrganizationId: string
    credentialVersion: "1"
    issuedAt: string
    expiresAt: string
    revocationStatus: "active" | "revoked"
  }
}

export interface CredentialShare {
  id: string
  credentialId: string
  patientId: string
  intendedVerifier: string
  tokenHash: string
  createdAt: string
  expiresAt: string
  revokedAt?: string
  accessCount: number
  lastAccessedAt?: string
}

export interface CommitmentPatientConsent {
  id: string
  patientId: string
  commitmentId: string
  consentVersion: string
  termsSnapshot: {
    optional: true
    careUnaffected: true
    returnedAs: "USDC_TO_OPENRX_WALLET"
    cashoutSeparatelyAuthorized: true
    paymentCredentialsStoredByOpenRx: false
    depositAmountMinor: number
    completionRefundMinor: number
    cancellationRefundMinor: number
    initialWindowDays: number
    extensionDays: number
    maximumExtensions: number
  }
  termsHash: string
  grantedAt: string
  revokedAt?: string
}

export interface PilotAuditEvent {
  id: string
  commitmentId?: string
  actorType: "patient" | "provider" | "support" | "compliance" | "admin" | "system" | "verifier"
  actorId: string
  eventType: string
  occurredAt: string
  metadata: Record<string, string | number | boolean | null>
  previousEventHash?: string
  eventHash: string
}

export interface CommitmentNotification {
  id: string
  commitmentId: string
  patientId: string
  messageCode:
    | "extension_confirmed"
    | "commitment_cancelled"
    | "commitment_expired"
    | "completion_verified_refund_confirmed"
    | "exception_refund_confirmed"
    | "refund_retry_confirmed"
    | "deadline_reminder"
  channels: Array<"in_app" | "email">
  status: "queued"
  scheduleDay?: number
  createdAt: string
}

export interface ScreeningCommitment {
  id: string
  opaqueCommitmentId: string
  patientId: string
  recommendationId: string
  screeningLabel: string
  guidelineSource: string
  guidelineVersion: string
  engineVersion: string
  network: CommitmentPilotNetwork
  status: CommitmentStatus
  fundingStatus: FundingStatus
  refundStatus: RefundStatus
  walletBindingId: string
  identityVerificationId?: string
  consentId: string
  consentVersion: string
  consentedAt: string
  depositAmountMinor: number
  cancellationFeeMinor: number
  completionFeeMinor: number
  initialWindowDays: number
  extensionDays: number
  extensionUsed: boolean
  createdAt: string
  fundedAt?: string
  currentDeadline?: string
  conditionVerifiedAt?: string
  completedAt?: string
  cancelledAt?: string
  expiredAt?: string
  refundedAt?: string
  expectedCompletionProviderId?: string
  depositTransactionId?: string
  refundTransactionId?: string
  credentialId?: string
  cohort: PilotCohort
  consentWithdrawnAt?: string
  terminalReason?: "completed" | "cancelled" | "expired" | "consent_withdrawn" | "exception"
}

export interface CompletionEventInput {
  eventId: string
  commitmentId: string
  providerId: string
  occurredAt: string
  nonce: string
  idempotencyKey: string
  signature: string
}

export interface VerifiedCompletionEvent {
  eventId: string
  commitmentId: string
  providerId: string
  occurredAt: string
  idempotencyKey: string
}

export interface CommitmentSnapshot {
  commitment: ScreeningCommitment
  wallet?: WalletBinding
  identity?: IdentityVerification
  consent?: CommitmentPatientConsent
  quote?: PaymentQuote
  depositTransaction?: PaymentTransaction
  refundTransaction?: PaymentTransaction
  credential?: PrivateCompletionCredential
  shares: CredentialShare[]
  notifications: CommitmentNotification[]
  audit: PilotAuditEvent[]
}

export interface CreateCommitmentInput {
  patientId: string
  recommendationId: string
  screeningLabel: string
  guidelineSource: string
  guidelineVersion: string
  engineVersion: string
  sourceUrl: string
  recommendationIssuedAt: string
  eligibilityToken: string
  expectedCompletionProviderId?: string
  consentVersion: string
  termsAccepted: boolean
  existingWalletAddress?: string
  cohort?: PilotCohort
}

export interface CommitmentPilotConfig {
  depositAmountMinor: number
  cancellationFeeMinor: number
  completionFeeMinor: number
  initialWindowDays: number
  extensionDays: number
  maximumExtensions: number
  consentVersion: string
}

export const DEFAULT_COMMITMENT_CONFIG: CommitmentPilotConfig = {
  depositAmountMinor: 2_000,
  cancellationFeeMinor: 200,
  completionFeeMinor: 0,
  initialWindowDays: 90,
  extensionDays: 90,
  maximumExtensions: 1,
  consentVersion: "openrx-screening-commitment-terms-v1",
}
