import { expect, test } from "@playwright/test"
import {
  expireReferralIfNeeded,
  isFutureDisclosureAllowed,
  transitionReferral,
  type ReferralEvent,
  type ReferralStateRecord,
  type ReferralStatus,
} from "@/lib/referral-state-machine"

const NOW = new Date("2026-06-09T12:00:00.000Z")
const LATER = new Date("2026-06-12T12:00:00.000Z")

const ALL_EVENTS: ReferralEvent[] = [
  "provider_accept",
  "provider_decline",
  "provider_request_info",
  "patient_respond_info",
  "provider_propose_times",
  "provider_attest_complete",
  "patient_report_complete",
  "patient_cancel",
  "expire",
  "consent_revoke",
]

const LEGAL_EVENTS: Record<ReferralStatus, ReferralEvent[]> = {
  requested: ["provider_accept", "provider_decline", "provider_request_info", "patient_cancel", "expire", "consent_revoke"],
  accepted: ["provider_decline", "provider_request_info", "provider_propose_times", "patient_cancel", "expire", "consent_revoke"],
  info_requested: ["patient_respond_info", "patient_cancel", "expire", "consent_revoke"],
  scheduled: ["provider_attest_complete", "patient_report_complete", "patient_cancel", "consent_revoke"],
  completed_provider_attested: [],
  completed_patient_reported: [],
  declined: [],
  expired: [],
  cancelled: [],
  consent_revoked: [],
  halted_provider_ineligible: [],
}

function referral(status: ReferralStatus, overrides: Partial<ReferralStateRecord> = {}): ReferralStateRecord {
  return {
    id: `ref_${status}`,
    status,
    history: [],
    ...overrides,
  }
}

function legalSeed(status: ReferralStatus): ReferralStateRecord {
  if (status === "info_requested") {
    return referral(status, { priorStatusBeforeInfoRequest: "accepted", infoRequestedAt: NOW.toISOString() })
  }
  if (status === "accepted") {
    return referral(status, { acceptedAt: NOW.toISOString() })
  }
  if (status === "scheduled") {
    return referral(status, { acceptedAt: NOW.toISOString(), scheduledAt: NOW.toISOString() })
  }
  return referral(status)
}

test("info-request flow returns to the prior state and has its own expiry", () => {
  const accepted = transitionReferral(referral("requested"), "provider_accept", {
    actor: "provider",
    now: NOW,
    expiry: { acceptedSchedulingExpiryHours: 24 },
  })
  const infoRequested = transitionReferral(accepted, "provider_request_info", {
    actor: "provider",
    now: NOW,
    expiry: { infoRequestExpiryHours: 6 },
  })

  expect(infoRequested.status).toBe("info_requested")
  expect(infoRequested.priorStatusBeforeInfoRequest).toBe("accepted")
  expect(infoRequested.expiresAt).toBe("2026-06-09T18:00:00.000Z")

  const responded = transitionReferral(infoRequested, "patient_respond_info", {
    actor: "patient",
    now: NOW,
    expiry: { acceptedSchedulingExpiryHours: 24 },
  })

  expect(responded.status).toBe("accepted")
  expect(responded.priorStatusBeforeInfoRequest).toBeUndefined()
  expect(responded.expiresAt).toBe("2026-06-10T12:00:00.000Z")
})

test("accepted referrals expire when no times are proposed", () => {
  const accepted = transitionReferral(referral("requested"), "provider_accept", {
    actor: "provider",
    now: NOW,
    expiry: { acceptedSchedulingExpiryHours: 24 },
  })
  const expired = expireReferralIfNeeded(accepted, { now: LATER })

  expect(expired.status).toBe("expired")
  expect(expired.history.at(-1)).toMatchObject({
    event: "expire",
    metadata: { notifyPatient: true, resurfaceAlternatives: true },
  })
})

test("patient cancellation is valid from all in-flight states", () => {
  const inFlight: ReferralStateRecord[] = [
    referral("requested"),
    referral("accepted"),
    referral("info_requested", { priorStatusBeforeInfoRequest: "requested" }),
    referral("scheduled"),
  ]

  for (const current of inFlight) {
    const cancelled = transitionReferral(current, "patient_cancel", { actor: "patient", now: NOW })
    expect(cancelled.status).toBe("cancelled")
  }
})

test("completion sub-states are distinct and auditable", () => {
  const scheduled = referral("scheduled")
  const providerCompleted = transitionReferral(scheduled, "provider_attest_complete", {
    actor: "provider",
    now: NOW,
  })
  const patientCompleted = transitionReferral(scheduled, "patient_report_complete", {
    actor: "patient",
    now: NOW,
  })

  expect(providerCompleted).toMatchObject({
    status: "completed_provider_attested",
    completionType: "provider_attested",
  })
  expect(patientCompleted).toMatchObject({
    status: "completed_patient_reported",
    completionType: "patient_reported",
  })
})

test("consent revocation blocks future disclosure and is terminal", () => {
  const revoked = transitionReferral(referral("accepted"), "consent_revoke", {
    actor: "patient",
    now: NOW,
  })

  expect(revoked.status).toBe("consent_revoked")
  expect(revoked.futureDisclosuresBlocked).toBe(true)
  expect(isFutureDisclosureAllowed(revoked)).toBe(false)
  expect(() => transitionReferral(revoked, "provider_propose_times", { actor: "provider", now: NOW })).toThrow()
})

test("state machine accepts legal transitions and rejects illegal ones", () => {
  for (const status of Object.keys(LEGAL_EVENTS) as ReferralStatus[]) {
    for (const event of ALL_EVENTS) {
      const seed = legalSeed(status)
      const shouldBeLegal = LEGAL_EVENTS[status].includes(event)
      if (shouldBeLegal) {
        expect(() => transitionReferral(seed, event, { actor: "test", now: NOW })).not.toThrow()
      } else {
        expect(() => transitionReferral(seed, event, { actor: "test", now: NOW })).toThrow()
      }
    }
  }
})
