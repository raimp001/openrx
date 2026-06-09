import {
  assertProviderCanReceivePhiReferral,
  canAppearAsSeededContactOnly,
  canAppearInPatientFacingReferralMatching,
  describePatientFacingDirectoryStatus,
  type ProviderComplianceRecord,
} from "@/lib/provider-verification"
import {
  buildDisclosureAuditMetadata,
  consentScopeMatchesDisclosure,
  resolveReferralDisclosureScope,
  type ConsentScopeSnapshot,
  type ResolvedDisclosureScope,
} from "@/lib/referral-disclosure"
import type { ScreeningIntake, ScreeningRecommendation } from "@/lib/screening/types"

export interface ReferralProviderCandidate extends ProviderComplianceRecord {
  services?: string[]
  specialty?: string
  distanceMiles?: number
  acceptingNew?: boolean
  insurance?: string[]
  telehealth?: boolean
}

export interface ReferralShortlist {
  referralTargets: ReferralProviderCandidate[]
  seededContactOnly: ReferralProviderCandidate[]
}

export interface ConsentedReferralRequestDraft {
  id: string
  patientId: string
  providerId: string
  recommendationId: string
  reason: string
  status: "requested"
  sharedDataScope: ResolvedDisclosureScope
  sharedDataScopeHash: string
  disclosureTemplateId: string
  disclosureTemplateVersion: string
  consentId: string
  baaVersion: string
  consentTimestamp: string
  transmittedFields: Array<{ path: string; label: string; value: unknown }>
  auditMetadata: Record<string, unknown>
}

function includesRequestedService(provider: ReferralProviderCandidate, requiredServices: string[]): boolean {
  if (requiredServices.length === 0) return true
  const serviceText = [
    provider.specialty,
    ...(provider.services || []),
  ].filter(Boolean).join(" ").toLowerCase()
  return requiredServices.some((service) => serviceText.includes(service.toLowerCase()))
}

function insuranceMatches(provider: ReferralProviderCandidate, insurance?: string): boolean {
  if (!insurance?.trim()) return true
  return (provider.insurance || []).some((item) => item.toLowerCase() === insurance.toLowerCase())
}

function rankReferralTarget(left: ReferralProviderCandidate, right: ReferralProviderCandidate): number {
  const leftDistance = typeof left.distanceMiles === "number" ? left.distanceMiles : Number.POSITIVE_INFINITY
  const rightDistance = typeof right.distanceMiles === "number" ? right.distanceMiles : Number.POSITIVE_INFINITY
  if (leftDistance !== rightDistance) return leftDistance - rightDistance
  if (left.acceptingNew !== right.acceptingNew) return left.acceptingNew ? -1 : 1
  return left.name.localeCompare(right.name)
}

export function buildPatientReferralShortlist(params: {
  providers: ReferralProviderCandidate[]
  requiredServices?: string[]
  insurance?: string
  telehealthOnly?: boolean
  now?: Date
}): ReferralShortlist {
  const requiredServices = params.requiredServices || []
  const referralTargets = params.providers
    .filter((provider) => canAppearInPatientFacingReferralMatching(provider))
    .filter((provider) => includesRequestedService(provider, requiredServices))
    .filter((provider) => insuranceMatches(provider, params.insurance))
    .filter((provider) => !params.telehealthOnly || provider.telehealth)
    .sort(rankReferralTarget)

  const seededContactOnly = params.providers
    .filter((provider) => canAppearAsSeededContactOnly(provider))
    .filter((provider) => describePatientFacingDirectoryStatus(provider, { now: params.now }).visible)
    .filter((provider) => includesRequestedService(provider, requiredServices))
    .sort(rankReferralTarget)

  return {
    referralTargets,
    seededContactOnly,
  }
}

function fieldListSnapshot(scope: ResolvedDisclosureScope): Array<{ path: string; label: string }> {
  return scope.fields.map((field) => ({ path: field.path, label: field.label }))
}

export function createConsentedReferralRequestDraft(params: {
  id: string
  patientId: string
  provider: ReferralProviderCandidate
  recommendation: ScreeningRecommendation
  intake: ScreeningIntake
  consent?: ConsentScopeSnapshot
  displayedFields: Array<{ path: string; label: string }>
  now?: Date
}): ConsentedReferralRequestDraft {
  assertProviderCanReceivePhiReferral(params.provider)
  const scope = resolveReferralDisclosureScope({
    recommendationId: params.recommendation.id,
    recommendation: params.recommendation,
    intake: params.intake,
  })

  if (!params.consent) {
    throw new Error("ReferralRequest cannot be created before patient consent is captured.")
  }
  if (params.consent.patientId !== params.patientId || params.consent.providerId !== params.provider.id) {
    throw new Error("Consent record does not match the patient and provider.")
  }
  if (!consentScopeMatchesDisclosure(params.consent, scope)) {
    throw new Error("Consent scope hash does not match the transmitted disclosure scope.")
  }

  const displayed = JSON.stringify(params.displayedFields)
  const transmitted = JSON.stringify(fieldListSnapshot(scope))
  if (displayed !== transmitted) {
    throw new Error("Displayed consent field list must be byte-equal to the transmitted field list.")
  }

  const baaVersion = params.provider.baa?.version
  if (!baaVersion) {
    throw new Error("Provider BAA version is required before disclosure.")
  }

  const auditMetadata = buildDisclosureAuditMetadata({
    recommendationId: params.recommendation.id,
    scope,
    consent: params.consent,
    baaVersion,
  })

  return {
    id: params.id,
    patientId: params.patientId,
    providerId: params.provider.id,
    recommendationId: params.recommendation.id,
    reason: params.recommendation.screeningName,
    status: "requested",
    sharedDataScope: scope,
    sharedDataScopeHash: scope.scopeHash,
    disclosureTemplateId: scope.templateId,
    disclosureTemplateVersion: scope.templateVersion,
    consentId: params.consent.id,
    baaVersion,
    consentTimestamp: params.consent.grantedAt,
    transmittedFields: scope.fields,
    auditMetadata,
  }
}
