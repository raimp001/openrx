import { expect, test } from "@playwright/test"

test("onboarding accepts a PCP name selection and keeps the chosen contact details", async ({ page }) => {
  await page.route(/\/api\/providers\/search\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        matches: [
          {
            kind: "provider",
            name: "CHAD T. PFEFER, MD, PC",
            specialty: "Internal Medicine",
            fullAddress: "545 SE OAK ST STE A, HILLSBORO, OR 97123",
            phone: "503-640-1450",
            npi: "1952413395",
          },
          {
            kind: "provider",
            name: "CLINICOPS LLC",
            specialty: "Internal Medicine",
            fullAddress: "2459 SE TUALATIN VALLEY HWY STE 416, HILLSBORO, OR 97123",
            phone: "503-972-0235",
            npi: "1497251268",
          },
          {
            kind: "provider",
            name: "EDWARD CLARKE",
            specialty: "Internal Medicine",
            fullAddress: "324 SE NINTH, SUITE D, HILLSBORO, OR 97123",
            phone: "503-648-7128",
            npi: "1891801783",
          },
        ],
      }),
    })
  })

  await page.goto("/onboarding")

  await expect(page.getByRole("button", { name: "No, I need one" })).toBeVisible()
  await page.getByRole("button", { name: "No, I need one" }).click()

  const input = page.getByLabel("Onboarding chat input")
  await input.fill("97123")
  await page.getByRole("button", { name: "Send message" }).click()

  await expect(page.getByText("Found some options for you!").first()).toBeVisible()
  await expect(page.getByText("CHAD T. PFEFER, MD, PC").first()).toBeVisible()

  await input.fill("CHAD T. PFEFER, MD, PC")
  await page.getByRole("button", { name: "Send message" }).click()

  await expect(page.getByText("Locked in CHAD T. PFEFER, MD, PC as your PCP.")).toBeVisible()
  await expect(page.getByText("Phone: 503-640-1450").last()).toBeVisible()
  await expect(page.getByText("545 SE OAK ST STE A, HILLSBORO, OR 97123").last()).toBeVisible()
  await expect(page.getByText("Do you have a dentist?")).toBeVisible()
  await expect(page.getByText("Let me search again. Give me a name, city, or ZIP code:")).toHaveCount(0)
})
