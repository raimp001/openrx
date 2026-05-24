import { getGuidelineSource } from "@/lib/screening/sources"
import type { ScreeningRecommendation } from "@/lib/screening/types"
import type { CareDirectoryMatch } from "@/lib/npi-care-search"

export const CARE_PLAN_STATUSES = [
  "new",
  "discussed",
  "scheduled",
  "completed",
  "deferred",
  "needs_clinician_review",
] as const

export type CarePlanStatus = (typeof CARE_PLAN_STATUSES)[number]
export type CarePlanUrgency = "routine" | "soon" | "urgent" | "emergency"
export type CarePlanConfidence = "guideline_based" | "context_dependent" | "needs_clinician_review"
export type CarePlanOrigin = "chat" | "screening" | "provider_search" | "onboarding"

export interface CarePlanRecommendation {
  id: string
  title: string
  rationale: string
  urgency: CarePlanUrgency
  sourceLabel: string
  sourceUrl: string
  confidence: CarePlanConfidence
  status: CarePlanStatus
  nextAction: string
}

export interface CarePlan {
  id: string
  patientContextSummary: string
  recommendations: CarePlanRecommendation[]
  origin: CarePlanOrigin
  createdAt: string
  updatedAt: string
}

function stableId(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

function planStatusForScreening(rec: ScreeningRecommendation): CarePlanStatus {
  return rec.requiresClinicianReview ||
    rec.status === "urgent_clinician_review" ||
    rec.status === "needs_clinician_review" ||
    rec.status === "high_risk" ||
    rec.status === "surveillance_or_follow_up"
    ? "needs_clinician_review"
    : "new"
}

function urgencyForScreening(rec: ScreeningRecommendation): CarePlanUrgency {
  if (rec.status === "urgent_clinician_review") return "emergency"
  if (rec.requiresClinicianReview || rec.status === "high_risk" || rec.status === "surveillance_or_follow_up") return "urgent"
  if (rec.status === "due") return "soon"
  return "routine"
}

function confidenceForScreening(rec: ScreeningRecommendation): CarePlanConfidence {
  if (rec.sourceSystem === "PENDING" || rec.requiresClinicianReview) return "needs_clinician_review"
  if (rec.riskCategory === "average_risk") return "guideline_based"
  return "context_dependent"
}

export function createCarePlan(input: {
  patientContextSummary: string
  recommendations: CarePlanRecommendation[]
  origin: CarePlanOrigin
  createdAt?: string
}): CarePlan {
  const createdAt = input.createdAt || new Date().toISOString()
  const signature = `${input.origin}:${input.patientContextSummary}:${input.recommendations.map((item) => item.id).join("|")}`
  return {
    id: `care_${stableId(signature)}`,
    patientContextSummary: input.patientContextSummary.slice(0, 240),
    recommendations: input.recommendations,
    origin: input.origin,
    createdAt,
    updatedAt: createdAt,
  }
}

export function carePlanFromScreeningRecommendations(
  recommendations: ScreeningRecommendation[],
  patientContextSummary: string,
  origin: Extract<CarePlanOrigin, "chat" | "screening"> = "screening"
): CarePlan {
  return createCarePlan({
    patientContextSummary,
    origin,
    recommendations: recommendations.map((rec) => {
      const source = getGuidelineSource(rec.sourceId)
      return {
        id: rec.id,
        title: rec.screeningName,
        rationale: rec.patientFriendlyExplanation,
        urgency: urgencyForScreening(rec),
        sourceLabel: source
          ? `${source.organization} ${source.versionOrDate}`
          : rec.sourceSystem !== "PENDING"
            ? `${rec.sourceSystem}${rec.sourceVersion ? ` ${rec.sourceVersion}` : ""}`
            : "Needs clinician review",
        sourceUrl: source?.url || "",
        confidence: confidenceForScreening(rec),
        status: planStatusForScreening(rec),
        nextAction: rec.recommendedNextStep,
      }
    }),
  })
}

export function carePlanFromProviderCandidate(match: CareDirectoryMatch, patientContextSummary: string): CarePlan {
  return createCarePlan({
    patientContextSummary,
    origin: "provider_search",
    recommendations: [{
      id: `provider_${match.npi}`,
      title: `Call ${match.name}`,
      rationale: `${match.specialty || "Care directory"} candidate found in the public NPI directory. Confirm availability, licensure, ordering ability, and coverage before relying on this option.`,
      urgency: "routine",
      sourceLabel: "CMS NPI directory candidate",
      sourceUrl: "https://npiregistry.cms.hhs.gov/",
      confidence: "context_dependent",
      status: "new",
      nextAction: match.phone ? `Call ${match.phone}` : "Find a public phone number before scheduling.",
    }],
  })
}

export function advanceCarePlanStatus(status: CarePlanStatus): CarePlanStatus {
  if (status === "new" || status === "needs_clinician_review") return "discussed"
  if (status === "discussed") return "scheduled"
  if (status === "scheduled") return "completed"
  return status
}

export function updateCarePlanRecommendationStatus(
  plan: CarePlan,
  recommendationId: string,
  status: CarePlanStatus
): CarePlan {
  return {
    ...plan,
    recommendations: plan.recommendations.map((recommendation) =>
      recommendation.id === recommendationId ? { ...recommendation, status } : recommendation
    ),
    updatedAt: new Date().toISOString(),
  }
}
