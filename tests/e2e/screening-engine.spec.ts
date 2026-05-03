import { expect, test } from "@playwright/test"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import { createScreeningNextStepRequest } from "@/lib/screening/next-step-store"
import type { ScreeningIntake } from "@/lib/screening/types"

function intake(overrides: Partial<ScreeningIntake> = {}): ScreeningIntake {
  return {
    demographics: { age: 50, sexAtBirth: "male" },
    personalHistory: {},
    familyHistory: [],
    genetics: {},
    smoking: {},
    priorScreening: [],
    symptoms: {},
    ...overrides,
  }
}

test("average-risk colorectal screening is due for adults 45-75", () => {
  const result = recommendScreenings(intake({ demographics: { age: 52, sexAtBirth: "male" } }))
  const crc = result.recommendations.find((rec) => rec.id === "uspstf-average-risk-colorectal")

  expect(crc?.status).toBe("due")
  expect(crc?.riskCategory).toBe("average_risk")
  expect(crc?.sourceSystem).toBe("USPSTF")
  expect(crc?.nextSteps).toContain("request_colonoscopy")
})

test("recent normal colorectal screening changes due status to not_due", () => {
  const result = recommendScreenings(intake({
    demographics: { age: 52, sexAtBirth: "male" },
    priorScreening: [{ screeningType: "colonoscopy", date: "2023-01-01", result: "normal" }],
  }))
  const crc = result.recommendations.find((rec) => rec.id === "uspstf-average-risk-colorectal")

  expect(crc?.status).toBe("not_due")
  expect(crc?.patientFriendlyExplanation.toLowerCase()).toContain("may not be due yet")
})

test("colorectal family history routes away from blind average-risk logic", () => {
  const result = recommendScreenings(intake({
    demographics: { age: 46, sexAtBirth: "female" },
    familyHistory: [{ relationship: "father", cancerType: "colorectal cancer", diagnosisAge: 52 }],
  }))
  const familyReview = result.recommendations.find((rec) => rec.id === "crc-family-history-review")

  expect(familyReview?.status).toBe("needs_clinician_review")
  expect(familyReview?.riskCategory).toBe("increased_risk")
  expect(familyReview?.requiresClinicianReview).toBe(true)
  expect(result.recommendations.find((rec) => rec.id === "uspstf-average-risk-colorectal")).toBeUndefined()
})

test("BRCA2 routes to hereditary genetics and high-risk review", () => {
  const result = recommendScreenings(intake({
    demographics: { age: 39, sexAtBirth: "female" },
    genetics: { knownPathogenicVariants: [{ gene: "BRCA2", classification: "pathogenic" }] },
  }))
  const hereditary = result.recommendations.find((rec) => rec.id === "hereditary-cancer-genetic-counseling")

  expect(hereditary?.status).toBe("high_risk")
  expect(hereditary?.riskCategory).toBe("hereditary_risk")
  expect(hereditary?.sourceSystem).toBe("PENDING")
  expect(hereditary?.nextSteps).toContain("request_genetic_counseling")
})

test("personal history of prostate cancer is surveillance, not routine PSA screening", () => {
  const result = recommendScreenings(intake({
    demographics: { age: 62, sexAtBirth: "male" },
    personalHistory: { cancers: [{ type: "prostate cancer", diagnosisAge: 58 }] },
  }))

  expect(result.recommendations.find((rec) => rec.id === "personal-history-prostate-cancer")?.status).toBe("surveillance_or_follow_up")
  expect(result.recommendations.find((rec) => rec.id === "uspstf-prostate-shared-decision")).toBeUndefined()
})

test("red-flag symptoms trigger urgent clinician review instead of routine screening", () => {
  const result = recommendScreenings(intake({
    demographics: { age: 49, sexAtBirth: "female" },
    symptoms: { rectalBleeding: true },
  }))
  const urgent = result.recommendations.find((rec) => rec.id === "red-flag-rectalBleeding")

  expect(urgent?.status).toBe("urgent_clinician_review")
  expect(urgent?.riskCategory).toBe("symptomatic")
  expect(urgent?.nextSteps).toContain("seek_urgent_care")
  expect(urgent?.patientFriendlyExplanation.toLowerCase()).toContain("not treat this as routine screening")
})

test("unknown or incomplete intake returns unknown instead of unsafe certainty", () => {
  const result = recommendScreenings(intake({ demographics: {}, personalHistory: {}, familyHistory: [], genetics: {}, smoking: {}, priorScreening: [], symptoms: {} }))
  const unknown = result.recommendations.find((rec) => rec.status === "unknown")

  expect(unknown?.requiresClinicianReview).toBe(false)
  expect(unknown?.recommendedNextStep.toLowerCase()).toContain("add age")
})

test("legacy narrative extraction feeds hereditary and family-history screening safely", () => {
  const result = recommendScreenings(screeningIntakeFromLegacy({
    age: 58,
    gender: "male",
    familyHistory: ["father had prostate cancer at age 52"],
    conditions: ["BRCA2 mutation carrier"],
  }))

  expect(result.recommendations.some((rec) => rec.id === "hereditary-cancer-genetic-counseling")).toBe(true)
  expect(result.recommendations.every((rec) => !rec.patientFriendlyExplanation.toLowerCase().includes("you have cancer"))).toBe(true)
})

test("patient-facing recommendation language avoids unsafe certainty", () => {
  const result = recommendScreenings(intake({
    demographics: { age: 58, sexAtBirth: "female" },
    genetics: { knownPathogenicVariants: [{ gene: "PALB2", classification: "likely_pathogenic" }] },
    familyHistory: [{ relationship: "mother", cancerType: "breast cancer", diagnosisAge: 44 }],
    symptoms: { breastMass: true },
  }))
  const text = result.recommendations.map((rec) => `${rec.patientFriendlyExplanation} ${rec.rationale}`).join(" ").toLowerCase()

  expect(text).not.toContain("definitely")
  expect(text).not.toContain("guaranteed")
  expect(text).not.toContain("replaces your doctor")
})

test("screening next-step requests use internal IDs and do not store raw wallet addresses", async () => {
  process.env.OPENRX_SCREENING_REQUESTS_PATH = `/tmp/openrx-next-step-${Date.now()}.json`
  const walletAddress = "0x55826e51751c49e6e2a2D9840745787f7fd977Bd"
  const request = await createScreeningNextStepRequest({
    walletAddress,
    patientId: "patient-demo",
    recommendationId: "uspstf-average-risk-colorectal",
    screeningName: "Colorectal cancer screening",
    requestedAction: "request_colonoscopy",
    clinicianSummary: "Average-risk CRC screening request.",
  })

  expect(request.status).toBe("requested")
  expect(request.internalUserId).toMatch(/^usr_/)
  expect(request.walletHash).toHaveLength(64)
  expect(JSON.stringify(request).toLowerCase()).not.toContain(walletAddress.toLowerCase())
})
