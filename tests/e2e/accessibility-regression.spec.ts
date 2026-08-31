import { expect, test, type Page } from "@playwright/test"

// A site-wide audit found 51 real defects: 44 WCAG AA contrast failures, a
// mobile page that swiped sideways into empty space, an unlabeled search
// input, and a page with no h1. Nothing in CI would have caught any of them.
//
// This covers every statically-routable page, not a sample, so a regression on
// a rarely-visited clinical page fails the same way a landing-page one does.
// Each route is visited once and checked at both viewports, which keeps the
// whole suite cheap enough to run on every push.
const ROUTES = [
  "/",
  "/admin-review",
  "/admin-review/commitments",
  "/admin-review/treasury",
  "/benchmark",
  "/billing",
  "/chat",
  "/clinical-trials",
  "/commitments",
  "/commitments/provider",
  "/compliance-ledger",
  "/dashboard",
  "/dashboard/care-team",
  "/demo",
  "/drug-prices",
  "/emergency-card",
  "/join-network",
  "/lab-results",
  "/login",
  "/messages",
  "/onboarding",
  "/outreach",
  "/pharmacy",
  "/prescriptions",
  "/prior-auth",
  "/prior-auth/audit",
  "/privacy-explained",
  "/profile",
  "/providers",
  "/referrals",
  "/scheduling",
  "/screening",
  "/second-opinion",
  "/signup",
  "/timeline",
  "/trust",
  "/vaccinations",
  "/vitals",
  "/wallet",
]

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 950 }

type PageAudit = {
  contrast: string[]
  h1Count: number
  unlabeled: string[]
  unnamed: string[]
  imagesWithoutAlt: string[]
  duplicateIds: string[]
  internalLinks: string[]
}

/**
 * Runs in the browser. Measures contrast against the background actually
 * painted behind each run of text — walking ancestors for the first opaque
 * backdrop and flattening the text's own alpha over it. That is what a
 * token-level unit test cannot see: tokens can clear AA on white while failing
 * on the paper background pages actually render on.
 */
function auditPage(): PageAudit {
  const parse = (value: string): [number, number, number, number] | null => {
    const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null
  }
  const luminance = (rgb: number[]) => {
    const channel = (v: number) => {
      const n = v / 255
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
  }
  const opaqueBackdrop = (el: Element): [number, number, number, number] => {
    let node: Element | null = el
    while (node && node !== document.documentElement) {
      const parsed = parse(getComputedStyle(node).backgroundColor)
      if (parsed && parsed[3] > 0.85) return parsed
      node = node.parentElement
    }
    return [255, 255, 255, 1]
  }

  const contrast: string[] = []
  const seen = new Set<string>()
  const candidates = Array.from(
    document.querySelectorAll("p, span, a, li, button, h1, h2, h3, h4, label, td, th, div")
  ).slice(0, 800)

  for (const el of candidates) {
    const ownsText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent || "").trim()
    )
    if (!ownsText) continue
    const text = (el as HTMLElement).innerText?.trim() || ""
    if (text.length < 2) continue

    const style = getComputedStyle(el)
    if (style.visibility === "hidden" || style.display === "none") continue
    if (Number(style.opacity) < 0.35) continue
    const box = el.getBoundingClientRect()
    if (box.width < 4 || box.height < 4) continue

    const fg = parse(style.color)
    if (!fg) continue
    const bg = opaqueBackdrop(el)
    const alpha = fg[3]
    const flattened = [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha))
    const ratio =
      (Math.max(luminance(flattened), luminance(bg)) + 0.05) /
      (Math.min(luminance(flattened), luminance(bg)) + 0.05)

    const fontSize = parseFloat(style.fontSize)
    const bold = (parseInt(style.fontWeight, 10) || 400) >= 700
    const required = fontSize >= 24 || (fontSize >= 18.66 && bold) ? 3 : 4.5

    if (ratio < required - 0.005) {
      const key = `${style.color}|${fontSize}|${text.slice(0, 20)}`
      if (seen.has(key)) continue
      seen.add(key)
      contrast.push(
        `${ratio.toFixed(2)}:1 (needs ${required}) ${fontSize}px ${style.color} "${text.slice(0, 45).replace(/\s+/g, " ")}"`
      )
    }
  }

  const unlabeled: string[] = []
  document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach((el) => {
    const id = el.getAttribute("id")
    const labelFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (!labelFor && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.closest("label")) {
      unlabeled.push(`${el.tagName.toLowerCase()}[name=${el.getAttribute("name") || "?"}] placeholder="${el.getAttribute("placeholder") || ""}"`)
    }
  })

  // textContent, not innerText: content inside a collapsed <details> is hidden
  // from layout but is still a perfectly good accessible name.
  const unnamed: string[] = []
  document.querySelectorAll("button, a").forEach((el) => {
    const text = (el.textContent || "").trim()
    const aria = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("aria-labelledby")
    const imgAlt = Array.from(el.querySelectorAll("img")).some((i) => (i.getAttribute("alt") || "").trim())
    if (!text && !aria && !imgAlt && !el.querySelector(".sr-only")) {
      unnamed.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 45)}`)
    }
  })

  const imagesWithoutAlt: string[] = []
  document.querySelectorAll("img").forEach((img) => {
    if (!img.hasAttribute("alt")) imagesWithoutAlt.push(img.getAttribute("src") || "(no src)")
  })

  const idCounts: Record<string, number> = {}
  document.querySelectorAll("[id]").forEach((el) => {
    idCounts[el.id] = (idCounts[el.id] || 0) + 1
  })
  const duplicateIds = Object.entries(idCounts)
    .filter(([, n]) => n > 1)
    .map(([id, n]) => `#${id} x${n}`)

  const internalLinks = [
    ...new Set(
      Array.from(document.querySelectorAll('a[href^="/"]'))
        .map((a) => a.getAttribute("href") || "")
        .filter((href) => href && !href.startsWith("//"))
    ),
  ]

  return { contrast, h1Count: document.querySelectorAll("h1").length, unlabeled, unnamed, imagesWithoutAlt, duplicateIds, internalLinks }
}

/** Overflow that actually makes the page swipe sideways — an element inside a
 *  scroll container is scrollable by design, not a layout bug. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const culprits = Array.from(document.querySelectorAll("body *"))
      .filter((node) => {
        const rect = node.getBoundingClientRect()
        if (rect.right <= root.clientWidth + 1 || rect.width < 8) return false
        let ancestor = node.parentElement
        while (ancestor && ancestor !== root) {
          const overflowX = getComputedStyle(ancestor).overflowX
          if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) return false
          ancestor = ancestor.parentElement
        }
        return true
      })
      .slice(0, 3)
      .map((n) => `${n.tagName.toLowerCase()}.${(n.className || "").toString().slice(0, 50)}`)
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, culprits }
  })
}

const discoveredLinks = new Set<string>()

test.describe("every page stays accessible and self-consistent", () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" })
      expect(response?.status(), `${route} should serve 200`).toBe(200)
      await page.waitForLoadState("networkidle").catch(() => {})

      const audit = await page.evaluate(auditPage)
      audit.internalLinks.forEach((href) => discoveredLinks.add(href))

      expect(audit.contrast, `${route} contrast failures:\n  ${audit.contrast.join("\n  ")}`).toEqual([])
      expect(audit.h1Count, `${route} should expose exactly one h1`).toBe(1)
      expect(audit.unlabeled, `${route} unlabeled controls: ${audit.unlabeled.join(", ")}`).toEqual([])
      expect(audit.unnamed, `${route} controls with no accessible name: ${audit.unnamed.join(", ")}`).toEqual([])
      expect(audit.imagesWithoutAlt, `${route} images missing alt: ${audit.imagesWithoutAlt.join(", ")}`).toEqual([])
      expect(audit.duplicateIds, `${route} duplicate ids: ${audit.duplicateIds.join(", ")}`).toEqual([])

      const desktop = await horizontalOverflow(page)
      expect(
        desktop.scrollWidth,
        `${route} scrolls horizontally at ${DESKTOP.width}px. Unclipped: ${desktop.culprits.join(", ") || "none"}`
      ).toBeLessThanOrEqual(desktop.clientWidth + 1)

      await page.setViewportSize(MOBILE)
      await page.waitForTimeout(400)
      const mobile = await horizontalOverflow(page)
      expect(
        mobile.scrollWidth,
        `${route} scrolls horizontally at ${MOBILE.width}px (${mobile.scrollWidth}px wide). Unclipped: ${mobile.culprits.join(", ") || "none"}`
      ).toBeLessThanOrEqual(mobile.clientWidth + 1)
    })
  }

  // Runs last: every in-app link surfaced while auditing the pages above must
  // resolve. Catches a renamed or deleted route that still has inbound links.
  test("every internal link found while crawling resolves", async ({ request }) => {
    const broken: string[] = []
    for (const href of [...discoveredLinks].sort()) {
      const response = await request.get(href, { failOnStatusCode: false })
      if (response.status() >= 400) broken.push(`${response.status()} ${href}`)
    }
    expect(broken, `Broken internal links:\n  ${broken.join("\n  ")}`).toEqual([])
  })
})
