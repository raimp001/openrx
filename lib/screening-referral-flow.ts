import type { CareDirectoryMatch } from "@/lib/npi-care-search"
import type { IdentityProofingMethod, LicenseStatus, ScreenStatus } from "@/lib/provider-verification"
import {
  buildPatientReferralShortlist,
  type ReferralProviderCandidate,
} from "@/lib/referral-workflow"
import {
  getDisclosureTemplateForRecommendation,
  resolveReferralDisclosureScope,
  type ResolvedDisclosureScope,
} from "@/lib/referral-disclosure"
import { recommendScreenings, screeningIntakeFromLegacy, type LegacyScreeningInput } from "@/lib/screening/recommend"
import { getGuidelineSource } from "@/lib/screening/sources"
import type { ScreeningEngineResult, ScreeningIntake, ScreeningRecommendation } from "@/lib/screening/types"

export interface ScreeningReferralInput extends LegacyScreeningInput {
  sexAtBirth?: string
  smokingPackYears?: number
  quitYearsAgo?: number
  locationZip?: string
}

export interface ScreeningReferralEvidence {
  sourceId?: string
  sourceSystem: string
  sourceVersion?: string
  evidenceGrade?: string
  sourceUrl?: string
}

export interface ScreeningReferralFieldPreview {
  path: string
  label: string
  value: unknown
  required: boolean
  requiredReason?: string
}

export interface ScreeningReferralProviderSummary {
  id: string
  npi: string
  source: "self_onboarded" | "seeded"
  name: string
  specialty?: string
  services: string[]
  address?: string
  phone?: string
  acceptingNew?: boolean
  telehealth?: boolean
  insurance: string[]
  statusLabel: string
  stale?: boolean
}

export interface ScreeningReferralPlan {
  supported: boolean
  message: string
  patientId: string
  intake: ScreeningIntake
  engineResult: ScreeningEngineResult
  recommendation?: ScreeningRecommendation
  evidence?: ScreeningReferralEvidence
  disclosureScope?: ResolvedDisclosureScope
  disclosurePayloadHash?: string
  disclosureTemplateVersion?: string
  consentTextVersion?: string
  legalBasis?: "undetermined"
  displayedFields: ScreeningReferralFieldPreview[]
  requiredServices: string[]
  referralTargets: ScreeningReferralProviderSummary[]
  seededContactOnly: ScreeningReferralProviderSummary[]
}

export interface ProviderRecordLike {
  id: string
  npi: string
  source?: string | null
  type: string
  facilityType?: string | null
  name: string
  taxonomy?: string | null
  services: string[]
  location?: unknown
  insurance: string[]
  telehealth: boolean
  acceptingNew: boolean
  nppesMatched: boolean
  nppesMatchedAt?: Date | string | null
  nppesPracticeDomain?: string | null
  nppesSnapshotAt?: Date | string | null
  claimedAt?: Date | string | null
  listingSuppressed: boolean
  verificationStatus: string
  identityProofingMethod?: string | null
  identityProofingAt?: Date | string | null
  identityProofingVerifier?: string | null
  identityProofingReference?: string | null
  baaSigned: boolean
  baaVersion?: string | null
  baaSignedAt?: Date | string | null
  sanctionsStatus: string
  sanctionsSource?: string | null
  sanctionsCheckedAt?: Date | string | null
  sanctionsDetails?: unknown
  licenseStatus: string
  licenseNumber?: string | null
  licenseState?: string | null
  licenseCheckedAt?: Date | string | null
  licenseSource?: string | null
  licenseDetails?: unknown
  active: boolean
}

function iso(value?: Date | string | null): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  return value
}

function asStringArray(value?: string[]): string[] {
  return Array.isArray(value) ? value.map((item) => item.trim()).filter(Boolean) : []
}

function normalizeInput(input: ScreeningReferralInput = {}): LegacyScreeningInput {
  const conditions = asStringArray(input.conditions)
  if (typeof input.smokingPackYears === "number") {
    conditions.push(`${input.smokingPackYears} pack-years`)
  }
  if (typeof input.quitYearsAgo === "number") {
    conditions.push(`quit smoking ${input.quitYearsAgo} years ago`)
  }

  return {
    patientId: input.patientId,
    age: input.age,
    gender: input.gender || input.sexAtBirth,
    smoker: input.smoker,
    symptoms: asStringArray(input.symptoms),
    familyHistory: asStringArray(input.familyHistory),
    conditions,
  }
}

export function buildScreeningReferralIntake(input: ScreeningReferralInput = {}): ScreeningIntake {
  return screeningIntakeFromLegacy(normalizeInput(input))
}

function hasDisclosureTemplate(recommendationId: string): boolean {
  try {
    getDisclosureTemplateForRecommendation(recommendationId)
    return true
  } catch {
    return false
  }
}

function requiredServicesForRecommendation(recommendation: ScreeningRecommendation): string[] {
  const text = `${recommendation.id} ${recommendation.screeningName} ${recommendation.cancerType} ${recommendation.recommendedNextStep} ${recommendation.nextSteps.join(" ")}`.toLowerCase()
  const services = new Set<string>()

  if (text.includes("colon") || text.includes("colorectal") || text.includes("fit")) {
    services.add("gastroenterology")
    services.add("colonoscopy")
  }
  if (text.includes("genetic") || text.includes("brca") || text.includes("hereditary")) {
    services.add("genetic counseling")
    services.add("medical genetics")
  }
  if (text.includes("mammogram") || text.includes("mammography")) {
    services.add("mammography")
    services.add("radiology")
  }
  if (text.includes("ldct") || text.includes("low-dose ct") || text.includes("lung")) {
    services.add("radiology")
    services.add("pulmonary")
  }
  if (text.includes("cervical") || text.includes("pap") || text.includes("hpv")) {
    services.add("obstetrics")
    services.add("gynecology")
    services.add("primary care")
  }

  return Array.from(services)
}

function locationAddress(location: unknown): string | undefined {
  if (!location || typeof location !== "object") return undefined
  const data = location as Record<string, unknown>
  return [data.address, data.address1, data.city, data.state, data.zip]
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .join(", ") || undefined
}

export function providerRecordToReferralCandidate(record: ProviderRecordLike): ReferralProviderCandidate {
  return {
    id: record.id,
    npi: record.npi,
    source: record.source === "seeded" ? "seeded" : "self_onboarded",
    name: record.name,
    type: record.type === "facility" ? "facility" : "individual",
    facilityType:
      record.facilityType === "lab" || record.facilityType === "imaging" || record.facilityType === "clinic"
        ? record.facilityType
        : undefined,
    licenseNumber: record.licenseNumber || undefined,
    licenseState: record.licenseState || undefined,
    claimedAt: iso(record.claimedAt),
    nppesSnapshotAt: iso(record.nppesSnapshotAt),
    listingSuppressed: record.listingSuppressed,
    nppes: {
      matched: record.nppesMatched,
      registryName: record.name,
      practiceDomain: record.nppesPracticeDomain || undefined,
      matchedAt: iso(record.nppesMatchedAt),
    },
    identityProofing:
      record.identityProofingMethod && record.identityProofingAt && record.identityProofingVerifier
        ? {
            method: record.identityProofingMethod as IdentityProofingMethod,
            verifiedAt: iso(record.identityProofingAt) || "",
            verifier: record.identityProofingVerifier,
            referenceId: record.identityProofingReference || undefined,
          }
        : undefined,
    baa: {
      signed: record.baaSigned,
      version: record.baaVersion || undefined,
      signedAt: iso(record.baaSignedAt),
    },
    sanctions: {
      screenType: "oig_leie",
      status: record.sanctionsStatus as ScreenStatus,
      source: record.sanctionsSource || "OIG_LEIE",
      runAt: iso(record.sanctionsCheckedAt) || "",
      details: record.sanctionsDetails && typeof record.sanctionsDetails === "object"
        ? record.sanctionsDetails as Record<string, unknown>
        : undefined,
    },
    licensure: {
      screenType: "state_license",
      status: record.licenseStatus as LicenseStatus,
      source: record.licenseSource || "state_license_registry",
      runAt: iso(record.licenseCheckedAt) || "",
      details: record.licenseDetails && typeof record.licenseDetails === "object"
        ? record.licenseDetails as Record<string, unknown>
        : undefined,
    },
    verificationStatus: record.verificationStatus as ReferralProviderCandidate["verificationStatus"],
    active: record.active,
    services: record.services,
    specialty: record.taxonomy || undefined,
    acceptingNew: record.acceptingNew,
    insurance: record.insurance,
    telehealth: record.telehealth,
    ...(locationAddress(record.location) ? { address: locationAddress(record.location) } : {}),
  }
}

export function directoryMatchToSeededReferralCandidate(
  match: CareDirectoryMatch,
  now: Date = new Date()
): ReferralProviderCandidate {
  return {
    id: `seeded_${match.npi}`,
    npi: match.npi,
    source: "seeded",
    name: match.name,
    type: match.kind === "provider" ? "individual" : "facility",
    facilityType: match.kind === "lab" ? "lab" : match.kind === "radiology" ? "imaging" : undefined,
    nppesSnapshotAt: now.toISOString(),
    listingSuppressed: false,
    nppes: {
      matched: true,
      registryName: match.name,
      matchedAt: now.toISOString(),
    },
    verificationStatus: "pending",
    active: false,
    services: [match.kind, match.specialty, match.taxonomyCode].filter(Boolean),
    specialty: match.specialty,
    insurance: [],
    telehealth: false,
    acceptingNew: false,
    phone: match.phone,
    address: match.fullAddress,
  }
}

function summarizeProvider(provider: ReferralProviderCandidate): ScreeningReferralProviderSummary {
  const source = provider.source === "seeded" ? "seeded" : "self_onboarded"
  return {
    id: provider.id,
    npi: provider.npi,
    source,
    name: provider.name,
    specialty: provider.specialty,
    services: provider.services || [],
    address: (provider as ReferralProviderCandidate & { address?: string }).address,
    phone: (provider as ReferralProviderCandidate & { phone?: string }).phone,
    acceptingNew: provider.acceptingNew,
    telehealth: provider.telehealth,
    insurance: provider.insurance || [],
    statusLabel: source === "seeded"
      ? "Public registry listing, not yet partnered; contact directly."
      : "Verified OpenRx network provider with signed BAA.",
  }
}

function evidenceForRecommendation(recommendation: ScreeningRecommendation): ScreeningReferralEvidence {
  const source = getGuidelineSource(recommendation.sourceId)
  return {
    sourceId: recommendation.sourceId,
    sourceSystem: recommendation.sourceSystem,
    sourceVersion: recommendation.sourceVersion,
    evidenceGrade: recommendation.evidenceGrade,
    sourceUrl: source?.url,
  }
}

export function buildScreeningReferralPlan(params: {
  patientId?: string
  recommendationId: string
  screeningInput?: ScreeningReferralInput
  providers?: ReferralProviderCandidate[]
  directoryMatches?: CareDirectoryMatch[]
  now?: Date
}): ScreeningReferralPlan {
  const now = params.now || new Date()
  const patientId = params.patientId || params.screeningInput?.patientId || "anonymous_patient"
  const intake = buildScreeningReferralIntake({ ...params.screeningInput, patientId })
  const engineResult = recommendScreenings(intake)
  const recommendation = engineResult.recommendations.find((item) => item.id === params.recommendationId)
  const providers = [
    ...(params.providers || []),
    ...(params.directoryMatches || []).map((match) => directoryMatchToSeededReferralCandidate(match, now)),
  ]

  if (!recommendation) {
    return {
      supported: false,
      message: "OpenRx could not reproduce that recommendation from the supplied intake, so it will not create a referral.",
      patientId,
      intake,
      engineResult,
      displayedFields: [],
      requiredServices: [],
      referralTargets: [],
      seededContactOnly: providers
        .filter((provider) => provider.source === "seeded")
        .map(summarizeProvider),
    }
  }

  const requiredServices = requiredServicesForRecommendation(recommendation)
  const evidence = evidenceForRecommendation(recommendation)

  if (!hasDisclosureTemplate(recommendation.id)) {
    return {
      supported: false,
      message: "This recommendation does not have a versioned referral-disclosure template yet, so OpenRx can prepare navigation but will not send PHI.",
      patientId,
      intake,
      engineResult,
      recommendation,
      evidence,
      displayedFields: [],
      requiredServices,
      referralTargets: [],
      seededContactOnly: buildPatientReferralShortlist({
        providers,
        requiredServices,
        now,
      }).seededContactOnly.map(summarizeProvider),
    }
  }

  if (!evidence.sourceUrl || !evidence.evidenceGrade) {
    return {
      supported: false,
      message: "This recommendation is missing a working guideline link or grade, so it is blocked from PHI referral until the guideline data is completed.",
      patientId,
      intake,
      engineResult,
      recommendation,
      evidence,
      displayedFields: [],
      requiredServices,
      referralTargets: [],
      seededContactOnly: buildPatientReferralShortlist({
        providers,
        requiredServices,
        now,
      }).seededContactOnly.map(summarizeProvider),
    }
  }

  const disclosureScope = resolveReferralDisclosureScope({
    recommendationId: recommendation.id,
    recommendation,
    intake,
  })
  const shortlist = buildPatientReferralShortlist({
    providers,
    requiredServices,
    now,
  })

  return {
    supported: true,
    message: shortlist.referralTargets.length > 0
      ? "Choose a verified OpenRx network provider, then consent to the exact field list before any PHI is disclosed."
      : "No verified OpenRx network provider with a signed BAA is available yet. Public directory entries are contact-only and cannot receive PHI.",
    patientId,
    intake,
    engineResult,
    recommendation,
    evidence,
    disclosureScope,
    disclosurePayloadHash: disclosureScope.disclosurePayloadHash,
    disclosureTemplateVersion: disclosureScope.templateVersion,
    consentTextVersion: "openrx-referral-consent-2026-06-19",
    legalBasis: "undetermined",
    displayedFields: disclosureScope.fields.map((field) => ({
      path: field.path,
      label: field.label,
      value: field.value,
      required: field.required,
      ...(field.requiredReason ? { requiredReason: field.requiredReason } : {}),
    })),
    requiredServices,
    referralTargets: shortlist.referralTargets.map(summarizeProvider),
    seededContactOnly: shortlist.seededContactOnly.map(summarizeProvider),
  }
}
