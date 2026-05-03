import { expect, test } from "@playwright/test"

test("supports provider lookup for specialty and city/ZIP-only variants", async ({ page }) => {
  const seenQueries: string[] = []

  await page.route(/\/api\/providers\/search\?/, async (route) => {
    const url = new URL(route.request().url())
    const query = (url.searchParams.get("q") || "").trim()
    const normalized = query.toLowerCase()
    seenQueries.push(normalized)

    const zip = normalized.includes("97123") ? "97123" : undefined
    const city = zip ? undefined : "hillsboro"

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          query,
          serviceTypes: ["provider"],
          specialty: normalized.includes("internal medicine") ? "Internal Medicine" : undefined,
          city,
          state: "OR",
          zip,
          normalizedQuery: query,
          ready: true,
          missingInfo: [],
        },
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: `Hillsboro Internal Medicine (${query})`,
            status: "Active",
            specialty: "Internal Medicine",
            taxonomyCode: "207R00000X",
            phone: "503-555-1000",
            fullAddress: "101 Main St, Hillsboro, OR 97123",
            confidence: "high",
          },
        ],
        prompt: {
          id: "openrx.npi-care-search.v1",
          image: "/prompts/npi-care-search-prompt.svg",
          text: "mock prompt",
        },
      }),
    })
  })

  await page.goto("/providers")

  const searchInput = page.getByLabel("Care need or location")
  const searchButton = page.getByRole("button", { name: "Search network", exact: true })

  const queries = [
    "hillsboro internal medicine provider",
    "hillsboro",
    "97123",
  ]

  for (const query of queries) {
    await searchInput.fill(query)
    await searchButton.click()

    await expect(page.locator("h3", { hasText: `${query})` }).first()).toBeVisible()
    await expect(page.locator("p", { hasText: "Internal Medicine" }).first()).toBeVisible()
    await expect(page.getByText(/care option[s]? ready/)).toBeVisible()
    await expect(page.getByText("Need one more detail before search")).toHaveCount(0)
  }

  expect(seenQueries).toEqual(expect.arrayContaining(queries))
})
