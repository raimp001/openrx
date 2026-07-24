import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"
import { openRxDesignTokens } from "@/lib/design-tokens"

const ROOT = path.resolve(__dirname, "../..")
const globals = readFileSync(path.join(ROOT, "app/globals.css"), "utf8")
const tailwindConfig = readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf8")

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const normalize = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * normalize(red) + 0.7152 * normalize(green) + 0.0722 * normalize(blue)
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

function hexToRgb(value: string): [number, number, number] {
  const hex = value.replace("#", "")
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function cssRgbVariable(name: string): [number, number, number] {
  const match = globals.match(new RegExp(`${name}:\\s*([0-9]+)\\s+([0-9]+)\\s+([0-9]+);`))
  if (!match) throw new Error(`Missing ${name}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function tailwindHexToken(name: string) {
  const match = tailwindConfig.match(new RegExp(`${name}:\\s+"(#[0-9A-Fa-f]{6})"`))
  if (!match) throw new Error(`Missing ${name}`)
  return match[1]
}

test("light app text tokens meet WCAG AA contrast for small clinical UI text", () => {
  const surface = [255, 255, 255] as [number, number, number]

  expect(contrastRatio(cssRgbVariable("--color-muted-rgb"), surface)).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(cssRgbVariable("--color-subtle-rgb"), surface)).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(cssRgbVariable("--color-secondary-rgb"), surface)).toBeGreaterThanOrEqual(4.5)
})

test("interactive accent tokens stay readable on their actual light backgrounds", () => {
  expect(contrastRatio([255, 255, 255], hexToRgb(tailwindHexToken("midnight")))).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(hexToRgb(tailwindHexToken('"soft-blue"')), hexToRgb("#FFFFFF"))).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(cssRgbVariable("--color-accent-rgb"), [255, 255, 255])).toBeGreaterThanOrEqual(4.5)
})

test("exported design tokens keep muted copy readable in light and dark themes", () => {
  const patient = openRxDesignTokens.color.semantic.patientLight
  const developer = openRxDesignTokens.color.semantic.developerDark

  expect(contrastRatio(hexToRgb(patient.textMuted), hexToRgb(patient.background))).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(hexToRgb(developer.textMuted), hexToRgb(developer.background))).toBeGreaterThanOrEqual(4.5)
})
