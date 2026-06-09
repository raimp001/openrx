export type ProviderLifecycleStatus =
  | "pending"
  | "verified"
  | "active"
  | "inactive"
  | "manual_review"
  | "blocked"

export type ProviderDirectorySource = "seeded" | "self_onboarded"

export type IdentityProofingMethod =
  | "practice_domain_email"
  | "third_party_identity"
  | "manual_document_review"

export type ScreenStatus = "not_run" | "clear" | "match" | "manual_review"
export type LicenseStatus = "not_run" | "active" | "expired" | "inactive" | "missing" | "manual_review"

export interface IdentityProofingRecord {
  method: IdentityProofingMethod
  verifiedAt: string
  verifier: string
  referenceId?: string
}

export interface BaaRecord {
  signed: boolean
  version?: string
  signedAt?: string
}

export interface ProviderScreenResult {
  screenType: "oig_leie" | "state_license"
  status: ScreenStatus | LicenseStatus
  source: string
  sourceVersion?: string
  runAt: string
  details?: Record<string, unknown>
}

export interface ProviderComplianceRecord {
  id: string
  npi: string
  source?: ProviderDirectorySource
  name: string
  type: "individual" | "facility"
  facilityType?: "lab" | "imaging" | "clinic"
  claimedAt?: string
  nppesSnapshotAt?: string
  listingSuppressed?: boolean
  licenseNumber?: string
  licenseState?: string
  nppes: {
    matched: boolean
    registryName: string
    practiceDomain?: string
    matchedAt?: string
  }
  identityProofing?: IdentityProofingRecord
  baa?: BaaRecord
  sanctions?: ProviderScreenResult
  licensure?: ProviderScreenResult
  verificationStatus: ProviderLifecycleStatus
  active: boolean
  referrals?: ReferralForProviderScreen[]
}

export interface ReferralForProviderScreen {
  id: string
  providerId: string
  status: string
  futureDisclosuresBlocked?: boolean
  history?: Array<Record<string, unknown>>
}

export interface AuditEvent {
  eventType: string
  providerId?: string
  referralId?: string
  actor: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface LeieEntry {
  npi?: string
  name: string
  source?: string
}

export interface LicenseRegistryEntry {
  number: string
  state: string
  status: "active" | "expired" | "inactive"
  expiresAt?: string
  source?: string
}

const IN_FLIGHT_REFERRAL_STATUSES = new Set([
  "requested",
  "accepted",
  "info_requested",
  "scheduled",
])

const DEFAULT_NPPES_SEED_TTL_DAYS = 90

function nowIso(now: Date = new Date()): string {
  return now.toISOString()
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

function normalizeDomain(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/^@/, "")
}

function providerSource(provider: ProviderComplianceRecord): ProviderDirectorySource {
  return provider.source || "self_onboarded"
}

function daysBetween(left: Date, right: Date): number {
  return Math.abs(left.getTime() - right.getTime()) / (24 * 60 * 60 * 1000)
}

export function isSeededDirectoryEntry(provider: ProviderComplianceRecord): boolean {
  return providerSource(provider) === "seeded"
}

export function isSeededDirectoryEntryStale(
  provider: ProviderComplianceRecord,
  opts: { now?: Date; ttlDays?: number } = {}
): boolean {
  if (!isSeededDirectoryEntry(provider)) return false
  if (!provider.nppesSnapshotAt) return true
  const snapshotAt = new Date(provider.nppesSnapshotAt)
  if (Number.isNaN(snapshotAt.getTime())) return true
  return daysBetween(opts.now || new Date(), snapshotAt) > (opts.ttlDays || DEFAULT_NPPES_SEED_TTL_DAYS)
}

export function nppesNameMatches(provider: ProviderComplianceRecord): boolean {
  return normalizeName(provider.name) === normalizeName(provider.nppes.registryName)
}

export function issuePracticeDomainProofingChallenge(params: {
  provider: ProviderComplianceRecord
  email: string
  code: string
  now?: Date
}): IdentityProofingRecord | null {
  const expectedDomain = normalizeDomain(params.provider.nppes.practiceDomain)
  const emailDomain = normalizeDomain(params.email.split("@")[1])
  if (!expectedDomain || emailDomain !== expectedDomain) return null
  if (!params.code.trim()) return null
  return {
    method: "practice_domain_email",
    verifiedAt: nowIso(params.now),
    verifier: `practice-domain:${expectedDomain}`,
    referenceId: `email-code:${params.code.trim()}`,
  }
}

export function hasIdentityProofingPass(provider: ProviderComplianceRecord): boolean {
  const proof = provider.identityProofing
  return Boolean(proof?.method && proof.verifiedAt && proof.verifier)
}

export function hasClearSanctionsScreen(provider: ProviderComplianceRecord): boolean {
  return provider.sanctions?.screenType === "oig_leie" && provider.sanctions.status === "clear"
}

export function hasAcceptableLicenseScreen(provider: ProviderComplianceRecord): boolean {
  if (provider.type === "facility" && !provider.licenseNumber) return true
  return provider.licensure?.screenType === "state_license" && provider.licensure.status === "active"
}

export function evaluateProviderVerification(provider: ProviderComplianceRecord): {
  status: ProviderLifecycleStatus
  active: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  if (!provider.nppes.matched || !nppesNameMatches(provider)) {
    reasons.push("NPPES match failed.")
    return { status: "pending", active: false, reasons }
  }

  if (provider.sanctions?.status === "match") {
    reasons.push("OIG LEIE exclusion match requires manual review and blocks activation.")
    return { status: "blocked", active: false, reasons }
  }

  if (!hasClearSanctionsScreen(provider)) {
    reasons.push("OIG LEIE screen has not cleared.")
    return { status: "pending", active: false, reasons }
  }

  if (!hasAcceptableLicenseScreen(provider)) {
    reasons.push("State licensure has not cleared.")
    return { status: "manual_review", active: false, reasons }
  }

  if (!hasIdentityProofingPass(provider)) {
    reasons.push("Identity proofing is required after NPPES match.")
    return { status: "pending", active: false, reasons }
  }

  return { status: "verified", active: false, reasons }
}

export function canAppearInPatientFacingReferralMatching(provider: ProviderComplianceRecord): boolean {
  return (
    !provider.listingSuppressed &&
    providerSource(provider) === "self_onboarded" &&
    provider.active &&
    provider.verificationStatus === "active" &&
    provider.nppes.matched &&
    nppesNameMatches(provider) &&
    hasIdentityProofingPass(provider) &&
    hasClearSanctionsScreen(provider) &&
    hasAcceptableLicenseScreen(provider) &&
    Boolean(provider.baa?.signed)
  )
}

export function canReceivePhiReferral(provider: ProviderComplianceRecord): boolean {
  return canAppearInPatientFacingReferralMatching(provider)
}

export function canAppearAsSeededContactOnly(provider: ProviderComplianceRecord): boolean {
  return (
    !provider.listingSuppressed &&
    providerSource(provider) === "seeded" &&
    provider.nppes.matched &&
    !provider.active
  )
}

export function describePatientFacingDirectoryStatus(
  provider: ProviderComplianceRecord,
  opts: { now?: Date; ttlDays?: number } = {}
): {
  visible: boolean
  referralTarget: boolean
  contactOnly: boolean
  label: string
  stale: boolean
} {
  if (provider.listingSuppressed) {
    return {
      visible: false,
      referralTarget: false,
      contactOnly: false,
      label: "Listing suppressed by provider request.",
      stale: false,
    }
  }

  const stale = isSeededDirectoryEntryStale(provider, opts)
  if (canAppearInPatientFacingReferralMatching(provider)) {
    return {
      visible: true,
      referralTarget: true,
      contactOnly: false,
      label: "Verified OpenRx network provider.",
      stale: false,
    }
  }
  if (canAppearAsSeededContactOnly(provider)) {
    return {
      visible: true,
      referralTarget: false,
      contactOnly: true,
      label: stale
        ? "Public registry listing, not yet partnered; address unconfirmed until NPPES refresh."
        : "Public registry listing, not yet partnered; contact directly.",
      stale,
    }
  }

  return {
    visible: false,
    referralTarget: false,
    contactOnly: false,
    label: "Provider is not eligible for patient-facing matching.",
    stale,
  }
}

export function claimSeededDirectoryEntry(params: {
  seeded: ProviderComplianceRecord
  submittedProfile: Partial<ProviderComplianceRecord>
  now?: Date
}): ProviderComplianceRecord {
  if (!isSeededDirectoryEntry(params.seeded)) {
    throw new Error("Only seeded public directory entries can be claimed through this merge path.")
  }
  if (
    params.submittedProfile.npi &&
    params.submittedProfile.npi !== params.seeded.npi
  ) {
    throw new Error("Submitted NPI does not match the seeded listing.")
  }
  const now = nowIso(params.now)
  return {
    ...params.seeded,
    ...params.submittedProfile,
    id: params.seeded.id,
    npi: params.seeded.npi,
    source: "self_onboarded",
    claimedAt: now,
    listingSuppressed: false,
    verificationStatus: "pending",
    active: false,
    identityProofing: params.submittedProfile.identityProofing,
    baa: params.submittedProfile.baa,
    referrals: params.seeded.referrals,
  }
}

export function suppressSeededDirectoryEntry(
  provider: ProviderComplianceRecord,
  opts: { actor: string; now?: Date }
): { provider: ProviderComplianceRecord; auditEvent: AuditEvent } {
  const suppressedProvider: ProviderComplianceRecord = {
    ...provider,
    listingSuppressed: true,
    active: false,
  }
  return {
    provider: suppressedProvider,
    auditEvent: {
      eventType: "provider_directory.listing_suppressed",
      providerId: provider.id,
      actor: opts.actor,
      createdAt: nowIso(opts.now),
      metadata: {
        npi: provider.npi,
        source: providerSource(provider),
      },
    },
  }
}

export function assertProviderCanReceivePhiReferral(provider: ProviderComplianceRecord) {
  if (provider.listingSuppressed) {
    throw new Error("Provider listing is suppressed and cannot receive referrals.")
  }
  if (isSeededDirectoryEntry(provider)) {
    throw new Error("Seeded public directory entries cannot receive ReferralRequests or PHI.")
  }
  if (!canReceivePhiReferral(provider)) {
    throw new Error("Provider is not active, verified, screened, identity-proofed, and BAA-signed.")
  }
}

export function activateProvider(provider: ProviderComplianceRecord): ProviderComplianceRecord {
  if (provider.listingSuppressed) {
    return { ...provider, active: false }
  }
  const verification = evaluateProviderVerification(provider)
  if (verification.status !== "verified") {
    return { ...provider, verificationStatus: verification.status, active: false }
  }
  if (!provider.baa?.signed) {
    return { ...provider, verificationStatus: "verified", active: false }
  }
  return { ...provider, verificationStatus: "active", active: true }
}

export function runProviderComplianceScreens(
  provider: ProviderComplianceRecord,
  opts: {
    leieEntries?: LeieEntry[]
    licenseRegistry?: LicenseRegistryEntry[]
    now?: Date
    sourceVersion?: string
  } = {}
): { provider: ProviderComplianceRecord; auditEvents: AuditEvent[]; screenResults: ProviderScreenResult[] } {
  const runAt = nowIso(opts.now)
  const normalizedProviderName = normalizeName(provider.name)
  const leieMatch = (opts.leieEntries || []).find((entry) => {
    return (entry.npi && entry.npi === provider.npi) || normalizeName(entry.name) === normalizedProviderName
  })
  const sanctions: ProviderScreenResult = {
    screenType: "oig_leie",
    status: leieMatch ? "match" : "clear",
    source: leieMatch?.source || "OIG_LEIE",
    sourceVersion: opts.sourceVersion,
    runAt,
    details: leieMatch ? { matchedName: leieMatch.name, matchedNpi: leieMatch.npi } : undefined,
  }

  let licensure: ProviderScreenResult
  if (!provider.licenseNumber && provider.type === "facility") {
    licensure = {
      screenType: "state_license",
      status: "missing",
      source: "state_license_registry",
      sourceVersion: opts.sourceVersion,
      runAt,
      details: { reason: "Facility profile has no individual state license number." },
    }
  } else if (!provider.licenseNumber || !provider.licenseState) {
    licensure = {
      screenType: "state_license",
      status: "manual_review",
      source: "state_license_registry",
      sourceVersion: opts.sourceVersion,
      runAt,
      details: { reason: "Missing state license number or state." },
    }
  } else {
    const license = (opts.licenseRegistry || []).find(
      (entry) =>
        entry.number.toLowerCase() === provider.licenseNumber?.toLowerCase() &&
        entry.state.toUpperCase() === provider.licenseState?.toUpperCase()
    )
    const expiresAt = license?.expiresAt ? new Date(license.expiresAt) : undefined
    const expiredByDate = expiresAt ? expiresAt.getTime() < (opts.now || new Date()).getTime() : false
    const status: LicenseStatus = !license
      ? "manual_review"
      : license.status !== "active" || expiredByDate
        ? license.status === "expired" || expiredByDate
          ? "expired"
          : "inactive"
        : "active"
    licensure = {
      screenType: "state_license",
      status,
      source: license?.source || "state_license_registry",
      sourceVersion: opts.sourceVersion,
      runAt,
      details: {
        licenseNumber: provider.licenseNumber,
        licenseState: provider.licenseState,
        expiresAt: license?.expiresAt,
      },
    }
  }

  const screenedProvider: ProviderComplianceRecord = {
    ...provider,
    sanctions,
    licensure,
    verificationStatus: leieMatch ? "blocked" : provider.verificationStatus,
    active: leieMatch ? false : provider.active,
  }

  const screenResults = [sanctions, licensure]
  const auditEvents: AuditEvent[] = screenResults.map((screen) => ({
    eventType: `provider_screen.${screen.screenType}`,
    providerId: provider.id,
    actor: "system",
    createdAt: runAt,
    metadata: {
      status: screen.status,
      source: screen.source,
      sourceVersion: screen.sourceVersion,
      details: screen.details,
    },
  }))

  return { provider: activateProvider(screenedProvider), auditEvents, screenResults }
}

export function rescreenActiveProviders(
  providers: ProviderComplianceRecord[],
  opts: {
    leieEntries?: LeieEntry[]
    licenseRegistry?: LicenseRegistryEntry[]
    now?: Date
    sourceVersion?: string
  } = {}
): {
  providers: ProviderComplianceRecord[]
  haltedReferrals: ReferralForProviderScreen[]
  auditEvents: AuditEvent[]
  patientNotifications: Array<{ patientId?: string; referralId: string; message: string }>
} {
  const haltedReferrals: ReferralForProviderScreen[] = []
  const auditEvents: AuditEvent[] = []
  const patientNotifications: Array<{ patientId?: string; referralId: string; message: string }> = []

  const nextProviders = providers.map((provider) => {
    if (!provider.active) return provider
    const result = runProviderComplianceScreens(provider, opts)
    auditEvents.push(...result.auditEvents)

    if (result.provider.verificationStatus !== "blocked") return result.provider

    const halted = (provider.referrals || [])
      .filter((referral) => IN_FLIGHT_REFERRAL_STATUSES.has(referral.status))
      .map((referral) => ({
        ...referral,
        status: "halted_provider_ineligible",
        futureDisclosuresBlocked: true,
        history: [
          ...(referral.history || []),
          {
            event: "provider_exclusion_rescreen_hit",
            at: nowIso(opts.now),
            actor: "system",
          },
        ],
      }))
    haltedReferrals.push(...halted)
    halted.forEach((referral) => {
      auditEvents.push({
        eventType: "referral.halted_provider_ineligible",
        providerId: provider.id,
        referralId: referral.id,
        actor: "system",
        createdAt: nowIso(opts.now),
        metadata: { reason: "New OIG LEIE exclusion hit on periodic re-screen." },
      })
      patientNotifications.push({
        referralId: referral.id,
        message: "This provider is no longer available for referral processing. OpenRx should show alternatives.",
      })
    })

    return {
      ...result.provider,
      verificationStatus: "inactive" as const,
      active: false,
      referrals: halted,
    }
  })

  return { providers: nextProviders, haltedReferrals, auditEvents, patientNotifications }
}
