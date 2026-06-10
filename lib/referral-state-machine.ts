export type ReferralStatus =
  | "requested"
  | "accepted"
  | "info_requested"
  | "scheduled"
  | "completed_provider_attested"
  | "completed_patient_reported"
  | "declined"
  | "expired"
  | "cancelled"
  | "consent_revoked"
  | "halted_provider_ineligible"

export type ReferralEvent =
  | "provider_accept"
  | "provider_decline"
  | "provider_request_info"
  | "patient_respond_info"
  | "provider_propose_times"
  | "provider_attest_complete"
  | "patient_report_complete"
  | "patient_cancel"
  | "expire"
  | "consent_revoke"

export interface ReferralTransitionAudit {
  event: ReferralEvent
  from: ReferralStatus
  to: ReferralStatus
  actor: string
  at: string
  metadata?: Record<string, unknown>
}

export interface ReferralStateRecord {
  id: string
  status: ReferralStatus
  priorStatusBeforeInfoRequest?: ReferralStatus
  acceptedAt?: string
  infoRequestedAt?: string
  scheduledAt?: string
  completedAt?: string
  expiresAt?: string
  futureDisclosuresBlocked?: boolean
  completionType?: "provider_attested" | "patient_reported"
  history: ReferralTransitionAudit[]
}

export interface ReferralExpiryConfig {
  infoRequestExpiryHours: number
  acceptedSchedulingExpiryHours: number
}

const DEFAULT_EXPIRY: ReferralExpiryConfig = {
  infoRequestExpiryHours: 72,
  acceptedSchedulingExpiryHours: 48,
}

const TERMINAL_STATUSES = new Set<ReferralStatus>([
  "completed_provider_attested",
  "completed_patient_reported",
  "declined",
  "expired",
  "cancelled",
  "consent_revoked",
  "halted_provider_ineligible",
])

function iso(now: Date): string {
  return now.toISOString()
}

function addHours(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
}

function withAudit(
  referral: ReferralStateRecord,
  event: ReferralEvent,
  to: ReferralStatus,
  actor: string,
  now: Date,
  metadata?: Record<string, unknown>
): ReferralStateRecord {
  return {
    ...referral,
    status: to,
    history: [
      ...referral.history,
      {
        event,
        from: referral.status,
        to,
        actor,
        at: iso(now),
        metadata,
      },
    ],
  }
}

function ensureNotTerminal(referral: ReferralStateRecord, event: ReferralEvent) {
  if (TERMINAL_STATUSES.has(referral.status)) {
    throw new Error(`Illegal referral transition: ${event} from terminal status ${referral.status}.`)
  }
}

export function transitionReferral(
  referral: ReferralStateRecord,
  event: ReferralEvent,
  params: {
    actor: string
    now?: Date
    expiry?: Partial<ReferralExpiryConfig>
    metadata?: Record<string, unknown>
  }
): ReferralStateRecord {
  const now = params.now || new Date()
  const expiry = { ...DEFAULT_EXPIRY, ...(params.expiry || {}) }

  if (event === "consent_revoke") {
    ensureNotTerminal(referral, event)
    return {
      ...withAudit(referral, event, "consent_revoked", params.actor, now, {
        ...(params.metadata || {}),
        effect: "Blocks future disclosures; prior disclosures cannot be undisclosed.",
      }),
      futureDisclosuresBlocked: true,
      expiresAt: undefined,
    }
  }

  if (event === "patient_cancel") {
    if (!["requested", "accepted", "info_requested", "scheduled"].includes(referral.status)) {
      throw new Error(`Illegal referral transition: patient_cancel from ${referral.status}.`)
    }
    return { ...withAudit(referral, event, "cancelled", params.actor, now, params.metadata), expiresAt: undefined }
  }

  ensureNotTerminal(referral, event)

  switch (event) {
    case "provider_accept":
      if (referral.status !== "requested") throw new Error(`Illegal referral transition: provider_accept from ${referral.status}.`)
      return {
        ...withAudit(referral, event, "accepted", params.actor, now, params.metadata),
        acceptedAt: iso(now),
        expiresAt: addHours(now, expiry.acceptedSchedulingExpiryHours),
      }
    case "provider_decline":
      if (referral.status !== "requested" && referral.status !== "accepted") {
        throw new Error(`Illegal referral transition: provider_decline from ${referral.status}.`)
      }
      return { ...withAudit(referral, event, "declined", params.actor, now, params.metadata), expiresAt: undefined }
    case "provider_request_info":
      if (referral.status !== "requested" && referral.status !== "accepted") {
        throw new Error(`Illegal referral transition: provider_request_info from ${referral.status}.`)
      }
      return {
        ...withAudit(referral, event, "info_requested", params.actor, now, params.metadata),
        priorStatusBeforeInfoRequest: referral.status,
        infoRequestedAt: iso(now),
        expiresAt: addHours(now, expiry.infoRequestExpiryHours),
      }
    case "patient_respond_info": {
      if (referral.status !== "info_requested") {
        throw new Error(`Illegal referral transition: patient_respond_info from ${referral.status}.`)
      }
      const prior = referral.priorStatusBeforeInfoRequest || "requested"
      return {
        ...withAudit(referral, event, prior, params.actor, now, params.metadata),
        priorStatusBeforeInfoRequest: undefined,
        infoRequestedAt: undefined,
        expiresAt:
          prior === "accepted"
            ? addHours(now, expiry.acceptedSchedulingExpiryHours)
            : undefined,
      }
    }
    case "provider_propose_times":
      if (referral.status !== "accepted") {
        throw new Error(`Illegal referral transition: provider_propose_times from ${referral.status}.`)
      }
      return {
        ...withAudit(referral, event, "scheduled", params.actor, now, params.metadata),
        scheduledAt: iso(now),
        expiresAt: undefined,
      }
    case "provider_attest_complete":
      if (referral.status !== "scheduled") {
        throw new Error(`Illegal referral transition: provider_attest_complete from ${referral.status}.`)
      }
      return {
        ...withAudit(referral, event, "completed_provider_attested", params.actor, now, params.metadata),
        completedAt: iso(now),
        completionType: "provider_attested",
      }
    case "patient_report_complete":
      if (referral.status !== "scheduled") {
        throw new Error(`Illegal referral transition: patient_report_complete from ${referral.status}.`)
      }
      return {
        ...withAudit(referral, event, "completed_patient_reported", params.actor, now, params.metadata),
        completedAt: iso(now),
        completionType: "patient_reported",
      }
    case "expire":
      if (referral.status !== "requested" && referral.status !== "accepted" && referral.status !== "info_requested") {
        throw new Error(`Illegal referral transition: expire from ${referral.status}.`)
      }
      return {
        ...withAudit(referral, event, "expired", params.actor, now, {
          ...(params.metadata || {}),
          resurfaceAlternatives: true,
        }),
        expiresAt: undefined,
      }
    default:
      throw new Error(`Unsupported referral transition event: ${event}`)
  }
}

export function expireReferralIfNeeded(
  referral: ReferralStateRecord,
  params: {
    actor?: string
    now?: Date
  } = {}
): ReferralStateRecord {
  if (!referral.expiresAt || TERMINAL_STATUSES.has(referral.status)) return referral
  const now = params.now || new Date()
  if (new Date(referral.expiresAt).getTime() > now.getTime()) return referral
  return transitionReferral(referral, "expire", {
    actor: params.actor || "system",
    now,
    metadata: {
      expiredFrom: referral.status,
      notifyPatient: true,
      resurfaceAlternatives: true,
    },
  })
}

export function isFutureDisclosureAllowed(referral: ReferralStateRecord): boolean {
  return referral.status !== "consent_revoked" && !referral.futureDisclosuresBlocked
}
