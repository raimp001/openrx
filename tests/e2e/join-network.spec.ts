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
  await page.getByLabel("NPI", { exact: true }).fill("1234567890")
  await page.getByLabel("License number").fill("MD-12345")
  await page.getByLabel("Primary license state").fill("OR")
  await page.getByLabel("Other licensed states").fill("OR, WA")
  await page.getByLabel("Ordering / certifying status").selectOption("medicare-approved")
  await page.locator("#join-malpractice").fill("OpenRx Mutual policy active")
  await page.locator("#join-specialty").fill("Internal Medicine")
  await page.getByLabel("ZIP").fill("97123")
  await page.getByLabel("City").fill("Hillsboro")
  await page.locator("#join-state").fill("OR")
  await page.getByLabel("Services summary").fill("Adult preventive care, chronic disease management, and telehealth follow-ups.")
  await page.getByLabel(/I hold an active, unrestricted license/).check()
  await page.getByLabel(/I will only order labs/).check()
  await page.getByLabel(/no prescription, diagnostic order/).check()
  await page.getByLabel(/I maintain professional liability coverage/).check()

  await page.getByRole("button", { name: "Submit application" }).click()

  await expect(page.getByText("Application submitted for email review.")).toBeVisible()
  await expect(page.getByText("app_test_001", { exact: true })).toBeVisible()
})
