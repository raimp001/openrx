import crypto from "node:crypto"
import type { ScreeningIntake, ScreeningRecommendation } from "@/lib/screening/types"

export interface DisclosureTemplateField {
  path: string
  label: string
  required?: boolean
  requiredReason?: string
}

export interface DisclosureTemplate {
  id: string
  version: string
  recommendationIds: string[]
  fields: DisclosureTemplateField[]
}

export interface ResolvedDisclosureField extends DisclosureTemplateField {
  value: unknown
  required: boolean
}

export interface ResolvedDisclosureScope {
  recommendationId: string
  templateId: string
  templateVersion: string
  fields: ResolvedDisclosureField[]
  scopeHash: string
  disclosurePayloadHash: string
}

export interface ConsentScopeSnapshot {
  id: string
  patientId: string
  providerId: string
  recommendationId: string
  scopeHash: string
  disclosurePayloadHash: string
  selectedFieldIds: string[]
  scope: ResolvedDisclosureScope
  grantedAt: string
  expiresAt: string
  revokedAt?: string
  legalBasis: ConsentLegalBasis
  consentTextVersion: string
  receipt?: ConsentReceipt
}

export type ConsentLegalBasis = "patient_directed" | "baa_governed" | "undetermined"

export interface ConsentReceipt {
  consentId: string
  patientId: string
  providerName: string
  fields: Array<{ path: string; label: string; value: unknown; required: boolean }>
  grantedAt: string
  sourceRec: {
    recommendationId: string
    screeningName: string
    sourceSystem: string
    sourceVersion?: string
    evidenceGrade?: string
  }
}

export const CONSENT_TEXT_VERSION = "openrx-referral-consent-2026-06-19"
export const DEFAULT_CONSENT_EXPIRY_DAYS = 30

export const REFERRAL_DISCLOSURE_TEMPLATES: DisclosureTemplate[] = [
  {
    id: "openrx.disclosure.colorectal-screening.v1",
    version: "2026-06-09",
    recommendationIds: ["colon-screening", "uspstf-colorectal-45-49", "uspstf-average-risk-colorectal", "colorectal-cancer-screening"],
    fields: [
      { path: "recommendation.id", label: "Recommendation ID", required: true, requiredReason: "Binds this disclosure to one recommendation only." },
      { path: "recommendation.screeningName", label: "Recommendation", required: true, requiredReason: "The receiving provider needs to know the requested care-navigation task." },
      { path: "recommendation.status", label: "Due status", required: true, requiredReason: "The referral reason depends on whether the screening is due or needs review." },
      { path: "recommendation.sourceId", label: "Guideline source", required: true, requiredReason: "Every OpenRx recommendation must remain source-traceable." },
      { path: "recommendation.sourceVersion", label: "Guideline version", required: true, requiredReason: "The provider should see which version produced the recommendation." },
      { path: "recommendation.evidenceGrade", label: "Guideline grade", required: true, requiredReason: "The provider should see the recommendation strength shown to the patient." },
      { path: "intake.demographics.age", label: "Age used by the rule", required: true, requiredReason: "Age is the core eligibility input for this screening recommendation." },
      { path: "intake.demographics.sexAtBirth", label: "Sex at birth, when relevant" },
      { path: "intake.personalHistory.colonPolyps", label: "Colon polyp history" },
      { path: "intake.personalHistory.advancedAdenoma", label: "Advanced adenoma history" },
      { path: "intake.familyHistory.colorectalCancer", label: "Family history relevant to colorectal risk" },
      { path: "intake.priorScreening.colorectal", label: "Prior colorectal screening dates/results" },
    ],
  },
  {
    id: "openrx.disclosure.genetic-counseling.v1",
    version: "2026-06-09",
    recommendationIds: [
      "genetic-counseling",
      "request-genetic-counseling",
      "nccn-genetic-counseling",
      "brca-family-history-risk-assessment",
      "hereditary-cancer-genetic-counseling",
      "hereditary-prostate-screening-review",
    ],
    fields: [
      { path: "recommendation.id", label: "Recommendation ID", required: true, requiredReason: "Binds this disclosure to one recommendation only." },
      { path: "recommendation.screeningName", label: "Recommendation", required: true, requiredReason: "The receiving counselor needs the requested care-navigation task." },
      { path: "recommendation.sourceId", label: "Guideline source", required: true, requiredReason: "Every OpenRx recommendation must remain source-traceable." },
      { path: "recommendation.sourceVersion", label: "Guideline version", required: true, requiredReason: "The provider should see which version produced the recommendation." },
      { path: "recommendation.evidenceGrade", label: "Guideline grade", required: true, requiredReason: "The provider should see the recommendation strength shown to the patient." },
      { path: "intake.demographics.age", label: "Age used by the rule", required: true, requiredReason: "Age is part of the rule context shown for this referral." },
      { path: "intake.demographics.sexAtBirth", label: "Sex at birth, when relevant" },
      { path: "intake.familyHistory.allCancerSignals", label: "Family cancer-history signals used by the rule", required: true, requiredReason: "The counseling referral is based on the family-history signal." },
      { path: "intake.genetics.knownPathogenicVariants", label: "Known pathogenic variants reported by patient" },
    ],
  },
]

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function hashValue(value: unknown): string {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex")
}

function canonicalDisclosurePayload(scope: Omit<ResolvedDisclosureScope, "scopeHash" | "disclosurePayloadHash">): Omit<ResolvedDisclosureScope, "scopeHash" | "disclosurePayloadHash"> {
  return {
    recommendationId: scope.recommendationId,
    templateId: scope.templateId,
    templateVersion: scope.templateVersion,
    fields: scope.fields.map((field) => ({
      path: field.path,
      label: field.label,
      value: field.value,
      required: field.required,
      ...(field.requiredReason ? { requiredReason: field.requiredReason } : {}),
    })),
  }
}

function withScopeHash(scope: Omit<ResolvedDisclosureScope, "scopeHash" | "disclosurePayloadHash">): ResolvedDisclosureScope {
  const canonical = canonicalDisclosurePayload(scope)
  const disclosurePayloadHash = hashValue(canonical)
  return {
    ...canonical,
    scopeHash: disclosurePayloadHash,
    disclosurePayloadHash,
  }
}

function colorectalFamilyHistory(intake: ScreeningIntake): ScreeningIntake["familyHistory"] {
  return intake.familyHistory.filter((entry) => {
    const type = entry.cancerType.toLowerCase()
    return type.includes("colon") || type.includes("colorectal") || type.includes("rectal")
  })
}

function colorectalPriorScreening(intake: ScreeningIntake): ScreeningIntake["priorScreening"] {
  return intake.priorScreening.filter((entry) => {
    const type = entry.screeningType.toLowerCase()
    return type.includes("colon") || type.includes("colorectal") || type.includes("fit") || type.includes("colonoscopy")
  })
}

function valueForPath(path: string, recommendation: ScreeningRecommendation, intake: ScreeningIntake): unknown {
  switch (path) {
    case "recommendation.id":
      return recommendation.id
    case "recommendation.screeningName":
      return recommendation.screeningName
    case "recommendation.status":
      return recommendation.status
    case "recommendation.sourceId":
      return recommendation.sourceId
    case "recommendation.sourceVersion":
      return recommendation.sourceVersion
    case "recommendation.evidenceGrade":
      return recommendation.evidenceGrade
    case "intake.demographics.age":
      return intake.demographics.age
    case "intake.demographics.sexAtBirth":
      return intake.demographics.sexAtBirth
    case "intake.personalHistory.colonPolyps":
      return intake.personalHistory.colonPolyps
    case "intake.personalHistory.advancedAdenoma":
      return intake.personalHistory.advancedAdenoma
    case "intake.familyHistory.colorectalCancer":
      return colorectalFamilyHistory(intake)
    case "intake.priorScreening.colorectal":
      return colorectalPriorScreening(intake)
    case "intake.familyHistory.allCancerSignals":
      return intake.familyHistory
    case "intake.genetics.knownPathogenicVariants":
      return intake.genetics.knownPathogenicVariants || []
    default:
      throw new Error(`Disclosure template references unsupported field: ${path}`)
  }
}

export function getDisclosureTemplateForRecommendation(recommendationId: string): DisclosureTemplate {
  const template = REFERRAL_DISCLOSURE_TEMPLATES.find((item) => item.recommendationIds.includes(recommendationId))
  if (!template) throw new Error(`No disclosure template exists for recommendation ${recommendationId}.`)
  return template
}

export function resolveReferralDisclosureScope(params: {
  recommendationId: string
  recommendation: ScreeningRecommendation
  intake: ScreeningIntake
  llmSuggestedFields?: string[]
}): ResolvedDisclosureScope {
  const template = getDisclosureTemplateForRecommendation(params.recommendationId)
  const fields = template.fields.map((field) => ({
    ...field,
    required: field.required === true,
    value: valueForPath(field.path, params.recommendation, params.intake),
  }))
  return withScopeHash({
    recommendationId: params.recommendationId,
    templateId: template.id,
    templateVersion: template.version,
    fields,
  })
}

export function requiredDisclosureFieldIds(scope: ResolvedDisclosureScope): string[] {
  return scope.fields.filter((field) => field.required).map((field) => field.path)
}

export function narrowDisclosureScope(params: {
  scope: ResolvedDisclosureScope
  selectedFieldIds: string[]
  requireRequiredFields?: boolean
}): ResolvedDisclosureScope {
  const selected = new Set(params.selectedFieldIds)
  const allowed = new Set(params.scope.fields.map((field) => field.path))
  const invalid = params.selectedFieldIds.filter((fieldId) => !allowed.has(fieldId))
  if (invalid.length) {
    throw new Error(`Disclosure selection includes fields outside the server whitelist: ${invalid.join(", ")}`)
  }

  const missingRequired = params.scope.fields
    .filter((field) => field.required && !selected.has(field.path))
    .map((field) => field.path)
  if (missingRequired.length && params.requireRequiredFields !== false) {
    throw new Error(`Disclosure selection is missing required fields: ${missingRequired.join(", ")}`)
  }

  return withScopeHash({
    recommendationId: params.scope.recommendationId,
    templateId: params.scope.templateId,
    templateVersion: params.scope.templateVersion,
    fields: params.scope.fields.filter((field) => selected.has(field.path)),
  })
}

export function createConsentScopeSnapshot(params: {
  id: string
  patientId: string
  providerId: string
  scope: ResolvedDisclosureScope
  grantedAt: string
  expiresAt?: string
  legalBasis?: ConsentLegalBasis
  consentTextVersion?: string
  receipt?: ConsentReceipt
}): ConsentScopeSnapshot {
  const grantedAtMs = new Date(params.grantedAt).getTime()
  const expiresAt = params.expiresAt || new Date(grantedAtMs + DEFAULT_CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: params.id,
    patientId: params.patientId,
    providerId: params.providerId,
    recommendationId: params.scope.recommendationId,
    scopeHash: params.scope.scopeHash,
    disclosurePayloadHash: params.scope.disclosurePayloadHash,
    selectedFieldIds: params.scope.fields.map((field) => field.path),
    scope: params.scope,
    grantedAt: params.grantedAt,
    expiresAt,
    legalBasis: params.legalBasis || "undetermined",
    consentTextVersion: params.consentTextVersion || CONSENT_TEXT_VERSION,
    ...(params.receipt ? { receipt: params.receipt } : {}),
  }
}

export function consentScopeMatchesDisclosure(consent: ConsentScopeSnapshot, scope: ResolvedDisclosureScope): boolean {
  return consent.scopeHash === scope.scopeHash
}

export function buildDisclosureAuditMetadata(params: {
  recommendationId: string
  scope: ResolvedDisclosureScope
  consent: ConsentScopeSnapshot
  baaVersion: string
}): Record<string, unknown> {
  if (!consentScopeMatchesDisclosure(params.consent, params.scope)) {
    throw new Error("Consent scope hash does not match the disclosure scope.")
  }
  return {
    recommendationId: params.recommendationId,
    disclosureTemplateId: params.scope.templateId,
    disclosureTemplateVersion: params.scope.templateVersion,
    consentRecordId: params.consent.id,
    baaVersion: params.baaVersion,
    disclosurePayloadHash: params.scope.disclosurePayloadHash,
    consentTextVersion: params.consent.consentTextVersion,
    legalBasis: params.consent.legalBasis,
    disclosedFields: params.scope.fields.map((field) => ({
      path: field.path,
      label: field.label,
      required: field.required,
    })),
  }
}

export function buildConsentReceipt(params: {
  consentId: string
  patientId: string
  providerName: string
  recommendation: ScreeningRecommendation
  scope: ResolvedDisclosureScope
  grantedAt: string
}): ConsentReceipt {
  return {
    consentId: params.consentId,
    patientId: params.patientId,
    providerName: params.providerName,
    fields: params.scope.fields.map((field) => ({
      path: field.path,
      label: field.label,
      value: field.value,
      required: field.required,
    })),
    grantedAt: params.grantedAt,
    sourceRec: {
      recommendationId: params.recommendation.id,
      screeningName: params.recommendation.screeningName,
      sourceSystem: params.recommendation.sourceSystem,
      sourceVersion: params.recommendation.sourceVersion,
      evidenceGrade: params.recommendation.evidenceGrade,
    },
  }
}
