import { expect, test } from "@playwright/test"

test("simple screening intake returns free recommendations", async ({ page }) => {
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
          familyHistory: ["stroke", "diabetes"],
          conditions: ["hypertension"],
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

  await page.goto("/screening")

  await page
    .getByLabel("Tell us your history in plain English")
    .fill("I am 58, smoker, family history of stroke and diabetes.")

  await page.getByRole("button", { name: "Get My Free Recommendations" }).click()

  await expect(page.getByText("Recommended Screenings")).toBeVisible()
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
  await expect(page.getByText("Evidence Sources")).toBeVisible()
  await expect(page.getByText("Failed to compute screening assessment.")).toHaveCount(0)

  await page.getByRole("button", { name: "Generate Deep Dive (Paid)" }).click()
  await expect(page.getByText("Complete Base Pay Before Deep Recommendation")).toBeVisible()
  await expect(page.getByText("Connect your wallet to unlock the paid deep-dive recommendation.")).toBeVisible()
})
