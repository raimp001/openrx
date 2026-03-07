import { expect, test } from "@playwright/test"
test.setTimeout(420_000)

const ROUTES = [
  "/",
  "/dashboard",
  "/screening",
  "/providers",
  "/pharmacy",
  "/billing",
  "/prescriptions",
  "/prior-auth",
  "/scheduling",
  "/referrals",
  "/lab-results",
  "/vitals",
  "/vaccinations",
  "/drug-prices",
  "/second-opinion",
  "/clinical-trials",
  "/compliance-ledger",
  "/messages",
  "/chat",
  "/wallet",
  "/dashboard/care-team",
  "/emergency-card",
  "/join-network",
  "/onboarding",
  "/admin-review",
  "/projects/default/visualize",
]

test("core app pages load without runtime crash", async ({ page }) => {
  for (const path of ROUTES) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" })
    if (response) {
      expect(response.status(), `Route ${path} returned ${response.status()}`).toBeLessThan(500)
    }

    const main = page.locator("main").first()
    if (await main.count()) {
      await expect(main).toBeVisible({ timeout: 15000 })
    }
    const heading = page.getByRole("heading", { level: 1 }).first()
    await expect(heading, `Route ${path} is missing a visible main heading`).toBeVisible({ timeout: 20000 })
  }
})
