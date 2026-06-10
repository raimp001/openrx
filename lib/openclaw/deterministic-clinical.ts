import { getGuidelineSource } from "../screening/sources"

const RULE_VERSION = "openrx-hotfix-prevention-rules-2026-06-01"

function parseAge(message: string): number | undefined {
  const patterns = [
    // "52 year old" / "52-year-old" before "age N" so a relative's diagnosis
    // age ("mother at age 48") cannot hijack the patient age.
    /\b(\d{1,3})[-\s]*(?:yo|y\/o|years?[-\s]*old)\b/i,
    /(?<!\bat\s)\bage\s*(?:is|:)?\s*(\d{1,3})\b/i,
    /\bi\s*am\s*(\d{1,3})\b/i,
    /\b(\d{1,3})\s+(?:male|female|man|woman|m|f)\b/i,
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (!match) continue
    const age = Number.parseInt(match[1], 10)
    if (Number.isFinite(age) && age > 0 && age < 130) return age
  }
  return undefined
}

function parseSex(message: string): "female" | "male" | "unknown" {
  if (/\b(female|woman|girl|f)\b/i.test(message)) return "female"
  if (/\b(male|man|boy|m)\b/i.test(message)) return "male"
  return "unknown"
}

// Risk modifiers these simple age/sex rules do not encode. When present, the
// full screening engine (family history, hereditary risk, smoking pack-years,
// personal history, red flags) must produce the answer instead.
function hasRiskModifiers(lower: string): boolean {
  return /\b(family|mother|father|mom|dad|brother|sister|sibling|parent|uncle|aunt|grand\w*|cousin|hereditary|inherited|germline|mutation|brca\d?|palb2|chek2|lynch|mlh1|msh[26]|pms2|apc|mutyh|epcam|hoxb13|smok\w*|pack[-\s]?years?|survivor|history of|polyp|adenoma|colitis|crohn|symptom|bleeding|lump|mass|weight loss|hemoptysis|coughing blood)\b/.test(lower)
}

function shouldAnswerWithRules(message: string): boolean {
  const lower = message.toLowerCase().trim()
  if (!lower) return false
  if (hasRiskModifiers(lower)) return false
  const profileOnly = /^(?:i\s*am\s*)?(?:age\s*)?\d{1,3}\s*(?:yo|y\/o|years?\s*old|year[-\s]old)?\s*(?:male|female|man|woman|m|f)\.?$/.test(lower)
  const preventionIntent = /\b(screen|screening|preventive|prevention|risk|cancer|uspstf|checkup|due|genetic|colonoscopy|mammogram|pap|hpv)\b/.test(lower)
  const profileSignal = /\b(age|aged|\d{1,3}\s*(?:yo|y\/o|years?\s*old|year[-\s]old|male|female|man|woman|m|f)|brca1|brca2|lynch|pack[-\s]?years?)\b/.test(lower)
  return profileOnly || preventionIntent || profileSignal
}

interface RuleRecommendation {
  name: string
  detail: string
  grade: string
  ruleId: string
  sourceId: string
}

// Reference labels reuse the engine's guideline registry so every citation
// carries the organization, topic, and full version date.
function referenceLink(sourceId: string): string | null {
  const source = getGuidelineSource(sourceId)
  if (!source?.url) return null
  return `[${source.organization}: ${source.topic} (${source.versionOrDate})](${source.url})`
}

export function deterministicClinicalResponse(message: string): string | null {
  if (!shouldAnswerWithRules(message)) return null

  const age = parseAge(message)
  const sex = parseSex(message)

  if (typeof age !== "number" || sex === "unknown") {
    const missing: string[] = []
    if (typeof age !== "number") missing.push("age")
    if (sex === "unknown") missing.push("sex at birth")
    return `To build a guideline-backed prevention plan, please share: ${missing.slice(0, 3).join("; ")}.`
  }

  const recommendations: RuleRecommendation[] = []

  if (age >= 45 && age <= 49) {
    recommendations.push({
      name: "Colorectal cancer screening",
      detail: "Age 45 to 49: start screening; options include stool-based tests, colonoscopy, CT colonography, or flexible sigmoidoscopy.",
      grade: "B",
      ruleId: "uspstf-colorectal-45-49",
      sourceId: "uspstf-crc-2021",
    })
  } else if (age >= 50 && age <= 75) {
    recommendations.push({
      name: "Colorectal cancer screening",
      detail: "Age 50 to 75: continue routine colorectal cancer screening.",
      grade: "A",
      ruleId: "uspstf-colorectal-50-75",
      sourceId: "uspstf-crc-2021",
    })
  }

  if (sex === "female" && age >= 40 && age <= 74) {
    recommendations.push({
      name: "Breast cancer screening mammography",
      detail: "Age 40 to 74: every 2 years.",
      grade: "B",
      ruleId: "uspstf-breast-biennial-40-74",
      sourceId: "uspstf-breast-2024",
    })
  }

  if (sex === "female" && age >= 30 && age <= 65) {
    recommendations.push({
      name: "Cervical cancer screening",
      detail: "Age 30 to 65: cytology every 3 years, high-risk HPV testing every 5 years, or co-testing every 5 years.",
      grade: "A",
      ruleId: "uspstf-cervical-30-65",
      sourceId: "uspstf-cervical-2018",
    })
  }

  if (recommendations.length === 0) {
    return "OpenRx does not have a matching version-stamped screening rule for the details provided. Please talk with a clinician."
  }

  const references = Array.from(new Set(recommendations.map((rec) => rec.sourceId)))
    .map((sourceId) => referenceLink(sourceId))
    .filter((link): link is string => Boolean(link))
    .map((link, index) => `${index + 1}. ${link}`)

  // Format follows the chat renderer's section contract: an "Answer" heading,
  // exact "Due now" / "References" / "Safety note" heading lines, and "- "
  // bullets with markdown reference links. The patient's raw input is never
  // echoed back.
  return [
    "Answer",
    "These guideline-backed screenings apply to the profile provided.",
    "",
    "Due now",
    ...recommendations.map(
      (rec) => `- ${rec.name} (due): ${rec.detail} Grade ${rec.grade}. Rule: ${rec.ruleId} · ${RULE_VERSION}.`
    ),
    "",
    "What to do now",
    "- Send your ZIP code and I will list primary care or screening clinics near you, with phone numbers you can call.",
    "",
    "References",
    ...references,
    "",
    "Safety note",
    "Educational navigation only. Confirm every screening decision with a clinician.",
  ].join("\n")
}
