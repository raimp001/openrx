import { expect, test } from "@playwright/test"

test("provider/caregiver application submit flow works", async ({ page }) => {
  await page.route(/\/api\/admin\/applications$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        application: { id: "app_test_001" },
      }),
    })
  })

  await page.goto("/join-network")

  await page.getByLabel("Full name").fill("Test Provider")
  await page.getByLabel("Email").fill("provider@example.com")
  await page.getByLabel("Phone").fill("5035551010")
  await page.getByLabel("NPI (optional)").fill("1234567890")
  await page.getByLabel("Specialty / Caregiver role").fill("Internal Medicine")
  await page.getByLabel("ZIP").fill("97123")
  await page.getByLabel("City").fill("Hillsboro")
  await page.getByLabel("State").fill("OR")
  await page
    .getByLabel("Services summary (natural language)")
    .fill("Adult preventive care, chronic disease management, and telehealth follow-ups.")

  await page.getByRole("button", { name: "Submit Application" }).click()

  await expect(page.getByText("Application submitted and delivered for email review.")).toBeVisible()
  await expect(page.getByText("app_test_001")).toBeVisible()
})
