import { expect, test } from "@playwright/test"

// Guideline-backed screening answers must end in an action the patient can
// actually take: an in-app booking link that carries the plan into a visit
// request, rendered as a real link (same tab) rather than literal markdown.

test("screening answers end with a bookable next step", async ({ page }) => {
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill("What cancer screening does a 50-year-old woman need?")
  await page.getByTestId("chat-send-button").click()

  await expect(page.getByTestId("chat-section-answer")).toBeVisible({ timeout: 30_000 })

  const bookLink = page.getByRole("link", { name: "Book the next step" }).first()
  await expect(bookLink).toBeVisible()
  await expect(bookLink).toHaveAttribute("href", "/scheduling")
  // In-app navigation stays in the same tab; only external sources open new tabs.
  await expect(bookLink).not.toHaveAttribute("target", "_blank")
  // The markdown syntax itself must never leak into the transcript.
  await expect(page.getByText("[Book the next step]")).toHaveCount(0)
})
