// Clinician call types — privacy-preserving outbound calling.
//
// The clinician's personal phone number is NEVER exposed to the patient.
// Telephony providers must place the call from an OpenRx-owned masked number
// (caller ID) and bridge it to the clinician's device. Only the masked number
// is shared with the patient and persisted in any patient-facing record.

export type CallOutcome =
  | "reached_patient"
  | "left_voicemail"
  | "no_answer"
  | "wrong_number"
  | "needs_callback"
  | "patient_declined"
  | "abandoned"

export type CallSessionStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"

export type CallNextStep =
  | "schedule_appointment"
  | "order_screening_study"
  | "send_instructions"
  | "route_to_care_team"
  | "create_reminder"
  | "refer_specialist"
  | "no_action"

export interface MaskedCallerId {
  // Display label shown to the clinician (e.g. "OpenRx Care Line — Boston").
  label: string
  // The full masked number that the patient will see on caller ID.
  // This is an OpenRx-controlled telephony number, NOT the clinician's number.
  maskedNumber: string
}

export interface CallSessionRequest {
  // Internal patient identifier — never an unencrypted phone number alone.
  patientRef: string
  patientDisplayName?: string
  // E.164 phone (e.g. "+15551234567"). Validated server-side.
  patientPhone: string
  // Soft consent attestation: the clinician confirms patient consent before placing the call.
  consentAttested: boolean
  // Reason for outreach (free text, kept short to limit PHI surface).
  reason: string
  // Caller ID label or raw masked number. The provider resolves to a masked
  // OpenRx-owned number — clinician's personal number is never sent.
  callerIdLabel?: string
  // Whether call recording is enabled for this org/policy.
  recordCall?: boolean
}

export interface CallSession {
  id: string
  status: CallSessionStatus
  patientRef: string
  patientDisplayName?: string
  // Last 4 digits only — full number is never stored client-side.
  patientPhoneMasked: string
  callerId: MaskedCallerId
  reason: string
  recordCall: boolean
  consentAttested: boolean
  createdAt: number
  startedAt?: number
  endedAt?: number
  // Documentation captured after the call.
  outcome?: CallOutcome
  notes?: string
  nextSteps?: CallNextStep[]
  // Provider-specific identifier (e.g. Twilio CallSid). Internal use only.
  providerSessionId?: string
  // Provider key (e.g. "mock", "twilio").
  providerKey: string
}

export interface CallProviderCapabilities {
  // True only when the provider is fully configured AND the org has signed a BAA.
  liveCallingEnabled: boolean
  // Surface to the clinician why live calling is or is not available.
  setupMessage: string
  // Available masked caller IDs (the patient sees one of these).
  callerIds: MaskedCallerId[]
}

export interface CallProvider {
  readonly key: string
  capabilities(): CallProviderCapabilities
  startCall(input: CallSessionRequest): Promise<CallSession>
  endCall(sessionId: string): Promise<CallSession>
  getCall(sessionId: string): Promise<CallSession | null>
  documentCall(input: {
    sessionId: string
    outcome: CallOutcome
    notes?: string
    nextSteps?: CallNextStep[]
  }): Promise<CallSession>
  listRecent(limit?: number): Promise<CallSession[]>
}

// Production telephony providers (Twilio, Bandwidth, etc.) require:
//   1. A signed Business Associate Agreement (BAA) — HIPAA-eligible accounts only.
//   2. Masked numbers provisioned and assigned per clinic/site.
//   3. Outbound caller ID verification.
//   4. Call recording consent flow per US state two-party consent rules.
//   5. Call detail record (CDR) export to OpenRx audit log.
//   6. Per-clinician rate limiting + abuse detection.
//   7. Documented retention/deletion policy.
// Until all of the above are in place, only the mock provider is allowed.
