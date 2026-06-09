// PHI-free structured logging for the orchestrator.
//
// HARD RULE: only enumerated codes, identifiers, booleans, and numbers may be
// logged. Never raw patient input, parsed profiles, free text, or model
// output — the type below makes a free-text field a compile error.

export type RequestOutcome =
  | "success"
  | "deterministic"
  | "fallback"
  | "clinician_route"
  | "error"

export interface AgentRequestLog {
  requestId: string
  /** Agent the caller asked for. */
  requestedAgentId: string
  /** Agent that actually produced the response (route taken). */
  routedAgentId: string
  outcome: RequestOutcome
  latencyMs: number
  /** Guideline engine version when a deterministic engine produced the answer. */
  engineVersion?: string
  /** Whether a model API key was configured for this request. */
  modelConfigured: boolean
}

export function logAgentRequest(entry: AgentRequestLog): void {
  console.log(JSON.stringify({ event: "agent_request", ...entry }))
}
