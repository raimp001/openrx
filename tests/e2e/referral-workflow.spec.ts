import { expect, test } from "@playwright/test"
import { createConsentScopeSnapshot, narrowDisclosureScope, requiredDisclosureFieldIds, resolveReferralDisclosureScope } from "@/lib/referral-disclosure"
import {
  buildPatientReferralShortlist,
  createConsentedReferralRequestDraft,
  type ReferralProviderCandidate,
} from "@/lib/referral-workflow"
import type { ScreeningIntake, ScreeningRecommendation } from "@/lib/screening/types"

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
    distanceMiles: 4,
    acceptingNew: true,
    insurance: ["OpenRx Health Plan"],
    telehealth: false,
    ...overrides,
  }
}

const recommendation: ScreeningRecommendation = {
  id: "uspstf-average-risk-colorectal",
  cancerType: "colorectal cancer",
  screeningName: "Colorectal cancer screening",
  status: "due",
  riskCategory: "average_risk",
  rationale: "USPSTF recommends colorectal cancer screening for average-risk adults ages 45 to 75.",
  recommendedNextStep: "Request care navigation for FIT, stool DNA, colonoscopy, or another appropriate screening option.",
  suggestedTiming: "Start or update screening now",
  sourceSystem: "USPSTF",
  sourceId: "uspstf-crc-2021",
  sourceVersion: "2021-05-18",
  engineVersion: "openrx-screening-engine-2026-06-09",
  evidenceGrade: "B",
  requiresClinicianReview: false,
  patientFriendlyExplanation: "Based on age alone, this screening may be recommended for average-risk adults.",
  clinicianSummary: "Average-risk USPSTF colorectal screening logic applied.",
  nextSteps: ["request_colonoscopy"],
}

const intake: ScreeningIntake = {
  demographics: { age: 45, sexAtBirth: "male" },
  personalHistory: { colonPolyps: false, advancedAdenoma: false },
  familyHistory: [],
  genetics: { knownPathogenicVariants: [] },
  smoking: {},
  priorScreening: [],
  symptoms: {},
}

function consentFor(providerId = "provider_1", selectedFieldIds?: string[]) {
  const fullScope = resolveReferralDisclosureScope({
    recommendationId: recommendation.id,
    recommendation,
    intake,
  })
  const scope = narrowDisclosureScope({
    scope: fullScope,
    selectedFieldIds: selectedFieldIds || fullScope.fields.map((field) => field.path),
  })
  return {
    fullScope,
    scope,
    consent: createConsentScopeSnapshot({
      id: "consent_1",
      patientId: "patient_1",
      providerId,
      scope,
      grantedAt: NOW.toISOString(),
    }),
  }
}

test("ReferralRequest cannot be created without matching consent and exact scope hash", () => {
  const provider = activeProvider()
  const { scope, consent } = consentFor(provider.id)
  const displayedFields = scope.fields.map((field) => ({ path: field.path, label: field.label }))

  expect(() => createConsentedReferralRequestDraft({
    id: "ref_1",
    patientId: "patient_1",
    provider,
    recommendation,
    intake,
    displayedFields,
    now: NOW,
  })).toThrow(/patient consent/)

  const referral = createConsentedReferralRequestDraft({
    id: "ref_1",
    patientId: "patient_1",
    provider,
    recommendation,
    intake,
    consent,
    displayedFields,
    now: NOW,
  })

  expect(referral.status).toBe("requested")
  expect(referral.sharedDataScopeHash).toBe(scope.scopeHash)
  expect(referral.receipt).toMatchObject({
    consentId: "consent_1",
    providerName: "OpenRx Gastroenterology",
  })
  expect(referral.consentId).toBe("consent_1")
  expect(referral.auditMetadata).toMatchObject({
    recommendationId: recommendation.id,
    disclosureTemplateVersion: "2026-06-09",
    consentRecordId: "consent_1",
    baaVersion: "baa-2026-06",
  })
})

test("providers without signed BAA are blocked and alternatives remain available", () => {
  const noBaa = activeProvider({
    id: "provider_no_baa",
    baa: { signed: false },
  })
  const alternative = activeProvider({
    id: "provider_alt",
    name: "OpenRx GI Alternative",
    nppes: {
      matched: true,
      registryName: "OpenRx GI Alternative",
      practiceDomain: "openrxclinic.test",
      matchedAt: NOW.toISOString(),
    },
    distanceMiles: 8,
  })
  const { scope, consent } = consentFor(noBaa.id)
  const displayedFields = scope.fields.map((field) => ({ path: field.path, label: field.label }))

  expect(() => createConsentedReferralRequestDraft({
    id: "ref_1",
    patientId: "patient_1",
    provider: noBaa,
    recommendation,
    intake,
    consent,
    displayedFields,
    now: NOW,
  })).toThrow(/BAA-signed/)

  const shortlist = buildPatientReferralShortlist({
    providers: [noBaa, alternative],
    requiredServices: ["colonoscopy"],
  })
  expect(shortlist.referralTargets.map((provider) => provider.id)).toEqual(["provider_alt"])
})

test("shortlist excludes unverified inactive and seeded providers as referral targets", () => {
  const verified = activeProvider({ id: "verified", distanceMiles: 2 })
  const inactive = activeProvider({ id: "inactive", active: false, verificationStatus: "inactive" })
  const pending = activeProvider({ id: "pending", active: false, verificationStatus: "pending" })
  const seeded = activeProvider({
    id: "seeded",
    source: "seeded",
    active: false,
    verificationStatus: "pending",
    identityProofing: undefined,
    baa: undefined,
    nppesSnapshotAt: NOW.toISOString(),
  })

  const shortlist = buildPatientReferralShortlist({
    providers: [inactive, seeded, pending, verified],
    requiredServices: ["colonoscopy"],
    now: NOW,
  })

  expect(shortlist.referralTargets.map((provider) => provider.id)).toEqual(["verified"])
  expect(shortlist.seededContactOnly.map((provider) => provider.id)).toEqual(["seeded"])
})

test("consent screen field list must be byte-equal to transmitted fields", () => {
  const provider = activeProvider()
  const { scope, consent } = consentFor(provider.id)
  const displayedFields = scope.fields.map((field) => ({ path: field.path, label: field.label }))

  expect(() => createConsentedReferralRequestDraft({
    id: "ref_1",
    patientId: "patient_1",
    provider,
    recommendation,
    intake,
    consent,
    selectedFieldIds: scope.fields.map((field) => field.path),
    displayedFields: displayedFields.slice(1),
    now: NOW,
  })).toThrow(/byte-equal/)

  const referral = createConsentedReferralRequestDraft({
    id: "ref_1",
    patientId: "patient_1",
    provider,
    recommendation,
    intake,
    consent,
    selectedFieldIds: scope.fields.map((field) => field.path),
    displayedFields,
    now: NOW,
  })

  expect(JSON.stringify(referral.transmittedFields.map((field) => ({ path: field.path, label: field.label })))).toBe(JSON.stringify(displayedFields))
})

test("optional field removed from consent is not transmitted", () => {
  const provider = activeProvider()
  const fullScope = resolveReferralDisclosureScope({
    recommendationId: recommendation.id,
    recommendation,
    intake,
  })
  const requiredOnlyIds = requiredDisclosureFieldIds(fullScope)
  const { consent } = consentFor(provider.id, requiredOnlyIds)
  const referral = createConsentedReferralRequestDraft({
    id: "ref_required_only",
    patientId: "patient_1",
    provider,
    recommendation,
    intake,
    consent,
    selectedFieldIds: requiredOnlyIds,
    now: NOW,
  })

  expect(referral.transmittedFields.every((field) => field.required)).toBe(true)
  expect(referral.transmittedFields.map((field) => field.path)).not.toContain("intake.priorScreening.colorectal")
  expect(referral.sharedDataScopeHash).toBe(consent.disclosurePayloadHash)
})

test("binding prevents consent reuse across provider or recommendation", () => {
  const provider = activeProvider()
  const { consent } = consentFor("provider_a")

  expect(() => createConsentedReferralRequestDraft({
    id: "ref_wrong_provider",
    patientId: "patient_1",
    provider,
    recommendation,
    intake,
    consent,
    selectedFieldIds: consent.selectedFieldIds,
    now: NOW,
  })).toThrow(/does not match/)
})
