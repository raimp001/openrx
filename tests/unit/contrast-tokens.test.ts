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

// Text sits on three brand grounds, not just white: raised surfaces (#FFFFFF),
// the paper page background, and muted panels. Checking only white lets a token
// pass here while failing in the browser, which is how `subtle` and `warning`
// shipped at 4.24:1 and 3.83:1 on paper. Every text token is checked against
// all three.
const TEXT_GROUNDS: Array<[string, [number, number, number]]> = [
  ["white surface", [255, 255, 255]],
  ["paper background", [247, 244, 238]],
  ["muted panel", [242, 237, 227]],
]

function expectReadableOnEveryGround(variable: string) {
  for (const [name, ground] of TEXT_GROUNDS) {
    const ratio = contrastRatio(cssRgbVariable(variable), ground)
    expect(ratio, `${variable} on ${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  }
}

test("light app text tokens meet WCAG AA contrast on every brand ground", () => {
  expectReadableOnEveryGround("--color-muted-rgb")
  expectReadableOnEveryGround("--color-subtle-rgb")
  expectReadableOnEveryGround("--color-secondary-rgb")
  expectReadableOnEveryGround("--color-warning-rgb")
  expectReadableOnEveryGround("--color-danger-rgb")
  expectReadableOnEveryGround("--color-success-rgb")
})

test("interactive accent tokens stay readable on their actual light backgrounds", () => {
  expect(contrastRatio([255, 255, 255], hexToRgb(tailwindHexToken("midnight")))).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(hexToRgb(tailwindHexToken('"soft-blue"')), hexToRgb("#FFFFFF"))).toBeGreaterThanOrEqual(4.5)
  // Ember is used as link/label text on paper and muted panels, not just white.
  expectReadableOnEveryGround("--color-accent-rgb")
  // ...and as a button fill, where the white label on top must clear AA too.
  expect(contrastRatio([255, 255, 255], cssRgbVariable("--color-accent-rgb"))).toBeGreaterThanOrEqual(4.5)
})

test("exported design tokens keep muted copy readable in light and dark themes", () => {
  const patient = openRxDesignTokens.color.semantic.patientLight
  const developer = openRxDesignTokens.color.semantic.developerDark

  expect(contrastRatio(hexToRgb(patient.textMuted), hexToRgb(patient.background))).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(hexToRgb(developer.textMuted), hexToRgb(developer.background))).toBeGreaterThanOrEqual(4.5)
})
