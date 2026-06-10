-- Provider onboarding, sanctions/licensure screening, deterministic referral disclosure, and referral state audit.

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  npi TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'self_onboarded',
  type TEXT NOT NULL DEFAULT 'individual',
  "facilityType" TEXT,
  name TEXT NOT NULL,
  taxonomy TEXT,
  services TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  location JSONB,
  "serviceRadius" INTEGER,
  insurance TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  telehealth BOOLEAN NOT NULL DEFAULT FALSE,
  "acceptingNew" BOOLEAN NOT NULL DEFAULT FALSE,
  languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "nppesMatched" BOOLEAN NOT NULL DEFAULT FALSE,
  "nppesMatchedAt" TIMESTAMPTZ,
  "nppesPracticeDomain" TEXT,
  "nppesSnapshotAt" TIMESTAMPTZ,
  "claimedAt" TIMESTAMPTZ,
  "listingSuppressed" BOOLEAN NOT NULL DEFAULT FALSE,
  "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
  "identityProofingMethod" TEXT,
  "identityProofingAt" TIMESTAMPTZ,
  "identityProofingVerifier" TEXT,
  "identityProofingReference" TEXT,
  "baaSigned" BOOLEAN NOT NULL DEFAULT FALSE,
  "baaVersion" TEXT,
  "baaSignedAt" TIMESTAMPTZ,
  "sanctionsStatus" TEXT NOT NULL DEFAULT 'not_run',
  "sanctionsSource" TEXT,
  "sanctionsCheckedAt" TIMESTAMPTZ,
  "sanctionsDetails" JSONB,
  "licenseStatus" TEXT NOT NULL DEFAULT 'not_run',
  "licenseNumber" TEXT,
  "licenseState" TEXT,
  "licenseExpiresAt" TIMESTAMPTZ,
  "licenseCheckedAt" TIMESTAMPTZ,
  "licenseSource" TEXT,
  "licenseDetails" JSONB,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  badges TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE providers ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self_onboarded';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS "nppesSnapshotAt" TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS "listingSuppressed" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS providers_verification_status_active_idx ON providers ("verificationStatus", active);
CREATE INDEX IF NOT EXISTS providers_source_suppressed_idx ON providers (source, "listingSuppressed");
CREATE INDEX IF NOT EXISTS providers_nppes_snapshot_idx ON providers ("nppesSnapshotAt");
CREATE INDEX IF NOT EXISTS providers_sanctions_status_checked_idx ON providers ("sanctionsStatus", "sanctionsCheckedAt");
CREATE INDEX IF NOT EXISTS providers_license_state_number_idx ON providers ("licenseState", "licenseNumber");

CREATE TABLE IF NOT EXISTS provider_screen_results (
  id TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  "screenType" TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  "sourceVersion" TEXT,
  "runAt" TIMESTAMPTZ NOT NULL,
  details JSONB
);

CREATE INDEX IF NOT EXISTS provider_screen_results_provider_type_run_idx ON provider_screen_results ("providerId", "screenType", "runAt");
CREATE INDEX IF NOT EXISTS provider_screen_results_status_run_idx ON provider_screen_results (status, "runAt");

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  "scopeHash" TEXT NOT NULL,
  "scopeSnapshot" JSONB NOT NULL,
  "grantedAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS consents_patient_provider_granted_idx ON consents ("patientId", "providerId", "grantedAt");
CREATE INDEX IF NOT EXISTS consents_scope_hash_idx ON consents ("scopeHash");

CREATE TABLE IF NOT EXISTS referral_requests (
  id TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  "recommendationId" TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  "priorStatusBeforeInfoRequest" TEXT,
  "sharedDataScope" JSONB NOT NULL,
  "sharedDataScopeHash" TEXT NOT NULL,
  "disclosureTemplateId" TEXT NOT NULL,
  "disclosureTemplateVersion" TEXT NOT NULL,
  "consentId" TEXT REFERENCES consents(id) ON DELETE SET NULL,
  "baaVersion" TEXT,
  "futureDisclosuresBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "completionType" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "acceptedAt" TIMESTAMPTZ,
  "scheduledAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "consentTimestamp" TIMESTAMPTZ,
  history JSONB NOT NULL DEFAULT '[]'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_requests_patient_status_created_idx ON referral_requests ("patientId", status, "createdAt");
CREATE INDEX IF NOT EXISTS referral_requests_provider_status_idx ON referral_requests ("providerId", status);
CREATE INDEX IF NOT EXISTS referral_requests_recommendation_idx ON referral_requests ("recommendationId");

CREATE TABLE IF NOT EXISTS provider_audit_events (
  id TEXT PRIMARY KEY,
  "providerId" TEXT REFERENCES providers(id) ON DELETE SET NULL,
  "referralId" TEXT,
  "consentId" TEXT,
  "eventType" TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_audit_events_provider_created_idx ON provider_audit_events ("providerId", "createdAt");
CREATE INDEX IF NOT EXISTS provider_audit_events_referral_created_idx ON provider_audit_events ("referralId", "createdAt");
CREATE INDEX IF NOT EXISTS provider_audit_events_type_created_idx ON provider_audit_events ("eventType", "createdAt");

CREATE TABLE IF NOT EXISTS care_notifications (
  id TEXT PRIMARY KEY,
  "recipientType" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "deepLink" TEXT NOT NULL,
  "channelsSent" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT care_notifications_event_entity_recipient_key UNIQUE ("eventType", "entityId", "recipientId")
);

CREATE INDEX IF NOT EXISTS care_notifications_recipient_created_idx ON care_notifications ("recipientType", "recipientId", "createdAt");
CREATE INDEX IF NOT EXISTS care_notifications_event_created_idx ON care_notifications ("eventType", "createdAt");
