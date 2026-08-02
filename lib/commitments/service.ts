import { createHash } from "node:crypto"
import type { CommitmentAdapters } from "@/lib/commitments/adapters"
import { createCommitmentAdapters } from "@/lib/commitments/coinbase-adapters"
import { CommitmentPilotError } from "@/lib/commitments/errors"
import { verifyCommitmentEligibilityToken } from "@/lib/commitments/eligibility"
import {
  assertCommitmentPilotEnabled,
  getCommitmentFeatureFlags,
  getCommitmentPilotNetwork,
} from "@/lib/commitments/flags"
import { createOpaqueId, createOpaqueCommitmentId, createShareToken, hashToken } from "@/lib/commitments/privacy"
import { getCommitmentPilotState } from "@/lib/commitments/store"
import {
  DEFAULT_COMMITMENT_CONFIG,
  type CommitmentSnapshot,
  type CommitmentPatientConsent,
  type CommitmentNotification,
  type CompletionEventInput,
  type CreateCommitmentInput,
  type CredentialShare,
  type PilotAuditEvent,
  type ScreeningCommitment,
} from "@/lib/commitments/types"

const DAY_MS = 24 * 60 * 60 * 1_000

function nowIso(now = new Date()): string {
  return now.toISOString()
}

function requireCommitment(id: string): ScreeningCommitment {
  const commitment = getCommitmentPilotState().commitments.get(id)
  if (!commitment) throw new CommitmentPilotError("not_found", "Commitment not found.", 404)
  return commitment
}

function requireOwner(commitment: ScreeningCommitment, patientId: string): void {
  if (commitment.patientId !== patientId) {
    throw new CommitmentPilotError("forbidden", "You cannot access this commitment.", 403)
  }
}

function identityIsCurrent(
  identity: CommitmentSnapshot["identity"],
): identity is NonNullable<CommitmentSnapshot["identity"]> {
  if (!identity || identity.status !== "verified") return false
  if (identity.expiresAt && new Date(identity.expiresAt).getTime() <= Date.now()) {
    identity.status = "expired"
    return false
  }
  return true
}

function audit(
  eventType: string,
  commitmentId: string | undefined,
  actorType: PilotAuditEvent["actorType"],
  actorId: string,
  metadata: PilotAuditEvent["metadata"] = {},
): void {
  const state = getCommitmentPilotState()
  const previousEventHash = state.audit.at(-1)?.eventHash
  const occurredAt = nowIso()
  const id = createOpaqueId("audit")
  const actorIdHash = createHash("sha256").update(actorId).digest("hex")
  const eventHash = createHash("sha256")
    .update(
      JSON.stringify({
        id,
        commitmentId: commitmentId ?? null,
        actorType,
        actorIdHash,
        eventType,
        occurredAt,
        metadata,
        previousEventHash: previousEventHash ?? null,
      }),
    )
    .digest("hex")
  state.audit.push({
    id,
    commitmentId,
    actorType,
    actorId: actorIdHash,
    eventType,
    occurredAt,
    metadata,
    previousEventHash,
    eventHash,
  })
}

function queuePatientNotification(
  commitment: ScreeningCommitment,
  messageCode: CommitmentNotification["messageCode"],
  scheduleDay?: number,
): void {
  const state = getCommitmentPilotState()
  const key = `${commitment.id}:${messageCode}:${scheduleDay ?? "event"}`
  if (state.notificationKeys.has(key)) return
  state.notificationKeys.add(key)
  state.notifications.push({
    id: createOpaqueId("notification"),
    commitmentId: commitment.id,
    patientId: commitment.patientId,
    messageCode,
    channels: ["in_app", "email"],
    status: "queued",
    scheduleDay,
    createdAt: nowIso(),
  })
  audit("patient_notification.queued", commitment.id, "system", "notification-worker", {
    messageCode,
    channels: "in_app,email",
    scheduleDay: scheduleDay ?? null,
    phiIncluded: false,
  })
}

function assertRecommendationMetadata(input: CreateCommitmentInput): void {
  const required = [
    input.recommendationId,
    input.screeningLabel,
    input.guidelineSource,
    input.guidelineVersion,
    input.engineVersion,
    input.sourceUrl,
    input.recommendationIssuedAt,
  ]
  if (required.some((value) => !value.trim())) {
    throw new CommitmentPilotError("invalid_input", "A complete engine recommendation is required.")
  }
  let source: URL
  try {
    source = new URL(input.sourceUrl)
  } catch {
    throw new CommitmentPilotError("invalid_input", "The recommendation source URL is invalid.")
  }
  if (source.protocol !== "https:") {
    throw new CommitmentPilotError("invalid_input", "The recommendation source must use HTTPS.")
  }
  const issuedAt = new Date(input.recommendationIssuedAt).getTime()
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() + 60_000) {
    throw new CommitmentPilotError("invalid_input", "The recommendation timestamp is invalid.")
  }
}

export class CommitmentPilotService {
  constructor(private readonly configuredAdapters?: CommitmentAdapters) {}

  private get adapters(): CommitmentAdapters {
    return this.configuredAdapters ?? createCommitmentAdapters()
  }

  getConfig() {
    return {
      enabled: getCommitmentFeatureFlags().screeningCommitmentPilot,
      network: getCommitmentPilotNetwork(),
      flags: getCommitmentFeatureFlags(),
      terms: DEFAULT_COMMITMENT_CONFIG,
    }
  }

  async create(input: CreateCommitmentInput): Promise<CommitmentSnapshot> {
    assertCommitmentPilotEnabled()
    assertRecommendationMetadata(input)
    verifyCommitmentEligibilityToken({
      token: input.eligibilityToken,
      subjectId: input.patientId,
      recommendation: {
        recommendationId: input.recommendationId,
        screeningLabel: input.screeningLabel,
        guidelineSource: input.guidelineSource,
        guidelineVersion: input.guidelineVersion,
        engineVersion: input.engineVersion,
        sourceUrl: input.sourceUrl,
      },
    })
    if (!input.termsAccepted || input.consentVersion !== DEFAULT_COMMITMENT_CONFIG.consentVersion) {
      throw new CommitmentPilotError("invalid_input", "The current commitment terms must be accepted.")
    }
    const state = getCommitmentPilotState()
    const id = createOpaqueId("commitment")
    const wallet = await this.adapters.wallet.createOrLinkWallet({
      patientId: input.patientId,
      commitmentId: id,
      existingWalletAddress: input.existingWalletAddress,
    })
    const conflictingWallet = Array.from(state.wallets.values()).find(
      (existing) =>
        existing.publicAddress.toLowerCase() === wallet.publicAddress.toLowerCase() &&
        existing.patientId !== input.patientId,
    )
    if (conflictingWallet) {
      throw new CommitmentPilotError(
        "verification_failed",
        "This wallet is already bound to another patient identity.",
        409,
      )
    }
    const createdAt = nowIso()
    const consentId = createOpaqueId("consent")
    const termsSnapshot: CommitmentPatientConsent["termsSnapshot"] = {
      optional: true,
      careUnaffected: true,
      returnedAs: "USDC_TO_OPENRX_WALLET",
      cashoutSeparatelyAuthorized: true,
      paymentCredentialsStoredByOpenRx: false,
      depositAmountMinor: DEFAULT_COMMITMENT_CONFIG.depositAmountMinor,
      completionRefundMinor:
        DEFAULT_COMMITMENT_CONFIG.depositAmountMinor -
        DEFAULT_COMMITMENT_CONFIG.completionFeeMinor,
      cancellationRefundMinor:
        DEFAULT_COMMITMENT_CONFIG.depositAmountMinor -
        DEFAULT_COMMITMENT_CONFIG.cancellationFeeMinor,
      initialWindowDays: DEFAULT_COMMITMENT_CONFIG.initialWindowDays,
      extensionDays: DEFAULT_COMMITMENT_CONFIG.extensionDays,
      maximumExtensions: DEFAULT_COMMITMENT_CONFIG.maximumExtensions,
    }
    const consent: CommitmentPatientConsent = {
      id: consentId,
      patientId: input.patientId,
      commitmentId: id,
      consentVersion: input.consentVersion,
      termsSnapshot,
      termsHash: createHash("sha256").update(JSON.stringify(termsSnapshot)).digest("hex"),
      grantedAt: createdAt,
    }
    const commitment: ScreeningCommitment = {
      id,
      opaqueCommitmentId: createOpaqueCommitmentId(),
      patientId: input.patientId,
      recommendationId: input.recommendationId,
      screeningLabel: input.screeningLabel,
      guidelineSource: input.guidelineSource,
      guidelineVersion: input.guidelineVersion,
      engineVersion: input.engineVersion,
      network: getCommitmentPilotNetwork(),
      status: "created",
      fundingStatus: "not_started",
      refundStatus: "not_started",
      walletBindingId: wallet.id,
      consentId,
      consentVersion: input.consentVersion,
      consentedAt: createdAt,
      depositAmountMinor: DEFAULT_COMMITMENT_CONFIG.depositAmountMinor,
      cancellationFeeMinor: DEFAULT_COMMITMENT_CONFIG.cancellationFeeMinor,
      completionFeeMinor: DEFAULT_COMMITMENT_CONFIG.completionFeeMinor,
      initialWindowDays: DEFAULT_COMMITMENT_CONFIG.initialWindowDays,
      extensionDays: DEFAULT_COMMITMENT_CONFIG.extensionDays,
      extensionUsed: false,
      createdAt,
      expectedCompletionProviderId: input.expectedCompletionProviderId,
      cohort: input.cohort ?? "commitment_offer",
    }
    state.wallets.set(wallet.id, wallet)
    state.consents.set(consent.id, consent)
    state.commitments.set(id, commitment)
    if (!state.assignments.has(input.patientId)) {
      state.assignments.set(input.patientId, {
        patientId: input.patientId,
        cohort: commitment.cohort,
        assignmentMode: "manual",
        assignedAt: createdAt,
      })
    }
    audit("commitment.created", id, "patient", input.patientId, {
      recommendationId: input.recommendationId,
      guidelineVersion: input.guidelineVersion,
      consentVersion: input.consentVersion,
      sourceUrlDigest: createHash("sha256").update(input.sourceUrl).digest("hex"),
    })
    audit("consent.granted", id, "patient", input.patientId, {
      consentId,
      consentVersion: consent.consentVersion,
      termsHash: consent.termsHash,
    })
    return this.snapshot(id, input.patientId)
  }

  list(patientId: string): CommitmentSnapshot[] {
    assertCommitmentPilotEnabled()
    return Array.from(getCommitmentPilotState().commitments.values())
      .filter((commitment) => commitment.patientId === patientId)
      .map((commitment) => this.snapshot(commitment.id, patientId))
  }

  snapshot(id: string, patientId?: string): CommitmentSnapshot {
    assertCommitmentPilotEnabled()
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    if (patientId) requireOwner(commitment, patientId)
    return {
      commitment,
      wallet: state.wallets.get(commitment.walletBindingId),
      identity: commitment.identityVerificationId
        ? state.identities.get(commitment.identityVerificationId)
        : undefined,
      consent: state.consents.get(commitment.consentId),
      quote: Array.from(state.quotes.values()).find((quote) => quote.commitmentId === id),
      depositTransaction: commitment.depositTransactionId
        ? state.transactions.get(commitment.depositTransactionId)
        : undefined,
      refundTransaction: commitment.refundTransactionId
        ? state.transactions.get(commitment.refundTransactionId)
        : undefined,
      credential: commitment.credentialId ? state.credentials.get(commitment.credentialId) : undefined,
      shares: Array.from(state.shares.values()).filter((share) => share.credentialId === commitment.credentialId),
      notifications: state.notifications.filter((notification) => notification.commitmentId === id),
      audit: state.audit.filter((event) => event.commitmentId === id),
    }
  }

  async verifyIdentity(id: string, patientId: string): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (commitment.status !== "created") {
      throw new CommitmentPilotError("invalid_transition", "Identity can only be verified before funding.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    const identity = await this.adapters.identity.verify({ patientId, walletBinding: wallet })
    state.identities.set(identity.id, identity)
    commitment.identityVerificationId = identity.id
    audit("identity.verified", id, "patient", patientId, {
      provider: identity.provider,
      assuranceLevel: identity.assuranceLevel,
    })
    return this.snapshot(id, patientId)
  }

  async quote(
    id: string,
    patientId: string,
    input: { paymentMethod: string; country: string; subdivision?: string; clientIp?: string },
  ): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (commitment.status !== "created") {
      throw new CommitmentPilotError("invalid_transition", "Funding can only be quoted before deposit.")
    }
    const identity = commitment.identityVerificationId
      ? state.identities.get(commitment.identityVerificationId)
      : undefined
    if (!identityIsCurrent(identity)) {
      throw new CommitmentPilotError("identity_required", "Identity verification is required before funding.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    const quote = await this.adapters.payment.quoteFunding({
      commitment,
      wallet,
      paymentMethod: input.paymentMethod,
      country: input.country,
      subdivision: input.subdivision,
      clientIp: input.clientIp ?? "127.0.0.1",
    })
    state.quotes.set(quote.id, quote)
    commitment.fundingStatus = "quoted"
    audit("funding.quoted", id, "patient", patientId, {
      paymentMethod: quote.paymentMethod,
      feeMinor: quote.feeMinor,
      networkFeeMinor: quote.networkFeeMinor,
      totalMinor: quote.paymentTotalMinor,
    })
    return this.snapshot(id, patientId)
  }

  async fund(id: string, patientId: string): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (commitment.status !== "created") {
      throw new CommitmentPilotError("invalid_transition", "This commitment cannot be funded.")
    }
    const identity = commitment.identityVerificationId
      ? state.identities.get(commitment.identityVerificationId)
      : undefined
    if (!identityIsCurrent(identity)) {
      throw new CommitmentPilotError("identity_required", "Identity verification is required before funding.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    commitment.fundingStatus = "pending"
    const transaction = await this.adapters.payment.fundExactAmount({ commitment, wallet })
    if (
      transaction.amountMinor !== commitment.depositAmountMinor ||
      transaction.currency !== "USDC"
    ) {
      commitment.fundingStatus = "failed"
      throw new CommitmentPilotError("verification_failed", "The exact deposit amount was not confirmed.")
    }
    state.transactions.set(transaction.id, transaction)
    commitment.depositTransactionId = transaction.id
    commitment.fundingStatus = transaction.status === "confirmed" ? "confirmed" : "pending"
    if (transaction.status === "confirmed") {
      const fundedAt = transaction.confirmedAt ?? transaction.createdAt
      commitment.status = "funded"
      commitment.fundedAt = fundedAt
      commitment.currentDeadline = new Date(
        new Date(fundedAt).getTime() + commitment.initialWindowDays * DAY_MS,
      ).toISOString()
    }
    audit("deposit.confirmed", id, "patient", patientId, {
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      exactApproval: true,
    })
    return this.snapshot(id, patientId)
  }

  async prepareDeposit(id: string, patientId: string) {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (commitment.status !== "created") {
      throw new CommitmentPilotError("invalid_transition", "This commitment cannot be funded.")
    }
    const identity = commitment.identityVerificationId
      ? state.identities.get(commitment.identityVerificationId)
      : undefined
    if (!identityIsCurrent(identity)) {
      throw new CommitmentPilotError("identity_required", "Identity verification is required before funding.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    const prepared = await this.adapters.payment.prepareDeposit({ commitment, wallet })
    audit("deposit.prepared", id, "patient", patientId, {
      amountMinor: prepared.amountMinor,
      callCount: prepared.calls.length,
      exactApproval: true,
    })
    return prepared
  }

  async startOnramp(
    id: string,
    patientId: string,
    clientIp: string,
  ): Promise<{ providerReference: string; url: string }> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (!getCommitmentFeatureFlags().coinbaseOnrampPilot) {
      throw new CommitmentPilotError("disabled", "Coinbase funding is disabled.", 404)
    }
    if (commitment.status !== "created" || commitment.fundingStatus !== "quoted") {
      throw new CommitmentPilotError(
        "invalid_transition",
        "A current funding quote is required before opening Coinbase.",
      )
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    const quote = Array.from(state.quotes.values()).find(
      (candidate) => candidate.commitmentId === commitment.id,
    )
    if (!wallet || !quote || !quote.available || new Date(quote.expiresAt).getTime() <= Date.now()) {
      throw new CommitmentPilotError("invalid_transition", "The funding quote is unavailable or expired.")
    }
    const session = await this.adapters.payment.createOnrampSession({
      commitment,
      quote,
      wallet,
      clientIp,
    })
    audit("onramp.session_created", id, "patient", patientId, {
      provider: quote.provider,
      opaqueMetadataOnly: true,
    })
    return session
  }

  async confirmDeposit(
    id: string,
    patientId: string,
    transactionHash: `0x${string}`,
  ): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (commitment.status !== "created") {
      throw new CommitmentPilotError("invalid_transition", "This commitment cannot be funded.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    const transaction = await this.adapters.payment.confirmDeposit({
      commitment,
      wallet,
      transactionHash,
    })
    if (
      transaction.status !== "confirmed" ||
      transaction.amountMinor !== commitment.depositAmountMinor ||
      transaction.currency !== "USDC"
    ) {
      throw new CommitmentPilotError("verification_failed", "The exact deposit was not confirmed.")
    }
    state.transactions.set(transaction.id, transaction)
    commitment.depositTransactionId = transaction.id
    commitment.fundingStatus = "confirmed"
    commitment.status = "funded"
    commitment.fundedAt = transaction.confirmedAt ?? transaction.createdAt
    commitment.currentDeadline = new Date(
      new Date(commitment.fundedAt).getTime() + commitment.initialWindowDays * DAY_MS,
    ).toISOString()
    audit("deposit.confirmed", id, "patient", patientId, {
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      exactApproval: true,
    })
    return this.snapshot(id, patientId)
  }

  extend(id: string, patientId: string): CommitmentSnapshot {
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (!["funded", "extended"].includes(commitment.status) || !commitment.currentDeadline) {
      throw new CommitmentPilotError("invalid_transition", "This commitment cannot be extended.")
    }
    if (commitment.extensionUsed) {
      throw new CommitmentPilotError("invalid_transition", "The one available extension has already been used.")
    }
    commitment.extensionUsed = true
    commitment.status = "extended"
    commitment.currentDeadline = new Date(
      new Date(commitment.currentDeadline).getTime() + commitment.extensionDays * DAY_MS,
    ).toISOString()
    audit("commitment.extended", id, "patient", patientId, {
      extensionDays: commitment.extensionDays,
      diagnosisCollected: false,
    })
    queuePatientNotification(commitment, "extension_confirmed")
    return this.snapshot(id, patientId)
  }

  async cancel(
    id: string,
    patientId: string,
    reason: "cancelled" | "consent_withdrawn" = "cancelled",
  ): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (!["created", "funded", "extended"].includes(commitment.status)) {
      throw new CommitmentPilotError("invalid_transition", "This commitment cannot be cancelled.")
    }
    const timestamp = nowIso()
    commitment.status = "cancelled"
    commitment.cancelledAt = timestamp
    commitment.terminalReason = reason
    if (reason === "consent_withdrawn") commitment.consentWithdrawnAt = timestamp
    if (reason === "consent_withdrawn") {
      const consent = state.consents.get(commitment.consentId)
      if (consent) consent.revokedAt = timestamp
    }
    if (commitment.fundingStatus === "confirmed") {
      const wallet = state.wallets.get(commitment.walletBindingId)
      if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
      await this.processRefund(commitment, wallet, "cancellation", commitment.cancellationFeeMinor)
    }
    audit(
      reason === "consent_withdrawn" ? "consent.withdrawn" : "commitment.cancelled",
      id,
      "patient",
      patientId,
      { feeMinor: commitment.fundingStatus === "confirmed" ? commitment.cancellationFeeMinor : 0 },
    )
    queuePatientNotification(commitment, "commitment_cancelled")
    return this.snapshot(id, patientId)
  }

  async expire(id: string, actorId = "expiry-worker", now = new Date()): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    if (!["funded", "extended"].includes(commitment.status) || !commitment.currentDeadline) {
      throw new CommitmentPilotError("invalid_transition", "This commitment cannot expire.")
    }
    if (new Date(commitment.currentDeadline).getTime() > now.getTime()) {
      throw new CommitmentPilotError("deadline_not_reached", "The commitment deadline has not been reached.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    commitment.status = "expired"
    commitment.expiredAt = nowIso(now)
    commitment.terminalReason = "expired"
    await this.processRefund(commitment, wallet, "expiration", commitment.cancellationFeeMinor)
    audit("commitment.expired", id, "system", actorId, { feeMinor: commitment.cancellationFeeMinor })
    queuePatientNotification(commitment, "commitment_expired")
    return this.snapshot(id)
  }

  async exceptionRefund(id: string, adminId: string): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    if (!["funded", "extended"].includes(commitment.status)) {
      throw new CommitmentPilotError("invalid_transition", "A full exception refund is not available.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    commitment.terminalReason = "exception"
    await this.processRefund(commitment, wallet, "exception", 0)
    audit("refund.exception_authorized", id, "admin", adminId, {
      amountMinor: commitment.depositAmountMinor,
      feeMinor: 0,
    })
    queuePatientNotification(commitment, "exception_refund_confirmed")
    return this.snapshot(id)
  }

  async retryRefund(id: string, actorId: string): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    if (!["failed", "pending"].includes(commitment.refundStatus) || !commitment.terminalReason) {
      throw new CommitmentPilotError("invalid_transition", "This refund is not awaiting a retry.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    const reason =
      commitment.terminalReason === "completed"
        ? "completion"
        : commitment.terminalReason === "expired"
          ? "expiration"
          : commitment.terminalReason === "exception"
            ? "exception"
            : "cancellation"
    const feeMinor =
      reason === "completion"
        ? commitment.completionFeeMinor
        : reason === "exception"
          ? 0
          : commitment.cancellationFeeMinor
    await this.processRefund(commitment, wallet, reason, feeMinor)
    if (
      commitment.terminalReason === "completed" &&
      getCommitmentFeatureFlags().privateCompletionCredentials &&
      !commitment.credentialId
    ) {
      const credential = await this.adapters.credentialIssuer.issue({ commitment })
      state.credentials.set(credential.id, credential)
      commitment.credentialId = credential.id
      audit("credential.issued", commitment.id, "system", "credential-worker", {
        credentialVersion: credential.schemaVersion,
      })
    }
    audit("refund.retried", id, "support", actorId, { reason })
    queuePatientNotification(commitment, "refund_retry_confirmed")
    return this.snapshot(id)
  }

  async complete(input: CompletionEventInput): Promise<CommitmentSnapshot> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(input.commitmentId)
    if (state.processedCompletionKeys.has(input.idempotencyKey)) {
      return this.snapshot(commitment.id)
    }
    if (state.usedNonces.has(input.nonce)) {
      throw new CommitmentPilotError("replay", "Completion nonce has already been used.", 409)
    }
    if (!["funded", "extended"].includes(commitment.status)) {
      throw new CommitmentPilotError("invalid_transition", "Completion cannot be applied in this state.")
    }
    const verified = await this.adapters.completion.verifyCompletion(
      input,
      commitment.expectedCompletionProviderId,
    )
    state.processedCompletionKeys.add(input.idempotencyKey)
    state.usedNonces.add(input.nonce)
    commitment.status = "condition_verified"
    commitment.conditionVerifiedAt = verified.occurredAt
    commitment.completedAt = verified.occurredAt
    commitment.terminalReason = "completed"
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    await this.processRefund(commitment, wallet, "completion", commitment.completionFeeMinor)
    if (getCommitmentFeatureFlags().privateCompletionCredentials) {
      const credential = await this.adapters.credentialIssuer.issue({ commitment })
      state.credentials.set(credential.id, credential)
      commitment.credentialId = credential.id
      audit("credential.issued", commitment.id, "system", "credential-worker", {
        credentialVersion: credential.schemaVersion,
      })
    }
    audit("completion.verified", commitment.id, "provider", verified.providerId, {
      eventId: verified.eventId,
      resultIncluded: false,
    })
    queuePatientNotification(commitment, "completion_verified_refund_confirmed")
    return this.snapshot(commitment.id)
  }

  async runDeadlineWorker(
    actorId = "commitment-deadline-worker",
    now = new Date(),
  ): Promise<{
    remindersQueued: number
    expired: number
    refundFailures: number
  }> {
    const state = getCommitmentPilotState()
    const reminderDays = (process.env.COMMITMENT_REMINDER_DAYS || "7,30,60,80,88")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 180)
    let remindersQueued = 0
    let expired = 0
    let refundFailures = 0
    for (const commitment of Array.from(state.commitments.values())) {
      if (!["funded", "extended"].includes(commitment.status) || !commitment.currentDeadline || !commitment.fundedAt) {
        continue
      }
      const deadlineMs = new Date(commitment.currentDeadline).getTime()
      if (deadlineMs <= now.getTime()) {
        try {
          await this.expire(commitment.id, actorId, now)
          expired += 1
        } catch {
          refundFailures += 1
        }
        continue
      }
      const elapsedDays = Math.floor(
        (now.getTime() - new Date(commitment.fundedAt).getTime()) / DAY_MS,
      )
      for (const day of reminderDays) {
        const key = `${commitment.id}:${day}`
        if (elapsedDays >= day && !state.remindersSent.has(key)) {
          state.remindersSent.add(key)
          remindersQueued += 1
          audit("reminder.queued", commitment.id, "system", actorId, {
            scheduleDay: day,
            channels: "in_app,email",
            phiIncluded: false,
          })
          queuePatientNotification(commitment, "deadline_reminder", day)
        }
      }
    }
    return { remindersQueued, expired, refundFailures }
  }

  getPilotAnalytics() {
    const state = getCommitmentPilotState()
    const commitments = Array.from(state.commitments.values())
    const byCohort = (cohort: "reminders_only" | "commitment_offer") => {
      const assigned = Array.from(state.assignments.values()).filter(
        (assignment) => assignment.cohort === cohort,
      ).length
      const cohortCommitments = commitments.filter((commitment) => commitment.cohort === cohort)
      const completed = cohortCommitments.filter((commitment) => commitment.terminalReason === "completed")
      const funded = cohortCommitments.filter((commitment) => Boolean(commitment.fundedAt))
      const completionDurations = completed
        .filter((commitment) => commitment.fundedAt && commitment.completedAt)
        .map(
          (commitment) =>
            (new Date(commitment.completedAt || "").getTime() -
              new Date(commitment.fundedAt || "").getTime()) /
            DAY_MS,
        )
      return {
        assigned,
        bookings: cohortCommitments.length,
        funded: funded.length,
        completed: completed.length,
        extended: cohortCommitments.filter((commitment) => commitment.extensionUsed).length,
        cancelled: cohortCommitments.filter((commitment) => commitment.terminalReason === "cancelled").length,
        expired: cohortCommitments.filter((commitment) => commitment.terminalReason === "expired").length,
        refundConfirmed: cohortCommitments.filter(
          (commitment) => commitment.refundStatus === "confirmed",
        ).length,
        meanDaysToCompletion:
          completionDurations.length > 0
            ? completionDurations.reduce((sum, value) => sum + value, 0) /
              completionDurations.length
            : null,
      }
    }
    return {
      generatedAt: nowIso(),
      assignmentMode: "manual_only",
      randomized: false,
      remindersOnly: byCohort("reminders_only"),
      commitmentOffer: byCohort("commitment_offer"),
      externalAnalyticsPayload: "aggregate_only",
    }
  }

  async createOfframp(
    id: string,
    patientId: string,
    clientIp: string,
  ): Promise<{ available: boolean; url?: string; feeDisclosure: string; timingDisclosure: string }> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (commitment.refundStatus !== "confirmed") {
      throw new CommitmentPilotError("invalid_transition", "A confirmed refund is required before cash-out.")
    }
    const wallet = state.wallets.get(commitment.walletBindingId)
    if (!wallet) throw new CommitmentPilotError("not_found", "Wallet binding not found.", 404)
    const session = await this.adapters.payment.createOfframpSession({ commitment, wallet, clientIp })
    audit("offramp.requested", id, "patient", patientId, { available: session.available })
    return session
  }

  async createCredentialShare(
    id: string,
    patientId: string,
    intendedVerifier: string,
    ttlMinutes = 30,
  ): Promise<{ share: CredentialShare; token: string }> {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    if (!getCommitmentFeatureFlags().insurerVerifierDemo) {
      throw new CommitmentPilotError("disabled", "Verifier demonstration is disabled.", 404)
    }
    const credential = commitment.credentialId
      ? state.credentials.get(commitment.credentialId)
      : undefined
    if (!credential || credential.status !== "active") {
      throw new CommitmentPilotError("invalid_transition", "An active completion credential is required.")
    }
    if (!intendedVerifier.trim() || ttlMinutes < 1 || ttlMinutes > 1_440) {
      throw new CommitmentPilotError("invalid_input", "Verifier and expiration are required.")
    }
    const token = createShareToken()
    const share: CredentialShare = {
      id: createOpaqueId("share"),
      credentialId: credential.id,
      patientId,
      intendedVerifier: intendedVerifier.trim().slice(0, 120),
      tokenHash: hashToken(token),
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1_000).toISOString(),
      accessCount: 0,
    }
    state.shares.set(share.id, share)
    audit("credential.share_created", id, "patient", patientId, {
      shareId: share.id,
      ttlMinutes,
    })
    return { share, token }
  }

  async verifyShare(token: string) {
    const state = getCommitmentPilotState()
    const tokenHash = hashToken(token)
    const share = Array.from(state.shares.values()).find((candidate) => candidate.tokenHash === tokenHash)
    if (!share || share.revokedAt || new Date(share.expiresAt).getTime() <= Date.now()) {
      throw new CommitmentPilotError("not_found", "This credential link is invalid or expired.", 404)
    }
    const credential = state.credentials.get(share.credentialId)
    if (!credential) throw new CommitmentPilotError("not_found", "Credential not found.", 404)
    const result = await this.adapters.credentialVerifier.verify(credential)
    share.accessCount += 1
    share.lastAccessedAt = nowIso()
    audit("credential.share_accessed", credential.commitmentId, "verifier", share.intendedVerifier, {
      shareId: share.id,
      valid: result.valid,
    })
    return {
      valid: result.valid,
      reason: result.reason,
      intendedVerifier: share.intendedVerifier,
      credential: result.valid ? credential.payload : undefined,
      issuerAddress: result.valid ? credential.issuerAddress : undefined,
      expiresAt: share.expiresAt,
    }
  }

  recordCoinbaseWebhook(input: {
    eventId: string
    eventType: string
    idempotencyKey: string
    partnerUserRef?: string
    status: string
  }): { duplicate: boolean } {
    const state = getCommitmentPilotState()
    if (state.processedCoinbaseWebhookKeys.has(input.idempotencyKey)) return { duplicate: true }
    state.processedCoinbaseWebhookKeys.add(input.idempotencyKey)
    const commitment = input.partnerUserRef
      ? Array.from(state.commitments.values()).find((candidate) =>
          candidate.opaqueCommitmentId.slice(2, 50).startsWith(input.partnerUserRef || ""),
        )
      : undefined
    audit("coinbase.webhook_received", commitment?.id, "system", "coinbase-webhook", {
      eventId: input.eventId,
      eventType: input.eventType,
      status: input.status,
      bodyPersisted: false,
    })
    return { duplicate: false }
  }

  revokeShare(id: string, patientId: string, shareId: string): CommitmentSnapshot {
    const state = getCommitmentPilotState()
    const commitment = requireCommitment(id)
    requireOwner(commitment, patientId)
    const share = state.shares.get(shareId)
    if (!share || share.patientId !== patientId || share.credentialId !== commitment.credentialId) {
      throw new CommitmentPilotError("not_found", "Credential share not found.", 404)
    }
    share.revokedAt = nowIso()
    audit("credential.share_revoked", id, "patient", patientId, { shareId })
    return this.snapshot(id, patientId)
  }

  private async processRefund(
    commitment: ScreeningCommitment,
    wallet: NonNullable<CommitmentSnapshot["wallet"]>,
    reason: "completion" | "cancellation" | "expiration" | "exception",
    feeMinor: number,
  ): Promise<void> {
    const state = getCommitmentPilotState()
    commitment.refundStatus = "pending"
    const amountMinor = Math.max(0, commitment.depositAmountMinor - feeMinor)
    let transaction
    try {
      transaction = await this.adapters.payment.refund({
        commitment,
        wallet,
        amountMinor,
        reason,
      })
    } catch {
      commitment.refundStatus = "failed"
      audit("refund.failed", commitment.id, "system", "refund-worker", {
        reason,
        retryable: true,
      })
      throw new CommitmentPilotError(
        "external_service_unavailable",
        "The refund is delayed and queued for a safe retry.",
        503,
      )
    }
    state.transactions.set(transaction.id, transaction)
    commitment.refundTransactionId = transaction.id
    commitment.refundStatus = transaction.status === "confirmed" ? "confirmed" : "pending"
    if (transaction.status === "failed") commitment.refundStatus = "failed"
    if (transaction.status === "confirmed") {
      commitment.refundedAt = transaction.confirmedAt ?? transaction.createdAt
      commitment.status =
        commitment.terminalReason === "completed" || commitment.terminalReason === "exception"
          ? "refunded"
          : commitment.status
    }
    audit("refund.confirmed", commitment.id, "system", "refund-worker", {
      amountMinor,
      feeMinor,
      reason,
      returnedTo: "openrx_wallet",
    })
  }
}

export const commitmentPilotService = new CommitmentPilotService()
