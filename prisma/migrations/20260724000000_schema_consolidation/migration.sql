-- Consolidation migration: brings the Prisma migration history in line with
-- prisma/schema.prisma. The four tables already created by earlier migrations
-- (care_team_requests, care_team_audit_log, chat_conversations, chat_messages)
-- are intentionally excluded here.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN', 'PHARMACIST');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_REMINDER', 'PRESCRIPTION_READY', 'MESSAGE_RECEIVED', 'LAB_RESULT', 'PAYMENT_DUE', 'GENERAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "walletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "bloodType" TEXT,
    "allergies" TEXT[],
    "insuranceId" TEXT,
    "insuranceProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "bio" TEXT,
    "yearsExperience" INTEGER,
    "consultationFee" DOUBLE PRECISION,
    "availableSlots" JSONB,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "acceptsInsurance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL DEFAULT 'consultation',
    "reason" TEXT,
    "notes" TEXT,
    "meetingUrl" TEXT,
    "transactionHash" TEXT,
    "paymentAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "diagnosis" TEXT,
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT,
    "instructions" TEXT,
    "quantity" INTEGER,
    "refills" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recordType" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "attachments" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "results" JSONB NOT NULL,
    "normalRange" JSONB,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "orderedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodPressure" TEXT,
    "heartRate" INTEGER,
    "temperature" DOUBLE PRECISION,
    "respiratoryRate" INTEGER,
    "oxygenSaturation" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionHash" TEXT,
    "network" TEXT NOT NULL DEFAULT 'base',
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_reviews" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentType" TEXT NOT NULL,
    "sessionData" JSONB NOT NULL,
    "messages" JSONB[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_team_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "manualStatus" TEXT NOT NULL DEFAULT 'running',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_team_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable

-- CreateTable
CREATE TABLE "care_team_audit" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "action" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorUserIdHash" TEXT NOT NULL,
    "metadataHash" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_team_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_team_rate_limits" (
    "key" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_team_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "openclaw_cron_runs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "requestedByRole" TEXT NOT NULL,
    "authSource" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "ok" BOOLEAN,
    "failureReason" TEXT,
    "httpStatus" INTEGER,
    "idempotencyKey" TEXT,
    "walletAddress" TEXT,
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "openclaw_cron_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "openclaw_worker_heartbeats" (
    "workerId" TEXT NOT NULL,
    "workerType" TEXT NOT NULL DEFAULT 'researcher-vm',
    "status" TEXT NOT NULL DEFAULT 'running',
    "metadata" JSONB,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "openclaw_worker_heartbeats_pkey" PRIMARY KEY ("workerId")
);

-- CreateTable
CREATE TABLE "ledger_payments" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "senderAddress" TEXT,
    "recipientAddress" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedAmount" TEXT NOT NULL,
    "settledAmount" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "txHash" TEXT,
    "status" TEXT NOT NULL,
    "verificationMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "refundedAmount" TEXT NOT NULL DEFAULT '0.00',

    CONSTRAINT "ledger_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_receipts" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "walletAddress" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "txHash" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "lineItems" JSONB NOT NULL,
    "complianceHash" TEXT NOT NULL,
    "attestationId" TEXT,

    CONSTRAINT "ledger_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_attestations" (
    "id" TEXT NOT NULL,
    "schema" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "attestor" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "chainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "txHash" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "receiptId" TEXT,
    "attestationId" TEXT,

    CONSTRAINT "ledger_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "description" TEXT NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "receiptId" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_actions" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'base',
    "tokenAddress" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "walletId" TEXT,
    "transactionHash" TEXT,
    "privyTransferId" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_applications" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "npi" TEXT,
    "licenseNumber" TEXT,
    "licenseState" TEXT,
    "licensedStates" TEXT[],
    "orderingCertifyingStatus" TEXT,
    "malpracticeCoverage" TEXT,
    "stateLicensureAttestation" BOOLEAN NOT NULL DEFAULT false,
    "orderingScopeAttestation" BOOLEAN NOT NULL DEFAULT false,
    "noAutoPrescriptionAttestation" BOOLEAN NOT NULL DEFAULT false,
    "malpracticeAttestation" BOOLEAN NOT NULL DEFAULT false,
    "specialtyOrRole" TEXT NOT NULL,
    "servicesSummary" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,

    CONSTRAINT "network_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'self_onboarded',
    "type" TEXT NOT NULL DEFAULT 'individual',
    "facilityType" TEXT,
    "name" TEXT NOT NULL,
    "taxonomy" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" JSONB,
    "serviceRadius" INTEGER,
    "insurance" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "telehealth" BOOLEAN NOT NULL DEFAULT false,
    "acceptingNew" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nppesMatched" BOOLEAN NOT NULL DEFAULT false,
    "nppesMatchedAt" TIMESTAMP(3),
    "nppesPracticeDomain" TEXT,
    "nppesSnapshotAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "listingSuppressed" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "identityProofingMethod" TEXT,
    "identityProofingAt" TIMESTAMP(3),
    "identityProofingVerifier" TEXT,
    "identityProofingReference" TEXT,
    "baaSigned" BOOLEAN NOT NULL DEFAULT false,
    "baaVersion" TEXT,
    "baaSignedAt" TIMESTAMP(3),
    "sanctionsStatus" TEXT NOT NULL DEFAULT 'not_run',
    "sanctionsSource" TEXT,
    "sanctionsCheckedAt" TIMESTAMP(3),
    "sanctionsDetails" JSONB,
    "licenseStatus" TEXT NOT NULL DEFAULT 'not_run',
    "licenseNumber" TEXT,
    "licenseState" TEXT,
    "licenseExpiresAt" TIMESTAMP(3),
    "licenseCheckedAt" TIMESTAMP(3),
    "licenseSource" TEXT,
    "licenseDetails" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_screen_results" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "screenType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL,
    "details" JSONB,

    CONSTRAINT "provider_screen_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "scopeHash" TEXT NOT NULL,
    "scopeSnapshot" JSONB NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_requests" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priorStatusBeforeInfoRequest" TEXT,
    "sharedDataScope" JSONB NOT NULL,
    "sharedDataScopeHash" TEXT NOT NULL,
    "disclosureTemplateId" TEXT NOT NULL,
    "disclosureTemplateVersion" TEXT NOT NULL,
    "consentId" TEXT,
    "baaVersion" TEXT,
    "futureDisclosuresBlocked" BOOLEAN NOT NULL DEFAULT false,
    "completionType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "consentTimestamp" TIMESTAMP(3),
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_audit_events" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "referralId" TEXT,
    "consentId" TEXT,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_notifications" (
    "id" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "deepLink" TEXT NOT NULL,
    "channelsSent" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_next_step_requests" (
    "id" TEXT NOT NULL,
    "internalUserId" TEXT NOT NULL,
    "walletHash" TEXT,
    "patientId" TEXT,
    "recommendationId" TEXT NOT NULL,
    "screeningName" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "patientNote" TEXT,
    "locationZip" TEXT,
    "clinicianSummary" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_next_step_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_timeline_events" (
    "id" TEXT NOT NULL,
    "internalUserId" TEXT NOT NULL,
    "patientId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_review_actions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable

-- CreateTable

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_userId_key" ON "patient_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_profiles_userId_key" ON "doctor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_profiles_licenseNumber_key" ON "doctor_profiles"("licenseNumber");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_doctorId_idx" ON "appointments"("doctorId");

-- CreateIndex
CREATE INDEX "appointments_scheduledAt_idx" ON "appointments"("scheduledAt");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_idx" ON "prescriptions"("patientId");

-- CreateIndex
CREATE INDEX "prescriptions_doctorId_idx" ON "prescriptions"("doctorId");

-- CreateIndex
CREATE INDEX "medications_prescriptionId_idx" ON "medications"("prescriptionId");

-- CreateIndex
CREATE INDEX "medical_records_patientId_idx" ON "medical_records"("patientId");

-- CreateIndex
CREATE INDEX "lab_results_patientId_idx" ON "lab_results"("patientId");

-- CreateIndex
CREATE INDEX "vital_signs_patientId_idx" ON "vital_signs"("patientId");

-- CreateIndex
CREATE INDEX "vital_signs_recordedAt_idx" ON "vital_signs"("recordedAt");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_receiverId_idx" ON "messages"("receiverId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "payments_appointmentId_key" ON "payments"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionHash_key" ON "payments"("transactionHash");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_transactionHash_idx" ON "payments"("transactionHash");

-- CreateIndex
CREATE INDEX "doctor_reviews_doctorId_idx" ON "doctor_reviews"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_reviews_doctorId_patientId_key" ON "doctor_reviews"("doctorId", "patientId");

-- CreateIndex
CREATE INDEX "agent_sessions_userId_idx" ON "agent_sessions"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "care_team_agents_status_idx" ON "care_team_agents"("status");

-- CreateIndex

-- CreateIndex

-- CreateIndex
CREATE INDEX "care_team_audit_requestId_idx" ON "care_team_audit"("requestId");

-- CreateIndex
CREATE INDEX "care_team_audit_timestamp_idx" ON "care_team_audit"("timestamp");

-- CreateIndex
CREATE INDEX "openclaw_cron_runs_jobId_createdAt_idx" ON "openclaw_cron_runs"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "openclaw_cron_runs_sessionId_idx" ON "openclaw_cron_runs"("sessionId");

-- CreateIndex
CREATE INDEX "openclaw_worker_heartbeats_lastSeenAt_idx" ON "openclaw_worker_heartbeats"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_payments_intentId_key" ON "ledger_payments"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_payments_txHash_key" ON "ledger_payments"("txHash");

-- CreateIndex
CREATE INDEX "ledger_payments_walletAddress_createdAt_idx" ON "ledger_payments"("walletAddress", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_payments_status_createdAt_idx" ON "ledger_payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_receipts_receiptNumber_key" ON "ledger_receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "ledger_receipts_walletAddress_issuedAt_idx" ON "ledger_receipts"("walletAddress", "issuedAt");

-- CreateIndex
CREATE INDEX "ledger_receipts_paymentId_idx" ON "ledger_receipts"("paymentId");

-- CreateIndex
CREATE INDEX "ledger_receipts_refundId_idx" ON "ledger_receipts"("refundId");

-- CreateIndex
CREATE INDEX "ledger_attestations_subjectType_subjectId_idx" ON "ledger_attestations"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ledger_attestations_createdAt_idx" ON "ledger_attestations"("createdAt");

-- CreateIndex
CREATE INDEX "ledger_refunds_paymentId_idx" ON "ledger_refunds"("paymentId");

-- CreateIndex
CREATE INDEX "ledger_refunds_walletAddress_requestedAt_idx" ON "ledger_refunds"("walletAddress", "requestedAt");

-- CreateIndex
CREATE INDEX "ledger_refunds_status_requestedAt_idx" ON "ledger_refunds"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "ledger_entries_createdAt_idx" ON "ledger_entries"("createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_paymentId_idx" ON "ledger_entries"("paymentId");

-- CreateIndex
CREATE INDEX "ledger_entries_refundId_idx" ON "ledger_entries"("refundId");

-- CreateIndex
CREATE INDEX "ledger_entries_receiptId_idx" ON "ledger_entries"("receiptId");

-- CreateIndex
CREATE INDEX "treasury_actions_status_createdAt_idx" ON "treasury_actions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "treasury_actions_createdAt_idx" ON "treasury_actions"("createdAt");

-- CreateIndex
CREATE INDEX "network_applications_status_submittedAt_idx" ON "network_applications"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "network_applications_role_status_idx" ON "network_applications"("role", "status");

-- CreateIndex
CREATE INDEX "network_applications_state_zip_idx" ON "network_applications"("state", "zip");

-- CreateIndex
CREATE INDEX "admin_notifications_adminId_isRead_createdAt_idx" ON "admin_notifications"("adminId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "admin_notifications_applicationId_idx" ON "admin_notifications"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "providers_npi_key" ON "providers"("npi");

-- CreateIndex
CREATE INDEX "providers_verificationStatus_active_idx" ON "providers"("verificationStatus", "active");

-- CreateIndex
CREATE INDEX "providers_source_listingSuppressed_idx" ON "providers"("source", "listingSuppressed");

-- CreateIndex
CREATE INDEX "providers_nppesSnapshotAt_idx" ON "providers"("nppesSnapshotAt");

-- CreateIndex
CREATE INDEX "providers_sanctionsStatus_sanctionsCheckedAt_idx" ON "providers"("sanctionsStatus", "sanctionsCheckedAt");

-- CreateIndex
CREATE INDEX "providers_licenseState_licenseNumber_idx" ON "providers"("licenseState", "licenseNumber");

-- CreateIndex
CREATE INDEX "provider_screen_results_providerId_screenType_runAt_idx" ON "provider_screen_results"("providerId", "screenType", "runAt");

-- CreateIndex
CREATE INDEX "provider_screen_results_status_runAt_idx" ON "provider_screen_results"("status", "runAt");

-- CreateIndex
CREATE INDEX "consents_patientId_providerId_grantedAt_idx" ON "consents"("patientId", "providerId", "grantedAt");

-- CreateIndex
CREATE INDEX "consents_scopeHash_idx" ON "consents"("scopeHash");

-- CreateIndex
CREATE INDEX "referral_requests_patientId_status_createdAt_idx" ON "referral_requests"("patientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "referral_requests_providerId_status_idx" ON "referral_requests"("providerId", "status");

-- CreateIndex
CREATE INDEX "referral_requests_recommendationId_idx" ON "referral_requests"("recommendationId");

-- CreateIndex
CREATE INDEX "provider_audit_events_providerId_createdAt_idx" ON "provider_audit_events"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_audit_events_referralId_createdAt_idx" ON "provider_audit_events"("referralId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_audit_events_eventType_createdAt_idx" ON "provider_audit_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "care_notifications_recipientType_recipientId_createdAt_idx" ON "care_notifications"("recipientType", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "care_notifications_eventType_createdAt_idx" ON "care_notifications"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_notifications_eventType_entityId_recipientId_key" ON "care_notifications"("eventType", "entityId", "recipientId");

-- CreateIndex
CREATE INDEX "screening_next_step_requests_internalUserId_createdAt_idx" ON "screening_next_step_requests"("internalUserId", "createdAt");

-- CreateIndex
CREATE INDEX "screening_next_step_requests_status_createdAt_idx" ON "screening_next_step_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "screening_next_step_requests_recommendationId_idx" ON "screening_next_step_requests"("recommendationId");

-- CreateIndex
CREATE INDEX "care_timeline_events_internalUserId_createdAt_idx" ON "care_timeline_events"("internalUserId", "createdAt");

-- CreateIndex
CREATE INDEX "care_timeline_events_referenceType_referenceId_idx" ON "care_timeline_events"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "admin_review_actions_applicationId_createdAt_idx" ON "admin_review_actions"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_review_actions_reviewer_createdAt_idx" ON "admin_review_actions"("reviewer", "createdAt");

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "network_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_screen_results" ADD CONSTRAINT "provider_screen_results_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_requests" ADD CONSTRAINT "referral_requests_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_requests" ADD CONSTRAINT "referral_requests_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "consents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_audit_events" ADD CONSTRAINT "provider_audit_events_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
