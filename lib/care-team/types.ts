export type CareTeamAgentStatus = "running" | "paused" | "needs_input"

export type CareTeamWorkflow =
  | "prior_auth"
  | "billing"
  | "rx"
  | "scheduling"
  | "triage"
  | "compliance"
  | "onboarding"
  | "coordination"
  | "general"

export type CareTeamDecision = "approve" | "reject" | "edit"

export interface CareTeamBrowserHint {
  url?: string
  highlightSelector?: string
  note?: string
}

export interface CareTeamRequestContext {
  patientIdHash: string
  claimIdHash?: string
  recordIdHash?: string
  reason: string
  suggestedAction: string
  documentSnapshotHash?: string
  workflow: CareTeamWorkflow
  confidenceScore?: number
  browser?: CareTeamBrowserHint
}

export interface AgentNotifyPayload {
  agent_id: string
  agent_name: string
  status: CareTeamAgentStatus
  context?: {
    patient_id_hash?: string
    patient_id?: string
    claim_id_hash?: string
    record_id_hash?: string
    reason?: string
    suggested_action?: string
    document_snapshot_hash?: string
    workflow?: CareTeamWorkflow
    confidence_score?: number
    browser_url?: string
    highlight_selector?: string
    browser_note?: string
  }
  timestamp?: string
}

export interface CareTeamAgent {
  id: string
  name: string
  role: string
  status: CareTeamAgentStatus
  unreadCount: number
  isCore: boolean
  updatedAt: string
}

export interface CareTeamHumanInputRequest {
  id: string
  agentId: string
  agentName: string
  status: "needs_input" | "resolved"
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolution?: CareTeamDecision
  resolutionNote?: string
  context: CareTeamRequestContext
}

export interface CareTeamAuditEntry {
  id: string
  requestId?: string
  action: string
  actorRole: "admin" | "staff" | "service" | "patient"
  actorUserIdHash: string
  metadataHash: string
  timestamp: string
}

export interface CareTeamStateSnapshot {
  agents: CareTeamAgent[]
  openRequests: CareTeamHumanInputRequest[]
  recentAudit: CareTeamAuditEntry[]
  needsInputCount: number
  lastUpdated: string
}

export interface CareTeamEvent {
  eventId: string
  type: "request_created" | "request_resolved" | "agent_status"
  timestamp: string
  payload: {
    request?: CareTeamHumanInputRequest
    agent?: CareTeamAgent
    needsInputCount: number
  }
}

export interface CareTeamResolveInput {
  requestId: string
  decision: CareTeamDecision
  note?: string
  editedSuggestedAction?: string
  browserUrl?: string
}

export interface CareTeamCustomAgentInput {
  id?: string
  name: string
  role: string
}
