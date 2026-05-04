import { expect, test } from "@playwright/test"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import { createScreeningNextStepRequest } from "@/lib/screening/next-step-store"
import { parseScreeningIntakeNarrative } from "@/lib/screening-intake"
import { buildDeterministicScreeningResponse } from "@/lib/ai-engine"
import { assessHealthScreening } from "@/lib/basehealth"
import {
  buildOpenAIClinicalEvidencePrompt,
  resolveOpenAIClinicalEvidenceConfig,
} from "@/lib/screening-evidence"
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

test("generic BRCA carrier prompt returns baseline screening and inherited-risk routing", () => {
  const parsed = parseScreeningIntakeNarrative("I am 58 male, father had prostate cancer at 52, BRCA mutation carrier")
  const result = recommendScreenings(screeningIntakeFromLegacy({
    age: parsed.extracted.age,
    gender: parsed.extracted.gender,
    familyHistory: parsed.extracted.familyHistory,
    conditions: parsed.extracted.conditions,
    smoker: parsed.extracted.smoker,
  }))

  expect(parsed.extracted.age).toBe(58)
  expect(parsed.extracted.gender).toBe("male")
  expect(parsed.extracted.genes).toContain("BRCA")
  expect(result.recommendations.some((rec) => rec.id === "hereditary-cancer-genetic-counseling")).toBe(true)
  expect(result.recommendations.some((rec) => rec.id === "uspstf-average-risk-colorectal" && rec.status === "due")).toBe(true)
  expect(result.recommendations.some((rec) => rec.id === "uspstf-prostate-shared-decision" && rec.status === "discuss")).toBe(true)
  expect(result.recommendations.some((rec) => rec.id === "lung-smoking-history-needed" && rec.status === "discuss")).toBe(true)
})

test("assessment promotes actionable inherited-risk recommendations instead of only a low risk score", () => {
  const assessment = assessHealthScreening({
    age: 58,
    gender: "male",
    familyHistory: ["father had prostate cancer at age 52"],
    conditions: ["reported germline mutation signal"],
  })
  const names = assessment.recommendedScreenings.map((rec) => rec.name)

  expect(assessment.riskTier).not.toBe("low")
  expect(names).toContain("Colorectal cancer screening")
  expect(names).toContain("PSA screening discussion")
  expect(names).toContain("Genetic counseling and high-risk screening review")
  expect(assessment.structuredRecommendations?.some((rec) => rec.id === "hereditary-cancer-genetic-counseling")).toBe(true)
  expect(assessment.structuredRecommendations?.some((rec) => rec.id === "lung-smoking-history-needed")).toBe(true)
})

test("screening chat handles compact family-history narrative without provider fallback", () => {
  const parsed = parseScreeningIntakeNarrative("age 55 male hx colorectal cancer in father")
  const response = buildDeterministicScreeningResponse("age 55 male hx colorectal cancer in father")

  expect(parsed.extracted.age).toBe(55)
  expect(parsed.extracted.gender).toBe("male")
  expect(parsed.extracted.familyHistory).toContain("family history of colorectal cancer")
  expect(response).toContain("Colorectal")
  expect(response.toLowerCase()).toContain("clinician review")
  expect(response.toLowerCase()).not.toContain("try again")
  expect(response.toLowerCase()).not.toContain("high volume")
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

test("OpenAI clinical evidence config enables source search only when a server key exists", () => {
  const disabled = resolveOpenAIClinicalEvidenceConfig({
    OPENRX_OPENAI_EVIDENCE_MODE: "auto",
    OPENAI_API_KEY: "",
  })
  const enabled = resolveOpenAIClinicalEvidenceConfig({
    OPENRX_OPENAI_EVIDENCE_MODE: "auto",
    OPENAI_API_KEY: "sk-test",
  })

  expect(disabled.enabled).toBe(false)
  expect(enabled.enabled).toBe(true)
  expect(enabled.model).toBe("gpt-5.4")
  expect(enabled.allowedDomains).toContain("pubmed.ncbi.nlm.nih.gov")
  expect(enabled.allowedDomains).toContain("uspreventiveservicestaskforce.org")
})

test("OpenAI clinical evidence prompt is citation-oriented and does not include identity plumbing", () => {
  const assessment = assessHealthScreening({
    age: 58,
    gender: "male",
    familyHistory: ["father had prostate cancer at age 52"],
    conditions: ["BRCA mutation carrier"],
  })
  const prompt = buildOpenAIClinicalEvidencePrompt({
    assessment,
    familyHistory: ["father had prostate cancer at age 52"],
    conditions: ["BRCA mutation carrier"],
  }).toLowerCase()

  expect(prompt).toContain("uspstf")
  expect(prompt).toContain("source citations")
  expect(prompt).toContain("clinician review")
  expect(prompt).toContain("do not include wallet")
  expect(prompt).not.toContain("patientid")
  expect(prompt).not.toContain("0x55826e51751c49e6e2a2d9840745787f7fd977bd")
})
