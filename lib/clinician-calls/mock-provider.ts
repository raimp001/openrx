import type {
  CallNextStep,
  CallOutcome,
  CallProvider,
  CallProviderCapabilities,
  CallSession,
  CallSessionRequest,
} from "./types"
import { maskFull, normalizePhone, shortId } from "./utils"

// In-process mock store. Suitable only for development and Playwright tests.
// Production must use a HIPAA-eligible telephony backend with persistent
// CDR storage; the mock provider intentionally does not persist across restarts.
const sessions = new Map<string, CallSession>()

const DEFAULT_CALLER_IDS = [
  { label: "OpenRx Care Line", maskedNumber: "+1 (555) 010-2000" },
  { label: "OpenRx Clinic — Direct", maskedNumber: "+1 (555) 010-2001" },
  { label: "OpenRx After-hours", maskedNumber: "+1 (555) 010-2002" },
]

function liveCallingFlag(): boolean {
  // Live calling is only enabled when explicitly opted in AND a HIPAA-eligible
  // provider key is configured. The mock provider always reports false to keep
  // the UI honest about what is currently wired up.
  return false
}

export function createMockCallProvider(): CallProvider {
  const capabilities = (): CallProviderCapabilities => ({
    liveCallingEnabled: liveCallingFlag(),
    setupMessage:
      "Live patient calling is disabled. To enable: configure a HIPAA-eligible " +
      "telephony provider (Twilio, Bandwidth) with a signed BAA, provision masked " +
      "OpenRx caller IDs, and set OPENRX_CALL_PROVIDER=twilio with the required keys.",
    callerIds: DEFAULT_CALLER_IDS,
  })

  return {
    key: "mock",
    capabilities,
    async startCall(input: CallSessionRequest): Promise<CallSession> {
      if (!input.consentAttested) {
        throw new Error("Patient consent must be attested before placing a call.")
      }
      const phone = normalizePhone(input.patientPhone)
      if (!phone) {
        throw new Error("Invalid patient phone number — expected E.164 format (e.g. +15551234567).")
      }
      const callerId =
        DEFAULT_CALLER_IDS.find((c) => c.label === input.callerIdLabel) || DEFAULT_CALLER_IDS[0]

      const id = shortId("call")
      const now = Date.now()
      const session: CallSession = {
        id,
        status: "ringing",
        patientRef: input.patientRef,
        patientDisplayName: input.patientDisplayName,
        patientPhoneMasked: maskFull(phone.e164),
        callerId,
        reason: input.reason.slice(0, 240),
        recordCall: Boolean(input.recordCall),
        consentAttested: true,
        createdAt: now,
        startedAt: now,
        providerSessionId: `mock_${id}`,
        providerKey: "mock",
      }
      sessions.set(id, session)

      // Mock state machine: ringing → in_progress shortly after, so the UI can
      // demonstrate the lifecycle without involving real telephony.
      setTimeout(() => {
        const current = sessions.get(id)
        if (current && current.status === "ringing") {
          sessions.set(id, { ...current, status: "in_progress" })
        }
      }, 1500)

      return session
    },
    async endCall(sessionId: string): Promise<CallSession> {
      const current = sessions.get(sessionId)
      if (!current) throw new Error("Call session not found.")
      const ended: CallSession = {
        ...current,
        status: "completed",
        endedAt: Date.now(),
      }
      sessions.set(sessionId, ended)
      return ended
    },
    async getCall(sessionId: string): Promise<CallSession | null> {
      return sessions.get(sessionId) ?? null
    },
    async documentCall(input: {
      sessionId: string
      outcome: CallOutcome
      notes?: string
      nextSteps?: CallNextStep[]
    }): Promise<CallSession> {
      const current = sessions.get(input.sessionId)
      if (!current) throw new Error("Call session not found.")
      const documented: CallSession = {
        ...current,
        status: current.status === "completed" ? "completed" : "completed",
        endedAt: current.endedAt ?? Date.now(),
        outcome: input.outcome,
        notes: input.notes?.slice(0, 2000),
        nextSteps: input.nextSteps?.slice(0, 8),
      }
      sessions.set(input.sessionId, documented)
      return documented
    },
    async listRecent(limit = 20): Promise<CallSession[]> {
      const all = Array.from(sessions.values())
      all.sort((a, b) => b.createdAt - a.createdAt)
      return all.slice(0, limit)
    },
  }
}
