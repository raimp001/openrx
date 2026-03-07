import { expect, test } from "@playwright/test"

test.setTimeout(120_000)

test("pharmacy finder works with natural-language and ZIP-only inputs", async ({ page }) => {
  await page.route(/\/api\/pharmacy\/search\?/, async (route) => {
    const url = new URL(route.request().url())
    const query = (url.searchParams.get("q") || "").trim()
    const isZip = /\b\d{5}\b/.test(query)

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          query,
          normalizedQuery: query,
          city: isZip ? undefined : "Hillsboro",
          state: "OR",
          zip: isZip ? "97123" : undefined,
          ready: true,
        },
        count: 1,
        pharmacies: [
          {
            npi: "1902847561",
            name: `Hillsboro Pharmacy (${query})`,
            type: "Pharmacy",
            phone: "503-555-2200",
            fax: "",
            address: {
              line1: "100 Main St",
              line2: "",
              city: "Hillsboro",
              state: "OR",
              zip: "97123",
            },
            fullAddress: "100 Main St, Hillsboro, OR 97123",
            status: "Active",
            lastUpdated: "2026-02-26",
          },
        ],
        prompt: {
          id: "openrx.pharmacy-search.v1",
          image: "/prompts/pharmacy-search-prompt.svg",
        },
      }),
    })
  })

  await page.goto("/pharmacy")
  const input = page.getByPlaceholder("Example: Find CVS pharmacy near Seattle WA 98101")
  const searchButton = page.getByRole("button", { name: "Search", exact: true })

  await input.fill("Find pharmacy near Hillsboro OR")
  await searchButton.click({ force: true })
  await expect(page.getByText("Hillsboro Pharmacy (Find pharmacy near Hillsboro OR)")).toBeVisible()

  await input.fill("97123")
  await searchButton.click({ force: true })
  await expect(page.getByText("Hillsboro Pharmacy (97123)")).toBeVisible()
  await expect(page.getByText("Need one more detail before search")).toHaveCount(0)
})
