import { parseScreeningIntakeNarrative } from "@/lib/screening-intake"
import { detectRedFlagText } from "@/lib/red-flag"
import { getGuidelineSource } from "@/lib/screening/sources"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import type { ScreeningRecommendation } from "@/lib/screening/types"

const SCREENING_RULE_AGENTS = new Set(["screening", "wellness", "coordinator"])

function shouldAnswerWithRules(message: string): boolean {
  const lower = message.toLowerCase().trim()
  if (!lower) return false
  if (/\b(prior[- ]?auth(?:orization)?|denial|appeal|payer|coverage determination)\b/.test(lower)) {
    return false
  }
  const profileOnly = /^(?:i\s*am\s*)?(?:age\s*)?\d{1,3}\s*(?:yo|y\/o|years?\s*old|year[-\s]old)?\s*(?:male|female|man|woman|m|f)\.?$/.test(lower)
  const preventionIntent = /\b(screen|screening|preventive|prevention|risk|cancer|uspstf|checkup|due|genetic|colonoscopy|mammogram|pap|hpv)\b/.test(lower)
  const profileSignal = /\b(age|aged|\d{1,3}\s*(?:yo|y\/o|years?\s*old|year[-\s]old|male|female|man|woman|m|f)|brca1|brca2|lynch|pack[-\s]?years?)\b/.test(lower)
  return profileOnly || preventionIntent || profileSignal
}

function sourceDisplayName(rec: ScreeningRecommendation): string {
  const source = getGuidelineSource(rec.sourceId)
  if (source) {
    return `${source.organization}: ${source.topic} (${source.versionOrDate})`
  }

  return [rec.sourceSystem, rec.screeningName, rec.sourceVersion ? `(${rec.sourceVersion})` : ""].filter(Boolean).join(" ")
}

function groupTitle(rec: ScreeningRecommendation): "Due now" | "Needs clinician review" | "Upcoming or depends" | "Current / not indicated" {
  if (
    rec.requiresClinicianReview ||
    rec.status === "urgent_clinician_review" ||
    rec.status === "high_risk" ||
    rec.status === "needs_clinician_review" ||
    rec.status === "surveillance_or_follow_up"
  ) {
    return "Needs clinician review"
  }
  if (rec.status === "due") return "Due now"
  if (rec.status === "not_due") return "Current / not indicated"
  return "Upcoming or depends"
}

function formatRecommendation(rec: ScreeningRecommendation): string {
  const source = getGuidelineSource(rec.sourceId)
  const sourceUrl = rec.sourceUrl || source?.url
  const sourceVersion = rec.sourceVersion || source?.versionOrDate || "version pending"
  const grade = rec.evidenceGrade
    ? /^(?:grade|not graded|conditional|consensus|guideline|outside)/i.test(rec.evidenceGrade)
      ? rec.evidenceGrade
      : `Grade ${rec.evidenceGrade}`
    : "Not graded"
  const sourceText = sourceUrl
    ? `[${sourceDisplayName(rec)}](${sourceUrl})`
    : sourceDisplayName(rec)
  const review = rec.requiresClinicianReview ? " Review this with a clinician." : ""

  return [
    `- ${rec.screeningName} (${rec.status.replace(/_/g, " ")}): ${rec.patientFriendlyExplanation}${review}`,
    `  Source: ${sourceText} · ${grade} · Rule: ${rec.id} · source version ${sourceVersion}`,
  ].join("\n")
}

function formatGroups(recommendations: ScreeningRecommendation[]): string[] {
  const order: Array<ReturnType<typeof groupTitle>> = [
    "Due now",
    "Needs clinician review",
    "Upcoming or depends",
    "Current / not indicated",
  ]
  const grouped = new Map<ReturnType<typeof groupTitle>, ScreeningRecommendation[]>()
  recommendations.forEach((rec) => {
    const group = groupTitle(rec)
    grouped.set(group, [...(grouped.get(group) || []), rec])
  })

  return order.flatMap((group) => {
    const items = grouped.get(group) || []
    if (!items.length) return []
    return [group, ...items.map(formatRecommendation), ""]
  })
}

export function deterministicClinicalResponse(message: string, agentId?: string): string | null {
  if (agentId && !SCREENING_RULE_AGENTS.has(agentId)) return null
  if (!shouldAnswerWithRules(message)) return null
  if (detectRedFlagText(message)) return null

  const parsed = parseScreeningIntakeNarrative(message)
  if (parsed.extracted.redFlags.length > 0) return null
  if (!parsed.ready) {
    return [
      "Answer",
      "To build a guideline-backed prevention plan, please share the missing details below.",
      "",
      "Question to refine this",
      parsed.clarificationQuestion || "Share age, sex used for screening intervals, symptoms, family history, known inherited mutations, smoking history, and prior screening dates if known.",
      "",
      "References",
      "- [USPSTF: A and B preventive recommendations (accessed-2026-06-24)](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations)",
      "",
      "Safety note",
      "OpenRx is clinical decision support, not a diagnosis, medical order, or insurance approval.",
    ].join("\n")
  }

  const engineResult = recommendScreenings(screeningIntakeFromLegacy({
    age: parsed.extracted.age,
    gender: parsed.extracted.gender,
    smoker: parsed.extracted.smoker,
    familyHistory: parsed.extracted.familyHistory,
    symptoms: parsed.extracted.symptoms,
    conditions: parsed.extracted.conditions,
    reportedHistory: parsed.extracted.reportedHistory,
  }))

  const sourceBackedRecommendations = engineResult.recommendations.filter((rec) =>
    Boolean(rec.sourceUrl || getGuidelineSource(rec.sourceId)?.url)
  )

  if (sourceBackedRecommendations.length === 0) {
    return [
      "Answer",
      "OpenRx does not have a matching source-linked, version-stamped screening rule for the details provided.",
      "",
      "What to do now",
      "- Talk with a clinician or high-risk screening clinic instead of relying on a guessed recommendation.",
      "- [Book that review](/scheduling) — request an appointment so a clinician can go through this with you.",
      "",
      "References",
      "- [USPSTF: A and B preventive recommendations (accessed-2026-06-24)](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations)",
      "- [NCI: Cancer screening overview (accessed-2026-06-24)](https://www.cancer.gov/about-cancer/screening)",
      "",
      "Safety note",
      "OpenRx should route unclear or unencoded guideline paths to clinician review.",
    ].join("\n")
  }

  return [
    "Answer",
    "These guideline-backed screenings apply to the profile provided.",
    "",
    ...formatGroups(sourceBackedRecommendations),
    ...(engineResult.clarificationQuestions.length > 0
      ? [
          "Questions that could change this plan",
          ...engineResult.clarificationQuestions.flatMap((item, index) => [
            `${index + 1}. ${item.question}`,
            `Why this matters: ${item.whyItMatters}`,
          ]),
          "",
        ]
      : []),
    "What to do now",
    "- [Book the next step](/scheduling) — request an appointment and OpenRx carries this plan into the visit request for your care team to confirm.",
    "- Or send your ZIP code and I will list primary care or screening clinics near you, with phone numbers you can call.",
    "",
    "Safety note",
    "Educational navigation only. Confirm every screening decision with a clinician.",
  ].join("\n")
}
