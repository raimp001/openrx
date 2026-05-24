import { expect, test } from "@playwright/test"
import {
  advanceCarePlanStatus,
  carePlanFromProviderCandidate,
  carePlanFromScreeningRecommendations,
} from "@/lib/care-plan"
import { mergeCarePlan, readLocalCarePlans, writeLocalCarePlans } from "@/lib/hooks/use-care-plans"
import { createWorkflowEvent, safeEventMetadata } from "@/lib/product-analytics"
import { detectRedFlagText } from "@/lib/red-flag"
import { recommendScreenings } from "@/lib/screening/recommend"
import type { CareDirectoryMatch } from "@/lib/npi-care-search"

test("screening recommendations become a locally persistable Care Plan", () => {
  const screening = recommendScreenings({
    demographics: { age: 55, sexAtBirth: "male" },
    personalHistory: {},
    familyHistory: [],
    genetics: {},
    smoking: {},
    priorScreening: [],
    symptoms: {},
  })
  const plan = carePlanFromScreeningRecommendations(screening.recommendations, "Age 55; sex at birth: male", "chat")
  let stored = ""
  const storage = {
    getItem: () => stored || null,
    setItem: (_key: string, value: string) => {
      stored = value
    },
  }

  expect(plan.recommendations.some((item) => item.title.includes("Colorectal") && item.status === "new")).toBe(true)
  expect(writeLocalCarePlans([plan], storage)).toBe(true)
  expect(readLocalCarePlans(storage)[0].id).toBe(plan.id)

  const advanced = {
    ...plan,
    recommendations: plan.recommendations.map((item) => (
      item.title.includes("Colorectal") ? { ...item, status: advanceCarePlanStatus(item.status) } : item
    )),
  }
  const merged = mergeCarePlan([advanced], plan)
  expect(merged[0].recommendations.find((item) => item.title.includes("Colorectal"))?.status).toBe("discussed")
})

test("provider candidates are saved as unverified directory actions", () => {
  const candidate: CareDirectoryMatch = {
    kind: "provider",
    npi: "1234567890",
    name: "Example Primary Care",
    status: "A",
    specialty: "Internal Medicine",
    taxonomyCode: "207R00000X",
    phone: "503-555-0100",
    fullAddress: "Portland, OR 97204",
    confidence: "high",
    directoryEvidence: {
      source: "CMS_NPPES",
      npiFound: true,
      specialtyMatched: true,
      locationMatched: true,
    },
    openRxVerification: {
      licenseVerification: "pending",
      orderingAuthority: "pending",
      payerCoverageFit: "unknown",
      schedulingAvailability: "unknown",
    },
  }
  const plan = carePlanFromProviderCandidate(candidate, "Care search near ZIP 97204")
  const item = plan.recommendations[0]

  expect(item.sourceLabel).toContain("candidate")
  expect(item.rationale.toLowerCase()).toContain("confirm")
  expect(item.rationale.toLowerCase()).toContain("licensure")
  expect(item.confidence).toBe("context_dependent")
})

test("analytics accepts workflow metadata but drops PHI-shaped and prompt fields", () => {
  const metadata = safeEventMetadata({
    surface: "chat",
    status: "completed",
    prompt: "age 58 BRCA2 carrier",
    name: "Patient Name",
    phone: "503-555-0111",
    insuranceId: "SECRET-ID",
    address: "123 Health Street",
  })
  const event = createWorkflowEvent("care_plan_created", "sess_test", metadata)

  expect(event.metadata).toEqual({ surface: "chat", status: "completed" })
  expect(JSON.stringify(event)).not.toContain("BRCA2")
  expect(JSON.stringify(event)).not.toContain("SECRET-ID")
})

test("red-flag detection intercepts emergency phrases without diagnosing", () => {
  const chestPain = detectRedFlagText("I have crushing chest pain and severe shortness of breath")
  const stroke = detectRedFlagText("My face droop started suddenly and my speech is slurred")
  const crisis = detectRedFlagText("I am thinking of killing myself")

  expect(chestPain?.category).toBe("cardiopulmonary_emergency")
  expect(stroke?.category).toBe("stroke_symptoms")
  expect(crisis?.category).toBe("suicide_crisis")
  expect(chestPain?.emergencyMessage.toLowerCase()).toContain("911")
  expect(chestPain?.emergencyMessage.toLowerCase()).not.toContain("diagnos")
})
