import { parseScreeningIntakeNarrative } from "@/lib/screening-intake"
import { getGuidelineSource } from "@/lib/screening/sources"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import type { ScreeningRecommendation } from "@/lib/screening/types"

function shouldAnswerWithRules(message: string): boolean {
  const lower = message.toLowerCase().trim()
  if (!lower) return false
  const profileOnly = /^(?:i\s*am\s*)?(?:age\s*)?\d{1,3}\s*(?:yo|y\/o|years?\s*old|year[-\s]old)?\s*(?:male|female|man|woman|m|f)\.?$/.test(lower)
  const preventionIntent = /\b(screen|screening|preventive|prevention|risk|cancer|uspstf|checkup|due|genetic|colonoscopy|mammogram|pap|hpv)\b/.test(lower)
  const profileSignal = /\b(age|aged|\d{1,3}\s*(?:yo|y\/o|years?\s*old|year[-\s]old|male|female|man|woman|m|f)|brca1|brca2|lynch|pack[-\s]?years?)\b/.test(lower)
  return profileOnly || preventionIntent || profileSignal
}

function sourceDisplayName(rec: ScreeningRecommendation): string {
  const source = getGuidelineSource(rec.sourceId)
  const organization = source?.organization || rec.sourceSystem
  const version = source?.versionOrDate || rec.sourceVersion || ""
  const year = version.match(/\b(19|20)\d{2}\b/)?.[0]
  const topic = source?.topic || rec.screeningName
  const compactTopic =
    topic.toLowerCase().includes("colorectal") ? "Colorectal Cancer Screening" :
    topic.toLowerCase().includes("breast") ? "Breast Cancer Screening" :
    topic.toLowerCase().includes("cervical") ? "Cervical Cancer Screening" :
    topic.toLowerCase().includes("lung") ? "Lung Cancer Screening" :
    topic.toLowerCase().includes("prostate") ? "Prostate Cancer Screening" :
    topic.toLowerCase().includes("brca") ? "BRCA-Related Cancer Risk Assessment" :
    topic
  return [organization, compactTopic, year].filter(Boolean).join(" ")
}

function formatRecommendation(rec: ScreeningRecommendation): string {
  const grade = rec.evidenceGrade ? `Grade ${rec.evidenceGrade}` : "Grade not assigned"
  const sourceUrl = rec.sourceUrl || getGuidelineSource(rec.sourceId)?.url || ""
  const sourceVersion = rec.sourceVersion || getGuidelineSource(rec.sourceId)?.versionOrDate || "version pending"
  return [
    `- ${rec.screeningName} (${rec.status.replace(/_/g, " ")}): ${rec.patientFriendlyExplanation}`,
    `  Source: ${sourceDisplayName(rec)} · ${grade} · ${sourceUrl}`,
    `  Rule: ${rec.id} · ${rec.sourceId || rec.sourceSystem} · source version ${sourceVersion}`,
  ].join("\n")
}

export function deterministicClinicalResponse(message: string): string | null {
  if (!shouldAnswerWithRules(message)) return null

  const parsed = parseScreeningIntakeNarrative(message)
  if (!parsed.ready) {
    return [
      "To build a guideline-backed prevention plan, please share:",
      parsed.clarificationQuestion || "Age; sex used for screening intervals; and any symptoms, family history, known inherited mutations, smoking history, or prior screening dates.",
    ].join("\n")
  }

  const engineResult = recommendScreenings(screeningIntakeFromLegacy({
    age: parsed.extracted.age,
    gender: parsed.extracted.gender,
    smoker: parsed.extracted.smoker,
    familyHistory: parsed.extracted.familyHistory,
    symptoms: parsed.extracted.symptoms,
    conditions: parsed.extracted.conditions,
  }))

  const sourceBackedRecommendations = engineResult.recommendations.filter((rec) =>
    Boolean(rec.sourceUrl || getGuidelineSource(rec.sourceId)?.url)
  )

  if (sourceBackedRecommendations.length === 0) {
    return [
      "OpenRx does not have a matching source-linked, version-stamped screening rule for the details provided.",
      "Please talk with a clinician or high-risk screening clinic instead of relying on a guessed recommendation.",
    ].join("\n")
  }

  return [
    "Your guideline-backed prevention plan:",
    sourceBackedRecommendations.map(formatRecommendation).join("\n"),
    "",
    "Educational navigation only. Confirm every screening decision with a clinician.",
  ].join("\n")
}
