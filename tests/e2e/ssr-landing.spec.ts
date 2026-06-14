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
    expect(html).toContain("Prior-auth infrastructure and cancer screening navigation in one auditable care layer.")
    expect(html).toContain("Screening plans are deterministic")

    // Decision-support disclaimer
    expect(html).toContain("It does not diagnose or place orders.")

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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("OpenRx")
    await expect(page.getByText("Prior-auth infrastructure and cancer screening navigation")).toBeVisible()
    await page.getByRole("link", { name: "View API/docs" }).click()
    await expect(page).toHaveURL(/\/demo/, { timeout: 30_000 })
  })
})
