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
    .getByLabel("Tell us your history in plain English")
    .fill("I am 58, smoker, family history of stroke and diabetes.")

  await page.getByRole("button", { name: "Get My Free Recommendations" }).click()

  await expect(page.getByText("Recommended Screenings")).toBeVisible()
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
