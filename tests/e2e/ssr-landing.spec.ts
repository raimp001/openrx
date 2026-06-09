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

    // Headline and marketing copy
    expect(html).toContain("Ask a clinical question. Get an answer you can audit.")
    expect(html).toContain("How OpenRx works")
    expect(html).toContain("A deterministic engine answers")

    // Decision-support disclaimer
    expect(html).toContain("not a substitute for clinician judgment")

    // Working demo entry point and chat entry
    expect(html).toMatch(/href="\/demo"/)
    expect(html).toMatch(/href="\/chat"/)

    // Version-stamped specimen is server-rendered
    expect(html).toMatch(/openrx-screening-engine-\d{4}-\d{2}-\d{2}/)
    expect(html).toContain("2021-05-18")

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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask a clinical question")
    await page.getByRole("link", { name: "See the denial-to-appeal demo" }).click()
    await expect(page).toHaveURL(/\/demo/, { timeout: 30_000 })
  })
})
