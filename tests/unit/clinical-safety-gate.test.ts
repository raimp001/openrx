import { describe, expect, it } from "vitest"
import {
  CLINICAL_CONFIDENCE_THRESHOLD,
  validateScreeningEngineResult,
  validateScreeningRecommendations,
} from "@/lib/clinical-safety-gate"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import type { ScreeningRecommendation } from "@/lib/screening/types"

function firstEngineRecommendation(): ScreeningRecommendation {
  const result = recommendScreenings(screeningIntakeFromLegacy({ age: 45, gender: "male" }))
  const rec = result.recommendations[0]
  if (!rec) throw new Error("Expected at least one recommendation.")
  return rec
}

describe("clinical safety gate", () => {
  it("does not block source-complete deterministic screening output", () => {
    const result = recommendScreenings(screeningIntakeFromLegacy({ age: 45, gender: "male" }))
    const report = validateScreeningEngineResult(result)

    expect(report.status).not.toBe("blocked")
    expect(report.recommendationCount).toBe(result.recommendations.length)
    expect(report.sourceCompleteCount).toBe(result.recommendations.length)
    expect(report.issues.some((item) => item.severity === "block")).toBe(false)
  })

  it("blocks recommendations missing grade, source URL, or version metadata", () => {
    const rec = firstEngineRecommendation()
    const report = validateScreeningRecommendations([
      {
        ...rec,
        sourceId: undefined,
        sourceUrl: undefined,
        sourceVersion: undefined,
        evidenceGrade: undefined,
      },
    ])

    expect(report.status).toBe("blocked")
    expect(report.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["missing_source_id", "missing_evidence_grade", "missing_source_version", "missing_source_url"])
    )
  })

  it("blocks pending high-risk source placeholders from becoming actionable guidance", () => {
    const rec = firstEngineRecommendation()
    const report = validateScreeningRecommendations([
      {
        ...rec,
        id: "pending-high-risk-test",
        sourceId: "pending-high-risk-oncology",
        sourceSystem: "PENDING",
        sourceUrl: undefined,
        evidenceGrade: "Not graded",
        requiresClinicianReview: true,
      },
    ])

    expect(report.status).toBe("blocked")
    expect(report.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["pending_source", "missing_source_url", "clinician_review_required"])
    )
  })

  it("routes low model confidence to review even when sources are complete", () => {
    const rec = firstEngineRecommendation()
    const report = validateScreeningRecommendations([rec], {
      modelConfidenceScore: CLINICAL_CONFIDENCE_THRESHOLD - 0.1,
    })

    expect(report.status).toBe("needs_review")
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "low_confidence",
          severity: "review",
        }),
      ])
    )
  })
})
