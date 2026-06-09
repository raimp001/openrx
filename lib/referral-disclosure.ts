import crypto from "node:crypto"
import type { ScreeningIntake, ScreeningRecommendation } from "@/lib/screening/types"

export interface DisclosureTemplateField {
  path: string
  label: string
}

export interface DisclosureTemplate {
  id: string
  version: string
  recommendationIds: string[]
  fields: DisclosureTemplateField[]
}

export interface ResolvedDisclosureField extends DisclosureTemplateField {
  value: unknown
}

export interface ResolvedDisclosureScope {
  recommendationId: string
  templateId: string
  templateVersion: string
  fields: ResolvedDisclosureField[]
  scopeHash: string
}

export interface ConsentScopeSnapshot {
  id: string
  patientId: string
  providerId: string
  scopeHash: string
  scope: ResolvedDisclosureScope
  grantedAt: string
}

export const REFERRAL_DISCLOSURE_TEMPLATES: DisclosureTemplate[] = [
  {
    id: "openrx.disclosure.colorectal-screening.v1",
    version: "2026-06-09",
    recommendationIds: ["colon-screening", "uspstf-colorectal-45-49", "colorectal-cancer-screening"],
    fields: [
      { path: "recommendation.id", label: "Recommendation ID" },
      { path: "recommendation.screeningName", label: "Recommendation" },
      { path: "recommendation.status", label: "Due status" },
      { path: "recommendation.sourceId", label: "Guideline source" },
      { path: "recommendation.sourceVersion", label: "Guideline version" },
      { path: "recommendation.evidenceGrade", label: "Guideline grade" },
      { path: "intake.demographics.age", label: "Age used by the rule" },
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
    recommendationIds: ["genetic-counseling", "request-genetic-counseling", "nccn-genetic-counseling"],
    fields: [
      { path: "recommendation.id", label: "Recommendation ID" },
      { path: "recommendation.screeningName", label: "Recommendation" },
      { path: "recommendation.sourceId", label: "Guideline source" },
      { path: "recommendation.sourceVersion", label: "Guideline version" },
      { path: "intake.demographics.age", label: "Age used by the rule" },
      { path: "intake.demographics.sexAtBirth", label: "Sex at birth, when relevant" },
      { path: "intake.familyHistory.allCancerSignals", label: "Family cancer-history signals used by the rule" },
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
    value: valueForPath(field.path, params.recommendation, params.intake),
  }))
  const scopeWithoutHash = {
    recommendationId: params.recommendationId,
    templateId: template.id,
    templateVersion: template.version,
    fields,
  }
  return {
    ...scopeWithoutHash,
    scopeHash: hashValue(scopeWithoutHash),
  }
}

export function createConsentScopeSnapshot(params: {
  id: string
  patientId: string
  providerId: string
  scope: ResolvedDisclosureScope
  grantedAt: string
}): ConsentScopeSnapshot {
  return {
    id: params.id,
    patientId: params.patientId,
    providerId: params.providerId,
    scopeHash: params.scope.scopeHash,
    scope: params.scope,
    grantedAt: params.grantedAt,
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
    disclosedFields: params.scope.fields.map((field) => ({
      path: field.path,
      label: field.label,
    })),
  }
}
