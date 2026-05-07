import { expect, test } from "@playwright/test"

test("Ask page sends a patient question through the OpenClaw chat surface", async ({ page }) => {
  let receivedBody: { message?: string; agentId?: string } | null = null

  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connected: true,
        scheduler: { mode: "aws", message: "AWS worker heartbeat is active." },
      }),
    })
  })

  await page.route(/\/api\/openclaw\/chat$/, async (route) => {
    receivedBody = route.request().postDataJSON() as { message?: string; agentId?: string }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "chat-smoke-session",
        response: "I can help with the refill. I’ll check medication timing and coordinate the next step.",
        agentId: receivedBody.agentId,
        handoff: null,
        live: true,
      }),
    })
  })

  await page.goto("/chat")
  await expect(page.getByText("online")).toBeVisible()

  await page.getByLabel("Message OpenRx help").fill("I need a medication refill this week.")
  await page.getByRole("button", { name: "Send" }).click()

  await expect(page.getByText("I can help with the refill.")).toBeVisible()
  expect(receivedBody?.message).toContain("medication refill")
  expect(receivedBody?.agentId).toBe("rx")

  await page.getByRole("button", { name: "Clear" }).click()
  await expect(page.getByText("How can I help you today?")).toBeVisible()
})

test("Ask page saves and restores a clinical chat from the history sidebar", async ({ page }) => {
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })

  const question = `What screening is due for a 57-year-old man?`

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill(question)
  await page.getByTestId("chat-send-button").click()

  await expect(page.getByTestId("chat-message-agent").filter({ hasText: "Direct answer" }).last()).toBeVisible()
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
  await expect(page).toHaveURL(/\/chat\?c=/)
  const history = page.locator('aside[aria-label="Chat history"]:visible')
  await expect(history).toBeVisible()
  await expect(history.getByTestId("chat-history-item").filter({ hasText: "57-year-old man" }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByTestId("chat-message-user").filter({ hasText: question })).toBeVisible()
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()

  await history.getByTestId("chat-history-search").fill("57-year-old")
  await expect(history.getByTestId("chat-history-item").filter({ hasText: "57-year-old man" }).first()).toBeVisible()
})

test("Medication pricing search returns verified details and visible pricing", async ({ page }) => {
  await page.route(/\/api\/drug-prices\?/, async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: url.searchParams.get("q") || "metformin",
        drugInfo: [
          {
            brandName: "Glucophage",
            genericName: "Metformin",
            dosageForm: "Tablet",
            route: "Oral",
            manufacturer: "OpenRx Test Labeler",
            activeIngredients: "Metformin hydrochloride 500 mg",
            deaSchedule: "Non-controlled",
          },
        ],
        directPricing: {
          retail: "$12.00",
          options: [
            {
              source: "OpenRx cash card",
              price: "$4.20",
              savings: "65% lower than retail",
              url: "https://example.com/metformin",
              note: "Test pharmacy quote.",
            },
          ],
        },
        partialMatches: [],
        generalTips: [
          {
            tip: "Ask for a 90-day fill",
            detail: "It can lower the effective monthly price.",
          },
        ],
        pricingProviderConfigured: true,
        livePricingAvailable: true,
      }),
    })
  })

  await page.goto("/drug-prices")
  await page.getByLabel("Medication name").fill("metformin")
  await page.getByRole("button", { name: "Find prices" }).click()

  await expect(page.getByRole("heading", { name: "OpenRx cash card" }).first()).toBeVisible()
  await expect(page.getByText("$4.20").first()).toBeVisible()
  await expect(page.getByText("Glucophage")).toBeVisible()
  await expect(page.getByText("Ask for a 90-day fill")).toBeVisible()
})

test("Clinical trial matching submits criteria and renders next-step context", async ({ page }) => {
  await page.route(/\/api\/clinical-trials\/match\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total: 1,
        matches: [
          {
            id: "NCT00000001",
            title: "Precision Screening Study",
            phase: "Phase 2",
            status: "Recruiting",
            sponsor: "OpenRx Research Network",
            location: "Seattle, WA",
            remoteEligible: true,
            condition: "Prostate cancer",
            matchScore: 91,
            fit: "strong",
            reasons: ["Condition match is strong.", "Seattle has an active enrollment site."],
            url: "https://clinicaltrials.gov/study/NCT00000001",
            summary: "A focused screening and follow-up trial for eligible patients.",
          },
        ],
      }),
    })
  })

  await page.goto("/clinical-trials")
  await page.getByLabel("Condition").fill("prostate cancer")
  await page.getByLabel("Location").fill("Seattle")
  await page.getByRole("button", { name: "Match trials" }).click()

  await expect(page.getByText("Precision Screening Study")).toBeVisible()
  await expect(page.getByText("91")).toBeVisible()
  await expect(page.getByText("Condition match is strong.")).toBeVisible()
  await expect(page.getByRole("link", { name: /View study details/ })).toHaveAttribute(
    "href",
    "https://clinicaltrials.gov/study/NCT00000001"
  )
})
