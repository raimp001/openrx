import { expect, test } from "@playwright/test"
import { buildCareNavigationResponse } from "@/lib/ai-engine"
import { buildActionPlan } from "@/lib/care-handoff"

test("scheduling colon cancer screening returns actionable pathway, not a survey", () => {
  const response = buildCareNavigationResponse("How do I schedule colon cancer screening?")
  expect(response).not.toBeNull()
  expect(response!).toContain("Direct answer")
  expect(response!.toLowerCase()).toContain("colorectal cancer screening")
  // Concrete step ladder must lead the answer.
  expect(response!).toMatch(/Step\s*1\./)
  expect(response!).toMatch(/Step\s*4\./)
  // Live USPSTF source.
  expect(response!).toContain("https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening")
  // Refining follow-up surfaced as chips.
  expect(response!).toContain("Question to refine this")
  // No "tell me visit type/location/insurance" survey wording.
  expect(response!.toLowerCase()).not.toContain("tell me the visit type, location, urgency")
})

test("care-navigation pathway also covers lung, breast, cervical, prostate", () => {
  const lung = buildCareNavigationResponse("How do I schedule lung cancer screening?")
  expect(lung).toContain("Lung-RADS")
  const mammo = buildCareNavigationResponse("Find a mammogram center near me")
  expect(mammo).toContain("Breast cancer screening")
  const cervix = buildCareNavigationResponse("Schedule a Pap test")
  expect(cervix).toContain("Cervical cancer screening")
  const prostate = buildCareNavigationResponse("How do I get a PSA test?")
  expect(prostate).toContain("shared decision-making")
})

test("non-actionable clinical questions do not trigger the care-navigation pathway", () => {
  const generic = buildCareNavigationResponse("What is colon cancer?")
  expect(generic).toBeNull()
})

test("screening action plan exposes Find care, Request order, Schedule study, and Review eligibility CTAs", () => {
  const items = buildActionPlan("How do I schedule colon cancer screening?", "screening")
  const ids = items.map((item) => item.id)
  expect(ids).toContain("check-screening-eligibility")
  expect(ids).toContain("find-care")
  expect(ids).toContain("request-order")
  expect(ids).toContain("schedule-followup")
  for (const item of items) {
    expect(item.href).toBeTruthy()
  }
})

test("homepage chat widget routes a typed question into /chat with autorun prefilled", async ({ page }) => {
  await page.goto("/")
  const input = page.getByTestId("care-ask-input")
  await expect(input).toBeVisible()
  const question = "How do I schedule colon cancer screening?"
  await input.fill(question)
  await page.getByTestId("care-ask-submit").click()
  await expect(page).toHaveURL(/\/chat\?/)
  const url = new URL(page.url())
  expect(url.pathname).toBe("/chat")
  expect(url.searchParams.get("prompt")).toBe(question)
  expect(url.searchParams.get("autorun")).toBe("1")
})

test("dashboard renders a DEMO banner when no account is connected", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page.getByTestId("dashboard-demo-banner")).toBeVisible()
})

test("screening page shows the example output card before any assessment is run", async ({ page }) => {
  await page.goto("/screening")
  await expect(page.getByTestId("screening-sample-output")).toBeVisible()
  await expect(page.getByTestId("screening-sample-output")).toContainText(/55-year-old man/i)
  await expect(page.getByTestId("screening-sample-output")).toContainText(/Due now/i)
})
