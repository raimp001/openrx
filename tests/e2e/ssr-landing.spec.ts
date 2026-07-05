import { expect, test } from "@playwright/test"

// The public landing surface must ship complete HTML to non-JS clients:
// crawlers, link previews, accessibility tools, and flaky connections all see
// the full copy. These tests fetch raw HTML (no JavaScript executed) — the
// automated equivalent of `curl https://openrx.health`.

test.describe("server-rendered landing page", () => {
  test("raw HTML contains the full landing copy, disclaimer, and demo link", async ({ request }) => {
    const res = await request.get("/")
    expect(res.status()).toBe(200)
    const html = await res.text()

    // Brand, value proposition, and clinical-safety copy
    expect(html).toContain("OpenRx")
    expect(html).toContain("OpenRx turns guidelines into care.")
    expect(html).toContain("Guideline-grounded cancer screening and prior-auth workflows")
    expect(html).toContain("Recommendations come from version-stamped rules, not model guesses.")

    // Decision-support disclaimer
    expect(html).toContain("The example is educational, not personal medical advice.")
    expect(html).toContain("does not claim HIPAA compliance or SOC 2 certification")

    // Working developer and patient entry points
    expect(html).toMatch(/href="\/demo"/)
    expect(html).toMatch(/href="\/screening"/)

    // Source-stamped specimen is server-rendered
    expect(html).toContain("USPSTF 2021, Grade B")
    expect(html).toContain("colorectal-cancer-screening")

    // noscript fallback so the page is never blank
    expect(html).toContain("<noscript>")
    expect(html).toContain("require JavaScript")
  })

  test("technical SEO: canonical, structured data, robots, sitemap", async ({ request }) => {
    const res = await request.get("/")
    const html = await res.text()

    expect(html).toMatch(/<link rel="canonical" href="https:\/\/openrx\.health\/?"\/?>/)
    expect(html).toContain('"@type":"Organization"')
    expect(html).toContain('"@type":"SoftwareApplication"')

    const robots = await request.get("/robots.txt")
    expect(robots.status()).toBe(200)
    expect(await robots.text()).toContain("Sitemap:")

    const sitemap = await request.get("/sitemap.xml")
    expect(sitemap.status()).toBe(200)
    expect(await sitemap.text()).toContain("https://openrx.health")
  })

  test("landing page renders and navigates to the demo in a browser", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("OpenRx turns guidelines into care.")
    await expect(page.getByText("Guideline-grounded cancer screening and prior-auth workflows")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Ask OpenRx" })).toBeVisible()
    const connectedCare = page.getByRole("navigation", { name: "Connected care actions" })
    await expect(connectedCare).toBeVisible()
    await expect(connectedCare.getByRole("link", { name: /Screening/ })).toBeVisible()
    await expect(connectedCare.getByRole("link", { name: /Find care/ })).toBeVisible()
    await expect(page.getByRole("link", { name: /Trust/ })).toBeVisible()
    await page.getByRole("link", { name: "API" }).click()
    await expect(page).toHaveURL(/\/demo/, { timeout: 30_000 })
  })

  test("mobile landing keeps the primary path visible without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Ask OpenRx" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Connected care actions" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden()

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(widths.content).toBeLessThanOrEqual(widths.viewport)
  })
})
