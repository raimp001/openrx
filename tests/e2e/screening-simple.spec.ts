import { expect, test, type Page } from "@playwright/test"
import {
  PROVIDER_HANDOFF_STORAGE_KEY,
  SCREENING_HANDOFF_STORAGE_KEY,
} from "@/lib/care-handoff"

async function mockScreeningApis(page: Page) {
  await page.route(/\/api\/screening\/intake$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        extracted: {
          age: 58,
          bmi: 29.2,
          smoker: true,
          symptoms: ["fatigue"],
          familyHistory: ["father had prostate cancer at age 52"],
          conditions: ["BRCA mutation carrier"],
        },
      }),
    })
  })

  await page.route(/\/api\/screening\/assess$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        patientId: "wallet-1234",
        generatedAt: "2026-02-26T12:00:00.000Z",
        overallRiskScore: 64,
        riskTier: "moderate",
        factors: [
          {
            label: "Family history signals",
            impact: "monitor",
            scoreDelta: 9,
            evidence: "Multiple family risk factors reported.",
          },
        ],
        recommendedScreenings: [
          {
            id: "colon-screening",
            name: "Colorectal cancer screening",
            priority: "medium",
            ownerAgent: "scheduling",
            reason: "Adults over 45 should stay current on colon screening cadence.",
          },
        ],
        structuredRecommendations: [
          {
            id: "uspstf-average-risk-colorectal",
            cancerType: "colorectal",
            screeningName: "Colorectal cancer screening",
            status: "due",
            riskCategory: "average_risk",
            rationale: "Adults 45-75 should stay current on colorectal cancer screening.",
            recommendedNextStep: "Request colonoscopy or discuss FIT/colonoscopy options with a clinician.",
            suggestedTiming: "Start now",
            sourceSystem: "USPSTF",
            evidenceGrade: "B",
            requiresClinicianReview: false,
            patientFriendlyExplanation: "Based on age, colorectal screening may be due now.",
            clinicianSummary: "USPSTF average-risk CRC screening; verify prior screening and symptoms.",
            nextSteps: ["request_colonoscopy", "request_care_navigation", "download_clinician_summary"],
          },
        ],
        nextActions: ["Review this plan with your clinician within 30 days."],
        localCareConnections: [],
        evidenceCitations: [
          {
            id: "uspstf-colon",
            title: "USPSTF colorectal cancer screening",
            url: "https://www.uspreventiveservicestaskforce.org",
            source: "USPSTF",
            summary: "Adults 45-75 should undergo colorectal cancer screening.",
            type: "guideline",
          },
        ],
        accessLevel: "preview",
        isPreview: true,
      }),
    })
  })
}

test("simple screening intake returns free recommendations", async ({ page }) => {
  await mockScreeningApis(page)

  await page.goto("/screening")

  await page
    .getByTestId("screening-narrative-input")
    .fill("I am 58, smoker, family history of stroke and diabetes.")

  await page.getByTestId("screening-submit-preview").click()

  await expect(page.getByText("Recommended Screenings")).toBeVisible()
  await expect(page.getByTestId("screening-section-due_now")).toBeVisible()
  await expect(page.getByTestId("screening-recommendation-card")).toHaveCount(1)
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
  await expect(page.getByText("Evidence Sources")).toBeVisible()
  await expect(page.getByText("Failed to compute screening assessment.")).toHaveCount(0)

  await page.getByRole("button", { name: "Generate Advanced Review" }).click()
  await expect(page.getByText("Complete payment before advanced review")).toBeVisible()
  await expect(page.getByText("Connect payment access to unlock advanced review.")).toBeVisible()
})

test("screening handoff from chat auto-runs the free recommendations", async ({ page }) => {
  await mockScreeningApis(page)
  await page.addInitScript(
    ([key]) => {
      window.sessionStorage.setItem(key, JSON.stringify({
        source: "chat",
        narrative: "I am 58 male, father had prostate cancer at 52, BRCA mutation carrier. What recs?",
        autorun: true,
        createdAt: Date.now(),
      }))
    },
    [SCREENING_HANDOFF_STORAGE_KEY]
  )

  await page.goto("/screening?handoff=chat")

  await expect(page.getByText("Context carried forward.")).toBeVisible()
  await expect(page.getByText("Recommended Screenings")).toBeVisible()
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
})

test("screening recommendation can hand off directly to care search", async ({ page }) => {
  await mockScreeningApis(page)
  let providerQuery = ""
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    providerQuery = new URL(route.request().url()).searchParams.get("q") || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: providerQuery,
          serviceTypes: ["provider"],
          city: "",
          state: "",
          zip: "",
          query: providerQuery,
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Gastroenterology",
            specialty: "Gastroenterology",
            taxonomyCode: "207RG0100X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0101",
          },
        ],
      }),
    })
  })

  await page.goto("/screening")
  await page
    .getByTestId("screening-narrative-input")
    .fill("I am 58 and need colorectal cancer screening.")
  await page.getByTestId("screening-submit-preview").click()
  await page.getByTestId("recommendation-find-schedule").first().click()

  await expect(page).toHaveURL(/\/providers\?handoff=screening&autorun=1&q=/)
  await expect(page.getByText("Loaded the screening recommendation")).toBeVisible()
  await expect(page.getByText("OpenRx Gastroenterology").first()).toBeVisible()
  expect(providerQuery.toLowerCase()).toContain("gastroenterology")
  expect(providerQuery.toLowerCase()).toContain("colonoscopy")
})

test("screening recommendation handoff still works when sessionStorage is unavailable", async ({ page }) => {
  await mockScreeningApis(page)
  let providerQuery = ""
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked in sandbox", "SecurityError")
      },
    })
  })
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    providerQuery = new URL(route.request().url()).searchParams.get("q") || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: providerQuery,
          serviceTypes: ["provider"],
          city: "",
          state: "",
          zip: "",
          query: providerQuery,
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Gastroenterology",
            specialty: "Gastroenterology",
            taxonomyCode: "207RG0100X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0101",
          },
        ],
      }),
    })
  })

  await page.goto("/screening")
  await page.getByTestId("screening-narrative-input").fill("I am 58 and need colorectal cancer screening.")
  await page.getByTestId("screening-submit-preview").click()
  await page.getByTestId("recommendation-find-schedule").first().click()

  await expect(page).toHaveURL(/\/providers\?handoff=screening&autorun=1&q=/)
  await expect(page.getByText("Loaded the screening recommendation")).toBeVisible()
  await expect(page.getByText("OpenRx Gastroenterology").first()).toBeVisible()
  expect(providerQuery.toLowerCase()).toContain("colonoscopy")
})

test("screening recommendation can find a provider and carry that provider into scheduling", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await mockScreeningApis(page)
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: "Find gastroenterology providers for colonoscopy near Portland OR 97204",
          serviceTypes: ["provider"],
          city: "Portland",
          state: "OR",
          zip: "97204",
          query: "gastroenterology providers for colonoscopy",
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Gastroenterology",
            specialty: "Gastroenterology",
            taxonomyCode: "207RG0100X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0101",
          },
        ],
      }),
    })
  })
  await page.route(/\/api\/live\/patient-snapshot.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "database",
        walletAddress: null,
        generatedAt: new Date().toISOString(),
        patient: null,
        physicians: [],
        appointments: [],
        claims: [],
        prescriptions: [],
        priorAuths: [],
        messages: [],
        labResults: [],
        vitals: [],
        vaccinations: [],
        referrals: [],
        careTimeline: [],
      }),
    })
  })

  await page.goto("/screening")
  await page
    .getByTestId("screening-narrative-input")
    .fill("I am 58 and need colorectal cancer screening.")
  await page.getByTestId("screening-submit-preview").click()
  await page.getByTestId("recommendation-find-schedule").first().click()

  await expect(page).toHaveURL(/\/providers\?handoff=screening&autorun=1&q=/)
  await page.getByTestId("provider-schedule-button").first().click()
  await expect(page).toHaveURL(/\/scheduling\?handoff=provider&source=provider&providerName=/)
  await expect(page.getByTestId("scheduling-handoff-card")).toBeVisible()
  await expect(page.getByText("Ready to request this visit.")).toBeVisible()
  await expect(page.getByText("OpenRx Gastroenterology").first()).toBeVisible()
  await page.getByTestId("scheduling-request-button").click()
  await expect(page.getByText("Scheduling request staged.")).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("provider handoff from chat auto-searches without a second button press", async ({ page }) => {
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: "Find a radiology center near Portland OR 97204",
          serviceTypes: ["radiology"],
          city: "Portland",
          state: "OR",
          zip: "97204",
          query: "radiology near Portland OR 97204",
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "radiology",
            npi: "1234567890",
            name: "OpenRx Imaging Portland",
            specialty: "Radiology",
            taxonomyCode: "261QR0200X",
            status: "A",
            confidence: "high",
            fullAddress: "100 SW Main St, Portland, OR 97204",
            phone: "503-555-0100",
          },
        ],
      }),
    })
  })
  await page.addInitScript(
    ([key]) => {
      window.sessionStorage.setItem(key, JSON.stringify({
        source: "chat",
        query: "Find a radiology center near Portland OR 97204",
        autorun: true,
        createdAt: Date.now(),
      }))
    },
    [PROVIDER_HANDOFF_STORAGE_KEY]
  )

  await page.goto("/providers?handoff=chat")

  await expect(page.getByText("Loaded your chat context")).toBeVisible()
  await expect(page.getByText("Matched network")).toBeVisible()
  await expect(page.getByText("OpenRx Imaging Portland").first()).toBeVisible()
})

test("landing ask routes clear care-search intent to providers without generic chat", async ({ page }) => {
  let providerQuery = ""
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    providerQuery = new URL(route.request().url()).searchParams.get("q") || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: providerQuery,
          serviceTypes: ["provider"],
          city: "",
          state: "",
          zip: "",
          query: providerQuery,
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Primary Care",
            specialty: "Internal Medicine",
            taxonomyCode: "207R00000X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0102",
          },
        ],
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Find primary care" }).click()

  await expect(page).toHaveURL(/\/providers\?handoff=chat/)
  await expect(page.getByText("Loaded your chat context")).toBeVisible()
  await expect(page.getByText("OpenRx Primary Care").first()).toBeVisible()
  expect(providerQuery.toLowerCase()).toContain("primary care")
})

test("chat prompt autorun answers after landing submit without a second send", async ({ page }) => {
  let postedMessage = ""
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })
  await page.route(/\/api\/openclaw\/chat$/, async (route) => {
    const body = route.request().postDataJSON() as { message?: string }
    postedMessage = body.message || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: "Review the bill amount, claim status, and insurer explanation first.",
        agentId: "billing",
      }),
    })
  })

  await page.goto("/chat?prompt=Explain%20this%20bill&topic=billing&autorun=1")

  await expect(page.getByText("Review the bill amount")).toBeVisible()
  expect(postedMessage).toBe("Explain this bill")
})
