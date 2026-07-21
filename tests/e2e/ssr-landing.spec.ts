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
    expect(html).toContain("Health answers,")
    expect(html).toContain("verification")
    expect(html).toContain("the next care step")

    // Decision-support disclaimer
    expect(html).toContain("Educational, not medical advice or a diagnosis.")
    expect(html).toContain("does not claim HIPAA compliance or SOC 2 certification")

    // Working developer and patient entry points
    expect(html).toMatch(/href="\/demo"/)
    expect(html).toMatch(/href="\/chat/)
    expect(html).toMatch(/href="\/screening"/)
    expect(html).toMatch(/href="\/benchmark"/)

    // Engine-backed demo panel is server-rendered
    expect(html).toContain("Deterministic response")
    expect(html).toContain("Colorectal cancer screening")
    expect(html).toContain("uspstf-average-risk-colorectal")
    expect(html).toContain("https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening")

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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Health answers")
    await expect(page.getByText("Deterministic response")).toBeVisible()
    await expect(page.getByText("Colorectal cancer screening", { exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: /uspstf-average-risk-colorectal/ })).toBeVisible()
    await expect(page.getByRole("link", { name: "Check my screening — free" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Try OpenRx" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Trust" })).toBeVisible()
    await page.getByRole("link", { name: "For clinicians" }).click()
    await expect(page).toHaveURL(/\/demo/, { timeout: 30_000 })
  })

  test("mobile landing keeps the primary path visible without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: "Check my screening — free" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Try OpenRx" })).toBeVisible()
    await expect(page.getByText("Deterministic response")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden()

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(widths.content).toBeLessThanOrEqual(widths.viewport)
  })

  test("landing primary CTAs route to chat and screening", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("link", { name: "Try OpenRx" }).click()
    await expect(page).toHaveURL(/\/chat/, { timeout: 30_000 })

    await page.goto("/")
    await page.getByRole("link", { name: "Check my screening — free" }).click()
    await expect(page).toHaveURL(/\/screening/, { timeout: 30_000 })
  })
})
