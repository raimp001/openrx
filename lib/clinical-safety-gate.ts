import { getGuidelineSource } from "@/lib/screening/sources"
import type { ScreeningEngineResult, ScreeningRecommendation } from "@/lib/screening/types"

export const CLINICAL_CONFIDENCE_THRESHOLD = 0.85

export type ClinicalSafetyStatus = "passed" | "needs_review" | "blocked"

export type ClinicalSafetyIssueCode =
  | "missing_source_id"
  | "unknown_source"
  | "missing_source_url"
  | "missing_source_version"
  | "missing_evidence_grade"
  | "pending_source"
  | "clinician_review_required"
  | "low_confidence"

export type ClinicalSafetyIssueSeverity = "warn" | "review" | "block"

export interface ClinicalSafetyIssue {
  recommendationId?: string
  code: ClinicalSafetyIssueCode
  severity: ClinicalSafetyIssueSeverity
  message: string
}

export interface ClinicalSafetyReport {
  status: ClinicalSafetyStatus
  checkedAt: string
  confidenceThreshold: number
  recommendationCount: number
  sourceCompleteCount: number
  clinicianReviewCount: number
  issues: ClinicalSafetyIssue[]
}

interface ClinicalSafetyOptions {
  modelConfidenceScore?: number
}

function issue(
  code: ClinicalSafetyIssueCode,
  severity: ClinicalSafetyIssueSeverity,
  message: string,
  recommendationId?: string
): ClinicalSafetyIssue {
  return {
    code,
    severity,
    message,
    ...(recommendationId ? { recommendationId } : {}),
  }
}

function hasSourceCompleteness(rec: ScreeningRecommendation): boolean {
  const source = getGuidelineSource(rec.sourceId)
  return Boolean(
    rec.sourceId &&
    source &&
    (rec.sourceUrl || source.url) &&
    (rec.sourceVersion || source.versionOrDate) &&
    rec.evidenceGrade &&
    rec.sourceSystem !== "PENDING" &&
    source.organization !== "PENDING"
  )
}

export function validateScreeningRecommendations(
  recommendations: ScreeningRecommendation[],
  options: ClinicalSafetyOptions = {}
): ClinicalSafetyReport {
  const issues: ClinicalSafetyIssue[] = []

  if (
    typeof options.modelConfidenceScore === "number" &&
    Number.isFinite(options.modelConfidenceScore) &&
    options.modelConfidenceScore < CLINICAL_CONFIDENCE_THRESHOLD
  ) {
    issues.push(
      issue(
        "low_confidence",
        "review",
        `Model-derived parsing confidence ${options.modelConfidenceScore.toFixed(2)} is below ${CLINICAL_CONFIDENCE_THRESHOLD.toFixed(2)}; ask a focused clarification or route to clinician review.`
      )
    )
  }

  for (const rec of recommendations) {
    const source = getGuidelineSource(rec.sourceId)
    if (!rec.sourceId) {
      issues.push(issue("missing_source_id", "block", "Recommendation is missing a guideline source id.", rec.id))
    } else if (!source) {
      issues.push(issue("unknown_source", "block", `Guideline source ${rec.sourceId} is not registered.`, rec.id))
    }

    if (!rec.evidenceGrade) {
      issues.push(issue("missing_evidence_grade", "block", "Recommendation is missing a grade or strength label.", rec.id))
    }

    if (!rec.sourceVersion && !source?.versionOrDate) {
      issues.push(issue("missing_source_version", "block", "Recommendation is missing guideline version or effective date.", rec.id))
    }

    if (!rec.sourceUrl && !source?.url) {
      issues.push(issue("missing_source_url", "block", "Recommendation is missing a source URL.", rec.id))
    }

    if (rec.sourceSystem === "PENDING" || source?.organization === "PENDING") {
      issues.push(issue("pending_source", "block", "Recommendation is tied to a pending source and must not be shown as actionable clinical guidance.", rec.id))
    }

    if (rec.requiresClinicianReview) {
      issues.push(issue("clinician_review_required", "review", "Recommendation explicitly requires clinician review before acting.", rec.id))
    }
  }

  const hasBlock = issues.some((item) => item.severity === "block")
  const hasReview = issues.some((item) => item.severity === "review")

  return {
    status: hasBlock ? "blocked" : hasReview ? "needs_review" : "passed",
    checkedAt: new Date().toISOString(),
    confidenceThreshold: CLINICAL_CONFIDENCE_THRESHOLD,
    recommendationCount: recommendations.length,
    sourceCompleteCount: recommendations.filter(hasSourceCompleteness).length,
    clinicianReviewCount: recommendations.filter((rec) => rec.requiresClinicianReview).length,
    issues,
  }
}

export function validateScreeningEngineResult(
  result: ScreeningEngineResult,
  options: ClinicalSafetyOptions = {}
): ClinicalSafetyReport {
  return validateScreeningRecommendations(result.recommendations, options)
}
