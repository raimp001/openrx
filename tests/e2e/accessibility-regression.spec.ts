import { expect, test, type Page } from "@playwright/test"

// A site-wide audit found 51 real defects: 44 WCAG AA contrast failures, a
// mobile page that swiped sideways into empty space, an unlabeled search
// input, and a page with no h1. These checks keep that class of regression
// out of the product instead of leaving it to be re-found by hand.
//
// Scoped to a representative route per surface (marketing, clinical shell,
// chat, data-heavy table) so the suite stays fast enough for every push.
const ROUTES = [
  "/",
  "/screening",
  "/benchmark",
  "/trust",
  "/privacy-explained",
  "/chat",
  "/dashboard",
  "/providers",
]

const MOBILE = { width: 390, height: 844 }

/** Relative luminance per WCAG 2.x. */
function luminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(fg: [number, number, number], bg: [number, number, number]) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

type TextSample = {
  ratio: number
  required: number
  text: string
  color: string
  fontSize: number
  selector: string
}

/**
 * Samples rendered text and reports any that misses its WCAG AA threshold
 * against the background actually painted behind it (walking ancestors until
 * an opaque one is found, and flattening the text's own alpha over it).
 */
async function findContrastFailures(page: Page): Promise<TextSample[]> {
  return page.evaluate(() => {
    const parse = (value: string): [number, number, number, number] | null => {
      const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
      return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null
    }
    const lum = ([r, g, b]: number[]) => {
      const c = (v: number) => {
        const n = v / 255
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
    }
    const opaqueBackgroundOf = (el: Element): [number, number, number, number] => {
      let node: Element | null = el
      while (node && node !== document.documentElement) {
        const parsed = parse(getComputedStyle(node).backgroundColor)
        if (parsed && parsed[3] > 0.85) return parsed
        node = node.parentElement
      }
      return [255, 255, 255, 1]
    }

    const failures: Array<Record<string, unknown>> = []
    const seen = new Set<string>()
    const candidates = Array.from(
      document.querySelectorAll("p, span, a, li, button, h1, h2, h3, h4, label, td, th, div")
    ).slice(0, 700)

    for (const el of candidates) {
      // Only elements that directly own visible text.
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
      const bg = opaqueBackgroundOf(el)
      const alpha = fg[3]
      const flattened = [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha))

      const l1 = lum(flattened)
      const l2 = lum([bg[0], bg[1], bg[2]])
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

      const fontSize = parseFloat(style.fontSize)
      const bold = (parseInt(style.fontWeight, 10) || 400) >= 700
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && bold)
      const required = isLarge ? 3 : 4.5

      if (ratio < required - 0.005) {
        const key = `${style.color}|${fontSize}|${text.slice(0, 25)}`
        if (seen.has(key)) continue
        seen.add(key)
        failures.push({
          ratio: Math.round(ratio * 100) / 100,
          required,
          text: text.slice(0, 60).replace(/\s+/g, " "),
          color: style.color,
          fontSize,
          selector: el.tagName.toLowerCase(),
        })
      }
    }
    return failures as unknown as TextSample[]
  })
}

test.describe("accessibility regressions", () => {
  for (const route of ROUTES) {
    test(`${route} keeps text above WCAG AA contrast`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => {})

      const failures = await findContrastFailures(page)
      const report = failures
        .map((f) => `  ${f.ratio}:1 (needs ${f.required}) ${f.fontSize}px ${f.color} "${f.text}"`)
        .join("\n")
      expect(failures, `Contrast failures on ${route}:\n${report}`).toEqual([])
    })
  }

  for (const route of ROUTES) {
    test(`${route} has no horizontal overflow on a 390px viewport`, async ({ page }) => {
      await page.setViewportSize(MOBILE)
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => {})

      const overflow = await page.evaluate(() => {
        const el = document.documentElement
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          // Elements that overflow without any ancestor clipping them are the
          // ones that actually make the page swipe sideways.
          culprits: Array.from(document.querySelectorAll("body *"))
            .filter((node) => {
              const rect = node.getBoundingClientRect()
              if (rect.right <= el.clientWidth + 1 || rect.width < 8) return false
              let ancestor = node.parentElement
              while (ancestor && ancestor !== el) {
                const overflowX = getComputedStyle(ancestor).overflowX
                if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden" || overflowX === "clip") {
                  return false
                }
                ancestor = ancestor.parentElement
              }
              return true
            })
            .slice(0, 3)
            .map((node) => `${node.tagName.toLowerCase()}.${(node.className || "").toString().slice(0, 60)}`),
        }
      })

      expect(
        overflow.scrollWidth,
        `${route} scrolls horizontally at 390px (${overflow.scrollWidth}px wide). Unclipped: ${overflow.culprits.join(", ") || "none found"}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  }

  for (const route of ROUTES) {
    test(`${route} exposes exactly one h1 and labels every input`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => {})

      const audit = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h1"))
        const unlabeled: string[] = []
        document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach((el) => {
          const id = el.getAttribute("id")
          const hasLabelFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`)
          const hasAria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")
          const wrapped = el.closest("label")
          if (!hasLabelFor && !hasAria && !wrapped) {
            unlabeled.push(
              `${el.tagName.toLowerCase()}[name=${el.getAttribute("name") || "?"}] placeholder="${el.getAttribute("placeholder") || ""}"`
            )
          }
        })
        return { h1Count: headings.length, h1Text: headings[0]?.innerText?.trim() || null, unlabeled }
      })

      expect(audit.h1Count, `${route} should have exactly one h1 (found ${audit.h1Count})`).toBe(1)
      expect(audit.unlabeled, `${route} has unlabeled form controls: ${audit.unlabeled.join(", ")}`).toEqual([])
    })
  }
})
