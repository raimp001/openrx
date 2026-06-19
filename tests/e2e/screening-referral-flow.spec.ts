import { expect, test } from "@playwright/test"
import {
  buildScreeningReferralPlan,
  type ScreeningReferralInput,
} from "@/lib/screening-referral-flow"
import type { ReferralProviderCandidate } from "@/lib/referral-workflow"
import type { CareDirectoryMatch } from "@/lib/npi-care-search"

const NOW = new Date("2026-06-09T12:00:00.000Z")

function activeProvider(overrides: Partial<ReferralProviderCandidate> = {}): ReferralProviderCandidate {
  return {
    id: "provider_1",
    npi: "1234567893",
    source: "self_onboarded",
    name: "OpenRx Gastroenterology",
    type: "individual",
    licenseNumber: "MD-12345",
    licenseState: "OR",
    nppes: {
      matched: true,
      registryName: "OpenRx Gastroenterology",
      practiceDomain: "openrxclinic.test",
      matchedAt: NOW.toISOString(),
    },
    identityProofing: {
      method: "third_party_identity",
      verifiedAt: NOW.toISOString(),
      verifier: "stripe_identity",
      referenceId: "vs_test_123",
    },
    baa: { signed: true, version: "baa-2026-06", signedAt: NOW.toISOString() },
    sanctions: { screenType: "oig_leie", status: "clear", source: "OIG_LEIE", runAt: NOW.toISOString() },
    licensure: { screenType: "state_license", status: "active", source: "oregon_medical_board", runAt: NOW.toISOString() },
    verificationStatus: "active",
    active: true,
    services: ["gastroenterology", "colonoscopy"],
    specialty: "Gastroenterology",
    acceptingNew: true,
    insurance: ["OpenRx Health Plan"],
    telehealth: false,
    ...overrides,
  }
}

const seededDirectoryMatch: CareDirectoryMatch = {
  kind: "provider",
  npi: "1999999990",
  name: "Public GI Listing",
  status: "A",
  specialty: "Gastroenterology",
  taxonomyCode: "207RG0100X",
  phone: "555-0100",
  fullAddress: "100 Registry Ave, Portland, OR 97201",
  confidence: "high",
}

test("age 45 male referral preview keeps the USPSTF colorectal source and disclosure scope", () => {
  const plan = buildScreeningReferralPlan({
    patientId: "patient_1",
    recommendationId: "uspstf-average-risk-colorectal",
    screeningInput: { age: 45, gender: "male" },
    providers: [activeProvider()],
    now: NOW,
  })

  expect(plan.supported).toBe(true)
  expect(plan.recommendation?.screeningName).toBe("Colorectal cancer screening")
  expect(plan.recommendation?.evidenceGrade).toBe("B")
  expect(plan.evidence).toMatchObject({
    sourceSystem: "USPSTF",
    evidenceGrade: "B",
    sourceUrl: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening",
  })
  expect(plan.referralTargets.map((provider) => provider.id)).toEqual(["provider_1"])
  expect(plan.displayedFields.map((field) => field.path)).toContain("intake.demographics.age")
})

test("public NPPES directory matches stay contact-only and cannot become referral targets", () => {
  const plan = buildScreeningReferralPlan({
    recommendationId: "uspstf-average-risk-colorectal",
    screeningInput: { age: 45, gender: "male" },
    directoryMatches: [seededDirectoryMatch],
    now: NOW,
  })

  expect(plan.supported).toBe(true)
  expect(plan.referralTargets).toEqual([])
  expect(plan.seededContactOnly).toHaveLength(1)
  expect(plan.seededContactOnly[0]).toMatchObject({
    id: "seeded_1999999990",
    source: "seeded",
    statusLabel: "Public registry listing, not yet partnered; contact directly.",
  })
  expect(plan.message).toContain("cannot receive PHI")
})

test("referral preview refuses recommendations the engine cannot reproduce from intake", () => {
  const plan = buildScreeningReferralPlan({
    recommendationId: "uspstf-average-risk-colorectal",
    screeningInput: { age: 20, gender: "male" },
    providers: [activeProvider()],
    now: NOW,
  })

  expect(plan.supported).toBe(false)
  expect(plan.message).toContain("could not reproduce")
  expect(plan.referralTargets).toEqual([])
})

test("BRCA family-history risk assessment can preview genetic counseling disclosure without LLM-authored fields", () => {
  const input: ScreeningReferralInput = {
    age: 30,
    gender: "female",
    familyHistory: [
      "mother had breast cancer at age 44",
      "aunt had breast cancer at age 45",
    ],
  }
  const plan = buildScreeningReferralPlan({
    recommendationId: "brca-family-history-risk-assessment",
    screeningInput: input,
    providers: [
      activeProvider({
        id: "genetics_1",
        name: "OpenRx Genetics",
        specialty: "Medical Genetics",
        services: ["medical genetics", "genetic counseling"],
        nppes: {
          matched: true,
          registryName: "OpenRx Genetics",
          practiceDomain: "openrxclinic.test",
          matchedAt: NOW.toISOString(),
        },
      }),
    ],
    now: NOW,
  })

  expect(plan.supported).toBe(true)
  expect(plan.evidence).toMatchObject({
    sourceSystem: "USPSTF",
    evidenceGrade: "B",
  })
  expect(plan.referralTargets.map((provider) => provider.id)).toEqual(["genetics_1"])
  expect(plan.displayedFields.map((field) => field.path)).toEqual([
    "recommendation.id",
    "recommendation.screeningName",
    "recommendation.sourceId",
    "recommendation.sourceVersion",
    "recommendation.evidenceGrade",
    "intake.demographics.age",
    "intake.demographics.sexAtBirth",
    "intake.familyHistory.allCancerSignals",
    "intake.genetics.knownPathogenicVariants",
  ])
  expect(plan.displayedFields.find((field) => field.path === "intake.familyHistory.allCancerSignals")?.required).toBe(true)
})
