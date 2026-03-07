-- AI Care Team Command Center audit tables (hashed references only)

CREATE TABLE IF NOT EXISTS care_team_requests (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('needs_input','resolved')),
  workflow TEXT NOT NULL,
  patient_id_hash TEXT NOT NULL,
  claim_id_hash TEXT,
  record_id_hash TEXT,
  reason TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  document_snapshot_hash TEXT,
  confidence_score NUMERIC,
  browser_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IN ('approve','reject','edit')),
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_care_team_requests_agent_id ON care_team_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_care_team_requests_status ON care_team_requests(status);
CREATE INDEX IF NOT EXISTS idx_care_team_requests_patient_hash ON care_team_requests(patient_id_hash);
CREATE INDEX IF NOT EXISTS idx_care_team_requests_created_at ON care_team_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS care_team_audit_log (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  action TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_user_id_hash TEXT NOT NULL,
  metadata_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_team_audit_request_id ON care_team_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_care_team_audit_action ON care_team_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_care_team_audit_created_at ON care_team_audit_log(created_at DESC);

-- NOTE:
-- The application currently uses file-backed durable storage for compatibility
-- with environments that are not yet migrated. This SQL is the production DB target.
