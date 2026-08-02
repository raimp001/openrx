-- Screening commitment pilot. This migration creates storage only; all runtime
-- behavior remains disabled until the sandbox feature flags are enabled.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PROVIDER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COMPLIANCE';

CREATE TABLE "wallet_bindings" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReferenceCiphertext" TEXT NOT NULL,
  "walletAddressCiphertext" TEXT NOT NULL,
  "walletAddressHash" TEXT NOT NULL,
  "dedicated" BOOLEAN NOT NULL DEFAULT TRUE,
  "recoverySupported" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "wallet_bindings_patientId_createdAt_idx" ON "wallet_bindings"("patientId", "createdAt");
CREATE UNIQUE INDEX "wallet_bindings_patientId_walletAddressHash_key" ON "wallet_bindings"("patientId", "walletAddressHash");

CREATE TABLE "identity_verifications" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "walletBindingId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "assuranceLevel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerReferenceCiphertext" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "identity_verifications_patientId_status_idx" ON "identity_verifications"("patientId", "status");
CREATE INDEX "identity_verifications_walletBindingId_createdAt_idx" ON "identity_verifications"("walletBindingId", "createdAt");

CREATE TABLE "screening_commitments" (
  "id" TEXT PRIMARY KEY,
  "opaqueCommitmentId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "recommendationSnapshotCiphertext" TEXT NOT NULL,
  "guidelineVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "network" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "fundingStatus" TEXT NOT NULL,
  "refundStatus" TEXT NOT NULL,
  "walletBindingId" TEXT NOT NULL,
  "identityVerificationId" TEXT,
  "consentId" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "consentWithdrawnAt" TIMESTAMP(3),
  "depositAmountMinor" INTEGER NOT NULL,
  "cancellationFeeMinor" INTEGER NOT NULL,
  "completionFeeMinor" INTEGER NOT NULL,
  "initialWindowDays" INTEGER NOT NULL,
  "extensionDays" INTEGER NOT NULL,
  "extensionUsed" BOOLEAN NOT NULL DEFAULT FALSE,
  "currentDeadline" TIMESTAMP(3),
  "expectedCompletionProviderHash" TEXT,
  "fundedAt" TIMESTAMP(3),
  "conditionVerifiedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "terminalReason" TEXT,
  "cohort" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "screening_commitments_opaqueCommitmentId_key" ON "screening_commitments"("opaqueCommitmentId");
CREATE INDEX "screening_commitments_patientId_createdAt_idx" ON "screening_commitments"("patientId", "createdAt");
CREATE INDEX "screening_commitments_status_currentDeadline_idx" ON "screening_commitments"("status", "currentDeadline");
CREATE INDEX "screening_commitments_recommendationId_idx" ON "screening_commitments"("recommendationId");
CREATE INDEX "screening_commitments_cohort_createdAt_idx" ON "screening_commitments"("cohort", "createdAt");

CREATE TABLE "commitment_extensions" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "previousDeadline" TIMESTAMP(3) NOT NULL,
  "newDeadline" TIMESTAMP(3) NOT NULL,
  "reasonCategory" TEXT NOT NULL,
  "diagnosisCollected" BOOLEAN NOT NULL DEFAULT FALSE,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "commitment_extensions_commitmentId_createdAt_idx" ON "commitment_extensions"("commitmentId", "createdAt");

CREATE TABLE "payment_quotes" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "paymentSubtotalMinor" INTEGER NOT NULL,
  "feeMinor" INTEGER NOT NULL,
  "networkFeeMinor" INTEGER NOT NULL,
  "paymentTotalMinor" INTEGER NOT NULL,
  "paymentCurrency" TEXT NOT NULL,
  "purchaseAmountMinor" INTEGER NOT NULL,
  "purchaseCurrency" TEXT NOT NULL,
  "available" BOOLEAN NOT NULL,
  "providerReferenceCiphertext" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "payment_quotes_commitmentId_createdAt_idx" ON "payment_quotes"("commitmentId", "createdAt");

CREATE TABLE "onramp_sessions" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "opaqueFundingSessionId" TEXT NOT NULL,
  "providerReferenceCiphertext" TEXT,
  "status" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "onramp_sessions_opaqueFundingSessionId_key" ON "onramp_sessions"("opaqueFundingSessionId");
CREATE INDEX "onramp_sessions_commitmentId_createdAt_idx" ON "onramp_sessions"("commitmentId", "createdAt");
CREATE INDEX "onramp_sessions_status_updatedAt_idx" ON "onramp_sessions"("status", "updatedAt");

CREATE TABLE "deposit_transactions" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "opaqueTransactionReferenceCiphertext" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "deposit_transactions_commitmentId_createdAt_idx" ON "deposit_transactions"("commitmentId", "createdAt");
CREATE INDEX "deposit_transactions_status_updatedAt_idx" ON "deposit_transactions"("status", "updatedAt");

CREATE TABLE "refund_transactions" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "feeMinor" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "opaqueTransactionReferenceCiphertext" TEXT NOT NULL,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "refund_transactions_commitmentId_createdAt_idx" ON "refund_transactions"("commitmentId", "createdAt");
CREATE INDEX "refund_transactions_status_updatedAt_idx" ON "refund_transactions"("status", "updatedAt");

CREATE TABLE "offramp_sessions" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReferenceCiphertext" TEXT,
  "status" TEXT NOT NULL,
  "availabilitySnapshot" JSONB NOT NULL,
  "authorizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "offramp_sessions_commitmentId_createdAt_idx" ON "offramp_sessions"("commitmentId", "createdAt");
CREATE INDEX "offramp_sessions_status_updatedAt_idx" ON "offramp_sessions"("status", "updatedAt");

CREATE TABLE "provider_completion_events" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "providerIdHash" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "idempotencyKeyHash" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "signatureVerified" BOOLEAN NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStatus" TEXT NOT NULL,
  "failureCode" TEXT
);
CREATE UNIQUE INDEX "provider_completion_events_idempotencyKeyHash_key" ON "provider_completion_events"("idempotencyKeyHash");
CREATE UNIQUE INDEX "provider_completion_events_nonceHash_key" ON "provider_completion_events"("nonceHash");
CREATE INDEX "provider_completion_events_commitmentId_receivedAt_idx" ON "provider_completion_events"("commitmentId", "receivedAt");
CREATE INDEX "provider_completion_events_processingStatus_receivedAt_idx" ON "provider_completion_events"("processingStatus", "receivedAt");

CREATE TABLE "private_attestations" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "issuerOrganizationId" TEXT NOT NULL,
  "issuerKeyId" TEXT NOT NULL,
  "issuerAddress" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signature" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "private_attestations_commitmentId_issuedAt_idx" ON "private_attestations"("commitmentId", "issuedAt");
CREATE INDEX "private_attestations_status_expiresAt_idx" ON "private_attestations"("status", "expiresAt");

CREATE TABLE "credential_shares" (
  "id" TEXT PRIMARY KEY,
  "credentialId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "intendedVerifier" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "lastAccessedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "credential_shares_tokenHash_key" ON "credential_shares"("tokenHash");
CREATE INDEX "credential_shares_credentialId_createdAt_idx" ON "credential_shares"("credentialId", "createdAt");
CREATE INDEX "credential_shares_patientId_createdAt_idx" ON "credential_shares"("patientId", "createdAt");

CREATE TABLE "patient_consents" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "commitmentId" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "termsSnapshot" JSONB NOT NULL,
  "termsHash" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "patient_consents_patientId_grantedAt_idx" ON "patient_consents"("patientId", "grantedAt");
CREATE INDEX "patient_consents_commitmentId_idx" ON "patient_consents"("commitmentId");

CREATE TABLE "webhook_events" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "idempotencyKeyHash" TEXT NOT NULL,
  "signatureVerified" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL,
  "failureCode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "webhook_events_idempotencyKeyHash_key" ON "webhook_events"("idempotencyKeyHash");
CREATE INDEX "webhook_events_provider_status_receivedAt_idx" ON "webhook_events"("provider", "status", "receivedAt");

CREATE TABLE "commitment_audit_events" (
  "id" TEXT PRIMARY KEY,
  "commitmentId" TEXT,
  "actorType" TEXT NOT NULL,
  "actorIdHash" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousEventHash" TEXT,
  "eventHash" TEXT NOT NULL
);
CREATE INDEX "commitment_audit_events_commitmentId_occurredAt_idx" ON "commitment_audit_events"("commitmentId", "occurredAt");
CREATE INDEX "commitment_audit_events_eventType_occurredAt_idx" ON "commitment_audit_events"("eventType", "occurredAt");

CREATE TABLE "pilot_assignments" (
  "id" TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "cohort" TEXT NOT NULL,
  "assignmentMode" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3),
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewReference" TEXT
);
CREATE INDEX "pilot_assignments_cohort_assignedAt_idx" ON "pilot_assignments"("cohort", "assignedAt");
CREATE UNIQUE INDEX "pilot_assignments_patientId_key" ON "pilot_assignments"("patientId");
