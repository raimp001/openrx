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
    expect(html).toContain('name="autorun"')
    expect(html).toContain('value="1"')

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

  test("landing question submits into chat autorun", async ({ page }) => {
    await page.route(/\/api\/openclaw\/status$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connected: true }),
      })
    })
    await page.route(/\/api\/openclaw\/chat\/stream$/, async (route) => {
      const text = "Answer\n\nColorectal cancer screening may be due.\n\nSafety note\n\nConfirm with a clinician."
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: delta\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: ${JSON.stringify({ finalText: text, agentId: "screening" })}\n\n`,
      })
    })
    await page.goto("/")

    await page.getByRole("textbox", { name: "Ask OpenRx" }).fill("age 45 male")
    await page.getByRole("button", { name: "Submit question" }).click()

    await expect(page).toHaveURL(/\/chat\?/, { timeout: 30_000 })
    const url = new URL(page.url())
    expect(url.searchParams.get("prompt")).toBe("age 45 male")
    expect(url.searchParams.get("topic")).toBe("screening")
    expect(url.searchParams.get("autorun")).toBe("1")
  })
})
