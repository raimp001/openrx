import { expect, test } from "@playwright/test"
import benchmark from "../../lib/benchmark/published.json"

// The published accuracy benchmark is a public trust surface: the page must
// render the checked-in run server-side, agree with the published JSON, and be
// reachable from the landing page and the trust page.

test.describe("published accuracy benchmark", () => {
  test("/benchmark renders the checked-in run with pass rate, engine version, and all scenarios", async ({ request }) => {
    const res = await request.get("/benchmark")
    expect(res.status()).toBe(200)
    const html = await res.text()

    expect(html).toContain("Accuracy you can audit, not just claim.")
    expect(html).toContain(`${Math.round(benchmark.passRate * 1000) / 10}%`)
    expect(html).toContain(benchmark.engineVersion)
    expect(html).toContain(`${benchmark.scenarioCount}-scenario`)

    // Every scenario row is server-rendered, including adversarial probes
    for (const result of benchmark.results) {
      expect(html).toContain(result.id)
    }

    // Honest-limits framing and reproducibility path must be present
    expect(html).toContain("Method and honest limits")
    expect(html).toContain("not clinician adjudication")
    expect(html).toContain("npm run test:clinical-regression")
    expect(html).toContain("tests/clinical-regression/scenarios.yaml")
  })

  test("landing and trust pages link to the benchmark", async ({ request }) => {
    const landing = await (await request.get("/")).text()
    expect(landing).toMatch(/href="\/benchmark"/)

    const trust = await (await request.get("/trust")).text()
    expect(trust).toMatch(/href="\/benchmark"/)
    expect(trust).toContain("Published benchmark")
  })

  test("benchmark is listed in the sitemap", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).toContain("https://openrx.health/benchmark")
  })
})
