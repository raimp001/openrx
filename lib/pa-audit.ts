/**
 * PA Audit Trail
 * Immutable, append-only event log for prior authorization workflow.
 * HIPAA-ready: all events timestamped, actor-attributed, reason-captured.
 */

export type AuditActor = "patient" | "physician" | "payer" | "rex" | "system"
export type AuditEventType =
  | "PA_CREATED"
  | "PA_SUBMITTED"
  | "PA_STATUS_CHANGED"
  | "PA_APPROVED"
  | "PA_DENIED"
  | "APPEAL_INITIATED"
  | "APPEAL_SUBMITTED"
  | "APPEAL_APPROVED"
  | "APPEAL_DENIED"
  | "CRITERIA_CHECKED"
  | "FHIR_BUNDLE_SENT"
  | "PEER_TO_PEER_REQUESTED"
  | "PEER_TO_PEER_COMPLETED"
  | "DOCUMENT_UPLOADED"
  | "NOTE_ADDED"
  | "DEADLINE_REMINDER"
  | "ESCALATED"
  | "AI_RECOMMENDATION"

export interface AuditEvent {
  id: string
  paId: string
  type: AuditEventType
  actor: AuditActor
  actorName: string
  timestamp: string          // ISO 8601
  summary: string            // Human-readable description
  details?: Record<string, string | number | boolean | null>
  ipAddress?: string
  hipaaRelevant: boolean
  linkedDocumentId?: string
}

// ── Synthetic audit log for demo data ────────────────────────────────

export const PA_AUDIT_EVENTS: AuditEvent[] = [
  // PA-001: Teclistamab — Denied → Appeal cycle
  {
    id: "evt-001",
    paId: "pa-001",
    type: "PA_CREATED",
    actor: "physician",
    actorName: "Dr. Priya Patel",
    timestamp: "2024-10-28T09:15:00Z",
    summary: "PA created for Teclistamab (J9269) — Multiple Myeloma R/R",
    details: { procedureCode: "J9269", icd10: "C90.01", urgency: "urgent" },
    hipaaRelevant: true,
  },
  {
    id: "evt-002",
    paId: "pa-001",
    type: "CRITERIA_CHECKED",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-10-28T09:16:42Z",
    summary: "Criteria check: Score 72/100 — MODERATE likelihood. Missing: ECOG documentation.",
    details: { score: 72, likelihood: "MODERATE", missingCriteria: "ECOG PS documentation" },
    hipaaRelevant: false,
  },
  {
    id: "evt-003",
    paId: "pa-001",
    type: "AI_RECOMMENDATION",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-10-28T09:17:05Z",
    summary: "Rex recommended documenting ECOG PS score and prior therapy dates before submission",
    details: { recommendation: "Add ECOG score, confirm 4+ prior lines with dates" },
    hipaaRelevant: false,
  },
  {
    id: "evt-004",
    paId: "pa-001",
    type: "DOCUMENT_UPLOADED",
    actor: "physician",
    actorName: "Dr. Priya Patel",
    timestamp: "2024-10-28T10:02:00Z",
    summary: "Clinical documentation uploaded: ECOG PS 1, prior therapy summary",
    details: { documentType: "clinical_summary", pages: 3 },
    hipaaRelevant: true,
  },
  {
    id: "evt-005",
    paId: "pa-001",
    type: "FHIR_BUNDLE_SENT",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-10-28T10:04:17Z",
    summary: "FHIR Da Vinci PAS Bundle submitted to Aetna — Bundle ID: bdl-pas-20241028",
    details: { bundleId: "bdl-pas-20241028", endpoint: "/api/fhir/pas", fhirVersion: "R4" },
    hipaaRelevant: true,
  },
  {
    id: "evt-006",
    paId: "pa-001",
    type: "PA_SUBMITTED",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-10-28T10:04:18Z",
    summary: "PA submitted to Aetna. Reference: AET-2024-10-28-001. Expected decision: Nov 11, 2024.",
    details: { referenceNumber: "AET-2024-10-28-001", expectedDecision: "2024-11-11" },
    hipaaRelevant: true,
  },
  {
    id: "evt-007",
    paId: "pa-001",
    type: "PA_DENIED",
    actor: "payer",
    actorName: "Aetna Medical Review",
    timestamp: "2024-11-05T14:30:00Z",
    summary: "PA denied: Step therapy not met — lenalidomide trial duration insufficient (<16 weeks).",
    details: { denialCode: "ST-002", denialReason: "Step therapy requirement not met", reviewMD: "Dr. Smith (Aetna)" },
    hipaaRelevant: true,
  },
  {
    id: "evt-008",
    paId: "pa-001",
    type: "DEADLINE_REMINDER",
    actor: "system",
    actorName: "OpenRx System",
    timestamp: "2024-11-05T14:31:00Z",
    summary: "Appeal deadline calculated: Jan 4, 2025 (60 days). Rex flagged for urgent action.",
    details: { appealDeadline: "2025-01-04", daysRemaining: 60 },
    hipaaRelevant: false,
  },
  {
    id: "evt-009",
    paId: "pa-001",
    type: "APPEAL_INITIATED",
    actor: "patient",
    actorName: "James Thompson",
    timestamp: "2024-11-06T11:20:00Z",
    summary: "Patient initiated appeal generation via Claude Opus 4.6",
    details: { appealType: "standard", includeP2P: true, aiModel: "claude-opus-4-6" },
    hipaaRelevant: true,
  },
  {
    id: "evt-010",
    paId: "pa-001",
    type: "AI_RECOMMENDATION",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-11-06T11:20:45Z",
    summary: "Appeal generated with MajesTEC-1 trial citations. P2P request included. Reversal probability: HIGH.",
    details: { citedTrials: "MajesTEC-1 (NEJM 2022)", tokensUsed: 3240, thinkingEnabled: true },
    hipaaRelevant: false,
  },
  {
    id: "evt-011",
    paId: "pa-001",
    type: "PEER_TO_PEER_REQUESTED",
    actor: "physician",
    actorName: "Dr. Priya Patel",
    timestamp: "2024-11-06T14:00:00Z",
    summary: "P2P review requested with Aetna Medical Director. Call scheduled: Nov 12, 2024 10:00 AM.",
    details: { scheduledDate: "2024-11-12T10:00:00Z", payerMD: "Dr. Johnson (Aetna Oncology)" },
    hipaaRelevant: true,
  },
  {
    id: "evt-012",
    paId: "pa-001",
    type: "PEER_TO_PEER_COMPLETED",
    actor: "physician",
    actorName: "Dr. Priya Patel",
    timestamp: "2024-11-12T10:42:00Z",
    summary: "P2P completed — 42 min call. Payer MD agreed patient meets criteria. Awaiting formal reversal.",
    details: { callDurationMinutes: 42, outcome: "favorable", notes: "Presented MajesTEC-1 OS data" },
    hipaaRelevant: true,
  },
  {
    id: "evt-013",
    paId: "pa-001",
    type: "APPEAL_APPROVED",
    actor: "payer",
    actorName: "Aetna Medical Review",
    timestamp: "2024-11-14T09:15:00Z",
    summary: "Appeal approved. PA reversed. Teclistamab authorized: 12 months, step-up dosing per REMS.",
    details: { authorizationNumber: "AET-AUTH-2024-11-14-001", validThrough: "2025-11-14", remsEnrollmentRequired: true },
    hipaaRelevant: true,
  },

  // PA-002: Pembrolizumab — Active/Pending
  {
    id: "evt-020",
    paId: "pa-002",
    type: "PA_CREATED",
    actor: "physician",
    actorName: "Dr. James Chen",
    timestamp: "2024-11-15T08:30:00Z",
    summary: "PA created for Pembrolizumab (Keytruda) — NSCLC first-line",
    details: { procedureCode: "J9271", icd10: "C34.10", pdl1Status: "pending" },
    hipaaRelevant: true,
  },
  {
    id: "evt-021",
    paId: "pa-002",
    type: "CRITERIA_CHECKED",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-11-15T08:31:15Z",
    summary: "Criteria check: Score 58/100 — MODERATE. Missing: PD-L1 TPS result, EGFR/ALK status.",
    details: { score: 58, missingCriteria: "PD-L1 IHC result, EGFR/ALK mutation testing" },
    hipaaRelevant: false,
  },
  {
    id: "evt-022",
    paId: "pa-002",
    type: "AI_RECOMMENDATION",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-11-15T08:31:45Z",
    summary: "Rex recommended ordering PD-L1 IHC 22C3 and comprehensive NGS panel before PA submission",
    hipaaRelevant: false,
  },
  {
    id: "evt-023",
    paId: "pa-002",
    type: "PA_SUBMITTED",
    actor: "physician",
    actorName: "Dr. James Chen",
    timestamp: "2024-11-20T11:00:00Z",
    summary: "PA submitted to UnitedHealthcare with updated PD-L1 (TPS 65%) and EGFR/ALK negative results.",
    details: { pdl1Tps: 65, egfrStatus: "wild-type", alkStatus: "negative", referenceNumber: "UHC-2024-11-20-042" },
    hipaaRelevant: true,
  },

  // PA-003: Semaglutide — Approved
  {
    id: "evt-030",
    paId: "pa-003",
    type: "PA_CREATED",
    actor: "physician",
    actorName: "Dr. Lisa Nguyen",
    timestamp: "2024-09-10T13:00:00Z",
    summary: "PA created for Semaglutide (Ozempic) — Type 2 DM with cardiovascular risk",
    details: { procedureCode: "J3490", icd10: "E11.9", a1c: 8.4, bmi: 31.2 },
    hipaaRelevant: true,
  },
  {
    id: "evt-031",
    paId: "pa-003",
    type: "CRITERIA_CHECKED",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-09-10T13:01:00Z",
    summary: "Criteria check: Score 91/100 — HIGH likelihood. All criteria met. Metformin trial documented.",
    details: { score: 91, likelihood: "HIGH" },
    hipaaRelevant: false,
  },
  {
    id: "evt-032",
    paId: "pa-003",
    type: "PA_SUBMITTED",
    actor: "rex",
    actorName: "Rex (AI)",
    timestamp: "2024-09-10T13:05:00Z",
    summary: "PA auto-submitted to Cigna via FHIR Da Vinci PAS. Metformin failure documentation included.",
    details: { bundleId: "bdl-pas-20240910", referenceNumber: "CGN-2024-09-10-017" },
    hipaaRelevant: true,
  },
  {
    id: "evt-033",
    paId: "pa-003",
    type: "PA_APPROVED",
    actor: "payer",
    actorName: "Cigna Medical Review",
    timestamp: "2024-09-14T10:00:00Z",
    summary: "PA approved. Semaglutide 0.5–2mg/week authorized for 12 months.",
    details: { authorizationNumber: "CGN-AUTH-2024-09-14-017", validThrough: "2025-09-14" },
    hipaaRelevant: true,
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────

export function getAuditEvents(paId: string): AuditEvent[] {
  return PA_AUDIT_EVENTS.filter((e) => e.paId === paId).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

export function getAllAuditEvents(): AuditEvent[] {
  return [...PA_AUDIT_EVENTS].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

export const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  PA_CREATED: "PA Created",
  PA_SUBMITTED: "Submitted",
  PA_STATUS_CHANGED: "Status Changed",
  PA_APPROVED: "Approved",
  PA_DENIED: "Denied",
  APPEAL_INITIATED: "Appeal Started",
  APPEAL_SUBMITTED: "Appeal Submitted",
  APPEAL_APPROVED: "Appeal Approved",
  APPEAL_DENIED: "Appeal Denied",
  CRITERIA_CHECKED: "Criteria Check",
  FHIR_BUNDLE_SENT: "FHIR Sent",
  PEER_TO_PEER_REQUESTED: "P2P Requested",
  PEER_TO_PEER_COMPLETED: "P2P Completed",
  DOCUMENT_UPLOADED: "Document Uploaded",
  NOTE_ADDED: "Note Added",
  DEADLINE_REMINDER: "Deadline Reminder",
  ESCALATED: "Escalated",
  AI_RECOMMENDATION: "AI Recommendation",
}

export const EVENT_TYPE_COLORS: Record<AuditEventType, string> = {
  PA_CREATED: "text-warm-600 bg-sand/40",
  PA_SUBMITTED: "text-soft-blue bg-soft-blue/10",
  PA_STATUS_CHANGED: "text-warm-500 bg-sand/30",
  PA_APPROVED: "text-accent bg-accent/10",
  PA_DENIED: "text-soft-red bg-soft-red/10",
  APPEAL_INITIATED: "text-yellow-600 bg-yellow-100/50",
  APPEAL_SUBMITTED: "text-yellow-700 bg-yellow-100/60",
  APPEAL_APPROVED: "text-accent bg-accent/10",
  APPEAL_DENIED: "text-soft-red bg-soft-red/10",
  CRITERIA_CHECKED: "text-terra bg-terra/10",
  FHIR_BUNDLE_SENT: "text-soft-blue bg-soft-blue/10",
  PEER_TO_PEER_REQUESTED: "text-purple-600 bg-purple-100/50",
  PEER_TO_PEER_COMPLETED: "text-purple-700 bg-purple-100/60",
  DOCUMENT_UPLOADED: "text-warm-600 bg-sand/30",
  NOTE_ADDED: "text-warm-500 bg-sand/20",
  DEADLINE_REMINDER: "text-yellow-600 bg-yellow-100/40",
  ESCALATED: "text-soft-red bg-soft-red/10",
  AI_RECOMMENDATION: "text-terra bg-terra/10",
}

export const ACTOR_COLORS: Record<AuditActor, string> = {
  patient: "bg-soft-blue/10 text-soft-blue",
  physician: "bg-accent/10 text-accent",
  payer: "bg-warm-200 text-warm-700",
  rex: "bg-terra/10 text-terra",
  system: "bg-sand text-cloudy",
}
