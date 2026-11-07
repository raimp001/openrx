import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"

const ROOT = path.resolve(__dirname, "../..")

// Ember is the brand's single voice of action. It is defined once, as the
// `ember` ramp in tailwind.config.ts, and reached through tokens
// (--color-accent-rgb) or the remapped `teal-*`/`cyan-*` scales.
//
// Nothing stopped a literal from drifting off that ramp, though, and several
// did: the logo mark kept `#C2451E` after the AA darkening to `#BA421C`, so
// the header mark and the CTA beside it were two different embers; the global
// focus ring and six borders/rings carried the same stale value written as
// `rgb(194 69 30)`, which no hex search finds; a hover fill sat on `#A62A09`,
// a step that is not on the ramp at all; and a shadow still tinted with
// `#C53710` from the retired near-miss palette.
//
// The existing guards could not see any of it. contrast-tokens.test.ts reads
// CSS variables, and the accessibility suite reads computed *text* colour — an
// SVG stroke, a border, a focus ring and a box-shadow are none of those. So
// this test reads the literals themselves.

const SOURCE_DIRS = ["app", "components", "lib"]
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".svg"])

// Ember's hue band. Measured against the palette actually in the tree, this
// isolates ember (12.6°-16.7°) from the warning/amber family (22.7° and up)
// and the danger reds (3.5°-4.2°), so sibling semantic colours are not swept
// in. Low-saturation greys and browns are excluded by the chroma floor.
const EMBER_HUE_MIN = 8
const EMBER_HUE_MAX = 21
const MIN_CHROMA = 30

// Sanctioned off-ramp embers. Each needs a reason to be here.
const ALLOWED_EXTRAS = new Map([
  // Ember lifted for legibility on ink: the dark-tone logo mark, the favicon,
  // the OG image, and accent runs on the landing page's dark sections.
  ["#E0704A", "on-ink accent (dark-tone mark, favicon, og-image, dark sections)"],
])

function emberRamp(): Map<string, string> {
  const config = readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf8")
  const block = config.match(/const ember = \{([^}]*)\}/)
  if (!block) throw new Error("Could not find the `ember` ramp in tailwind.config.ts")
  const ramp = new Map<string, string>()
  for (const [, step, hex] of block[1].matchAll(/(\d+):\s*"(#[0-9A-Fa-f]{6})"/g)) {
    ramp.set(hex.toUpperCase(), `ember-${step}`)
  }
  if (ramp.size === 0) throw new Error("Parsed the `ember` ramp but found no steps")
  return ramp
}

function hueAndChroma([r, g, b]: [number, number, number]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  if (chroma === 0) return { hue: 0, chroma }
  let hue: number
  if (max === r) hue = ((g - b) / chroma) % 6
  else if (max === g) hue = (b - r) / chroma + 2
  else hue = (r - g) / chroma + 4
  return { hue: (hue * 60 + 360) % 360, chroma }
}

function isEmberHue(rgb: [number, number, number]) {
  const { hue, chroma } = hueAndChroma(rgb)
  return chroma >= MIN_CHROMA && hue >= EMBER_HUE_MIN && hue <= EMBER_HUE_MAX
}

function sourceFiles(dir: string): string[] {
  const absolute = path.join(ROOT, dir)
  const out: string[] = []
  for (const entry of readdirSync(absolute)) {
    if (entry === "node_modules" || entry === ".next") continue
    const full = path.join(absolute, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(path.join(dir, entry)))
    else if (SOURCE_EXT.has(path.extname(entry))) out.push(path.join(dir, entry))
  }
  return out
}

type Finding = { file: string; line: number; literal: string; hex: string }

// Both spellings. The drift that reached production was written in decimal,
// precisely the form a hex search misses.
function emberLiterals(file: string): Finding[] {
  const found: Finding[] = []
  const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n")

  lines.forEach((text, index) => {
    for (const [literal, hex] of text.matchAll(/#([0-9A-Fa-f]{6})\b/g)) {
      const rgb = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
      if (isEmberHue(rgb)) {
        found.push({ file, line: index + 1, literal, hex: `#${hex.toUpperCase()}` })
      }
    }

    for (const [literal, channels] of text.matchAll(/rgba?\(\s*(\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3})/g)) {
      const rgb = channels.split(/[\s,]+/).map(Number) as [number, number, number]
      if (rgb.some((channel) => channel > 255)) continue
      if (isEmberHue(rgb)) {
        const hex = `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`
        found.push({ file, line: index + 1, literal, hex })
      }
    }
  })

  return found
}

test("every ember literal in the tree sits on the ramp defined in tailwind.config.ts", () => {
  const ramp = emberRamp()
  const files = [...SOURCE_DIRS.flatMap(sourceFiles), ...sourceFiles("public").filter((f) => f.endsWith(".svg"))]

  const drift = files
    .flatMap(emberLiterals)
    .filter(({ hex }) => !ramp.has(hex) && !ALLOWED_EXTRAS.has(hex))

  const report = drift.map((d) => `${d.file}:${d.line} uses ${d.literal} (${d.hex})`).join("\n")
  expect(
    drift,
    `Ember literals must be a step on the ember ramp, a token, or a documented\n` +
      `exception in ALLOWED_EXTRAS. Off-ramp values found:\n${report}\n\n` +
      `Ramp: ${[...ramp].map(([hex, name]) => `${name} ${hex}`).join(", ")}`
  ).toEqual([])
})

test("the guard actually scans the files the drift hid in, in both spellings", () => {
  // A scan that silently matches nothing would pass the test above forever.
  const scanned = [...SOURCE_DIRS.flatMap(sourceFiles), ...sourceFiles("public").filter((f) => f.endsWith(".svg"))]
  expect(scanned).toContain("app/globals.css")
  expect(scanned).toContain("components/brand-logo.tsx")
  expect(scanned).toContain("public/openrx-logo-light.svg")

  // The accent is present and recognised in both forms the codebase uses.
  expect(emberLiterals("components/brand-logo.tsx").map((f) => f.hex)).toContain("#BA421C")
  const globals = emberLiterals("app/globals.css").map((f) => f.hex)
  expect(globals).toContain("#BA421C")

  // Hue banding keeps the neighbouring semantic families out of scope.
  expect(isEmberHue([194, 69, 30])).toBe(true) // the stale ember that shipped
  expect(isEmberHue([186, 66, 28])).toBe(true) // the current accent
  expect(isEmberHue([146, 64, 14])).toBe(false) // warning / amber
  expect(isEmberHue([217, 45, 32])).toBe(false) // danger / red
  expect(isEmberHue([115, 105, 92])).toBe(false) // warm neutral, below chroma floor
})

// The brand faces are loaded once, at the root, as Archivo and IBM Plex Mono.
// Geist was the previous sans and is no longer loaded anywhere, but static
// assets kept asking for it by name — the OG share card, which is what every
// link preview of the site renders, still specified `font-family="Geist, ..."`
// long after the app stopped shipping it. A font a page requests and never
// loads fails silently to a fallback, so nothing surfaces it at runtime.
const RETIRED_FONT_FAMILIES = ["Geist"]

test("no shipped asset asks for a font family the app no longer loads", () => {
  const files = [...SOURCE_DIRS.flatMap(sourceFiles), ...sourceFiles("public").filter((f) => f.endsWith(".svg"))]

  const stale = files.flatMap((file) => {
    const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n")
    return lines.flatMap((text, index) =>
      RETIRED_FONT_FAMILIES.filter((family) => new RegExp(`\\b${family}\\b`).test(text)).map(
        (family) => `${file}:${index + 1} requests the retired font "${family}"`
      )
    )
  })

  expect(stale, `Use the brand faces (--font-brand-sans / --font-brand-mono):\n${stale.join("\n")}`).toEqual([])
})
