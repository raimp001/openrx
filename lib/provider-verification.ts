export type ProviderLifecycleStatus =
  | "pending"
  | "verified"
  | "active"
  | "inactive"
  | "manual_review"
  | "blocked"

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
  name: string
  type: "individual" | "facility"
  facilityType?: "lab" | "imaging" | "clinic"
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

function nowIso(now: Date = new Date()): string {
  return now.toISOString()
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

function normalizeDomain(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/^@/, "")
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

export function activateProvider(provider: ProviderComplianceRecord): ProviderComplianceRecord {
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
