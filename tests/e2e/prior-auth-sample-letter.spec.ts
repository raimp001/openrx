import { expect, test } from "@playwright/test"

// The /prior-auth board shows a public specimen of a drafted appeal letter so
// visitors can see the deliverable — version-stamped citations and
// clinician-review framing — before connecting any data.

test.describe("prior-auth sample appeal letter", () => {
  test("renders the synthetic appeal draft with citations and review boundary", async ({ page }) => {
    await page.goto("/prior-auth")

    await expect(page.getByRole("heading", { name: "Sample appeal letter" })).toBeVisible()
    await expect(page.getByText("Synthetic case · draft only")).toBeVisible()

    // Letter content mirrors the sandbox scenario data, not hand-written copy
    await expect(
      page.getByText("Appeal request: Tecvayli (teclistamab-cqyv) for relapsed or refractory multiple myeloma")
    ).toBeVisible()
    await expect(page.getByText("FDA: Tecvayli indication and REMS")).toBeVisible()
    await expect(page.getByText("NCCN: Multiple Myeloma pathway")).toBeVisible()
    await expect(page.getByText("Version verification required")).toBeVisible()
    await expect(page.getByText("Treatment-line chronology")).toBeVisible()

    // Clinician-review boundary is explicit
    await expect(page.getByText(/an authorized clinician must review medical necessity/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /Generate this draft live in the sandbox/i })).toHaveAttribute(
      "href",
      "/demo"
    )
  })
})
