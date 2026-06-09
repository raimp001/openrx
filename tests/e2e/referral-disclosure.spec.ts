import { expect, test } from "@playwright/test"
import {
  buildDisclosureAuditMetadata,
  consentScopeMatchesDisclosure,
  createConsentScopeSnapshot,
  resolveReferralDisclosureScope,
} from "@/lib/referral-disclosure"
import type { ScreeningIntake, ScreeningRecommendation } from "@/lib/screening/types"

const recommendation: ScreeningRecommendation = {
  id: "uspstf-colorectal-45-49",
  cancerType: "colorectal",
  screeningName: "Colorectal cancer screening",
  status: "due",
  riskCategory: "average_risk",
  rationale: "Age-based screening rule fired.",
  recommendedNextStep: "Discuss FIT, colonoscopy, CT colonography, or flexible sigmoidoscopy with a clinician.",
  sourceSystem: "USPSTF",
  sourceId: "uspstf-colorectal-2021",
  sourceVersion: "USPSTF 2021",
  evidenceGrade: "Grade B",
  requiresClinicianReview: false,
  patientFriendlyExplanation: "Colorectal screening starts at age 45 for average-risk adults.",
  clinicianSummary: "Average-risk 45-year-old due for colorectal screening.",
  nextSteps: ["request_colonoscopy"],
}

const intake: ScreeningIntake = {
  demographics: { age: 45, sexAtBirth: "male" },
  personalHistory: { colonPolyps: false, advancedAdenoma: false },
  familyHistory: [
    { relationship: "father", cancerType: "colorectal cancer", diagnosisAge: 72 },
    { relationship: "mother", cancerType: "breast cancer", diagnosisAge: 51 },
  ],
  genetics: { knownPathogenicVariants: [] },
  smoking: {},
  priorScreening: [
    { screeningType: "colonoscopy", date: "2014-01-01", result: "normal" },
    { screeningType: "mammogram", date: "2020-01-01", result: "normal" },
  ],
  symptoms: {},
}

test("identical recommendationId resolves identical disclosure scope", () => {
  const first = resolveReferralDisclosureScope({
    recommendationId: "uspstf-colorectal-45-49",
    recommendation,
    intake,
  })
  const second = resolveReferralDisclosureScope({
    recommendationId: "uspstf-colorectal-45-49",
    recommendation,
    intake,
  })

  expect(second.scopeHash).toBe(first.scopeHash)
  expect(second.fields.map((field) => field.path)).toEqual(first.fields.map((field) => field.path))
})

test("LLM path cannot add a field outside the disclosure template", () => {
  const scope = resolveReferralDisclosureScope({
    recommendationId: "uspstf-colorectal-45-49",
    recommendation,
    intake,
    llmSuggestedFields: [
      "intake.medications.all",
      "intake.fullRawPatientNarrative",
      "intake.familyHistory.breastCancer",
    ],
  })

  const paths = scope.fields.map((field) => field.path)
  expect(paths).not.toContain("intake.medications.all")
  expect(paths).not.toContain("intake.fullRawPatientNarrative")
  expect(paths).not.toContain("intake.familyHistory.breastCancer")
  expect(paths).toContain("intake.familyHistory.colorectalCancer")
})

test("consent scope hash must match disclosed fields and audit metadata", () => {
  const scope = resolveReferralDisclosureScope({
    recommendationId: "uspstf-colorectal-45-49",
    recommendation,
    intake,
  })
  const consent = createConsentScopeSnapshot({
    id: "consent_1",
    patientId: "patient_1",
    providerId: "provider_1",
    scope,
    grantedAt: "2026-06-09T12:00:00.000Z",
  })

  expect(consentScopeMatchesDisclosure(consent, scope)).toBe(true)

  const audit = buildDisclosureAuditMetadata({
    recommendationId: "uspstf-colorectal-45-49",
    scope,
    consent,
    baaVersion: "baa-2026-06",
  })

  expect(audit).toMatchObject({
    recommendationId: "uspstf-colorectal-45-49",
    disclosureTemplateVersion: "2026-06-09",
    consentRecordId: "consent_1",
    baaVersion: "baa-2026-06",
  })
  expect(JSON.stringify(audit)).toContain("intake.demographics.age")
})
