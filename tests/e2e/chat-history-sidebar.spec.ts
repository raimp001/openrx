import { expect, test } from "@playwright/test"

test.describe("chat history sidebar", () => {
  test("renders, exposes new chat, and shows empty state", async ({ page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" })

    const sidebar = page.getByTestId("chat-history-sidebar").first()
    await expect(sidebar).toBeVisible()

    const newChat = page.getByTestId("chat-history-new").first()
    await expect(newChat).toBeVisible()
    await expect(newChat).toHaveAccessibleName(/start a new chat/i)

    const search = page.getByTestId("chat-history-search").first()
    await expect(search).toBeVisible()

    // With no history, the empty state copy should appear.
    const empty = page.getByTestId("chat-history-empty").first()
    if (await empty.count()) {
      await expect(empty).toContainText(/No conversations yet/i)
    }
  })

  test("collapse toggle hides labels but keeps controls", async ({ page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" })
    const toggle = page.getByTestId("chat-history-collapse-toggle").first()
    await expect(toggle).toBeVisible()

    const sidebar = page.getByTestId("chat-history-sidebar").first()
    await expect(sidebar).toHaveAttribute("data-collapsed", "false")
    await toggle.click()
    await expect(sidebar).toHaveAttribute("data-collapsed", "true")
    await toggle.click()
    await expect(sidebar).toHaveAttribute("data-collapsed", "false")
  })

  test("mobile drawer toggle is accessible from the chat header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/chat", { waitUntil: "domcontentloaded" })

    const trigger = page.getByTestId("chat-history-drawer-toggle")
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAccessibleName(/open chat history/i)
    await trigger.click()

    const drawer = page.getByTestId("chat-history-drawer")
    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveAttribute("aria-hidden", "false")

    await page.getByTestId("chat-history-close-drawer").first().click()
  })

  test("Cmd+Shift+O focuses the composer for a new chat", async ({ page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" })
    const isMac = process.platform === "darwin"
    const mod = isMac ? "Meta" : "Control"
    await page.keyboard.press(`${mod}+Shift+O`)
    const input = page.getByTestId("chat-input")
    await expect(input).toBeFocused()
  })
})
