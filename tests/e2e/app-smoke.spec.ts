import { expect, test } from "@playwright/test"
test.setTimeout(420_000)

const ROUTES = [
  "/",
  "/demo",
  "/trust",
  "/privacy-explained",
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
  "/outreach",
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

test("privacy page uses the dark OpenRx system", async ({ page }) => {
  await page.goto("/privacy-explained", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { level: 1, name: "Plain data boundaries before care navigation." })).toBeVisible()
  await expect(page.getByText("Short version")).toBeVisible()
  await expect(page.getByText("OpenRx should be understandable before it asks for trust.")).toBeVisible()

  const colors = await page.evaluate(() => {
    const body = getComputedStyle(document.body)
    const heading = document.querySelector("h1")
    const header = document.querySelector("header")
    return {
      bodyBackground: body.backgroundColor,
      headingColor: heading ? getComputedStyle(heading).color : "",
      headerBackground: header ? getComputedStyle(header).backgroundColor : "",
      overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - document.documentElement.clientWidth,
    }
  })

  expect(colors.bodyBackground).toBe("rgb(5, 5, 5)")
  expect(colors.headingColor).toBe("rgb(255, 255, 255)")
  expect(colors.headerBackground).toContain("5, 5, 5")
  expect(colors.overflow).toBeLessThanOrEqual(1)
})
