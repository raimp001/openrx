import type {
  ScreeningEngineResult,
  ScreeningClarification,
  ScreeningIntake,
  ScreeningNextStep,
  ScreeningRecommendation,
  ScreeningReportedHistory,
  ScreeningRelationship,
  ScreeningSourceSystem,
  ScreeningStatus,
  SexAtBirth,
} from "./types"
import { getGuidelineSource } from "./sources"
import { detectRedFlags } from "./red-flags"
import { getPathwaysForGenes, normalizeGene } from "./hereditary-risk"
import { SCREENING_ENGINE_VERSION } from "./version"

export type LegacyScreeningInput = {
  patientId?: string
  age?: number
  gender?: string
  smoker?: boolean
  familyHistory?: string[]
  symptoms?: string[]
  conditions?: string[]
  reportedHistory?: ScreeningReportedHistory
}

const FIRST_DEGREE_RELATIONSHIPS = new Set<ScreeningRelationship>(["mother", "father", "sibling", "child"])
const SAFE_LANGUAGE_BANNED = ["definitely", "guaranteed", "you have cancer", "replaces your doctor"]

function normalized(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term))
}

function clampAge(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  if (value < 0 || value > 120) return undefined
  return Math.floor(value)
}

function yearsSince(value?: string): number | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
}

function recommendation(input: Omit<ScreeningRecommendation, "sourceVersion" | "sourceSystem" | "engineVersion"> & { sourceSystem?: ScreeningSourceSystem }): ScreeningRecommendation {
  const source = input.sourceId ? getGuidelineSource(input.sourceId) : undefined
  const rec: ScreeningRecommendation = {
    ...input,
    sourceSystem: input.sourceSystem || source?.organization || "PENDING",
    sourceVersion: source?.versionOrDate,
    sourceUrl: source?.url,
    engineVersion: SCREENING_ENGINE_VERSION,
  }

  const language = `${rec.rationale} ${rec.recommendedNextStep} ${rec.patientFriendlyExplanation}`.toLowerCase()
  if (SAFE_LANGUAGE_BANNED.some((term) => language.includes(term))) {
    throw new Error(`Unsafe screening language in recommendation ${rec.id}.`)
  }
  return rec
}

function hasCancerHistory(intake: ScreeningIntake, cancerType: string): boolean {
  const target = cancerType.toLowerCase()
  return Boolean(intake.personalHistory.cancers?.some((entry) => normalized(entry.type).includes(target)))
}

function familyCancer(intake: ScreeningIntake, cancerTerms: string[]) {
  return intake.familyHistory.filter((entry) => includesAny(normalized(entry.cancerType), cancerTerms))
}

function hasFirstDegreeFamilyCancer(intake: ScreeningIntake, cancerTerms: string[]): boolean {
  return familyCancer(intake, cancerTerms).some((entry) => FIRST_DEGREE_RELATIONSHIPS.has(entry.relationship))
}

function hasEarlyFamilyCancer(intake: ScreeningIntake, cancerTerms: string[], age = 50): boolean {
  return familyCancer(intake, cancerTerms).some((entry) => typeof entry.diagnosisAge === "number" && entry.diagnosisAge < age)
}

function latestNormalScreeningYears(intake: ScreeningIntake, screeningTerms: string[]): number | undefined {
  const matches = intake.priorScreening
    .filter((item) => includesAny(normalized(item.screeningType), screeningTerms))
    .filter((item) => item.result === "normal")
    .map((item) => yearsSince(item.date))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b)
  return matches[0]
}

function addUnique(recommendations: ScreeningRecommendation[], rec: ScreeningRecommendation) {
  if (recommendations.some((item) => item.id === rec.id)) return
  recommendations.push(rec)
}

function parseRelationship(value: string): ScreeningRelationship {
  const text = normalized(value)
  if (text.includes("mother")) return "mother"
  if (text.includes("father")) return "father"
  if (text.includes("brother") || text.includes("sister") || text.includes("sibling")) return "sibling"
  if (text.includes("son") || text.includes("daughter") || text.includes("child")) return "child"
  if (text.includes("aunt") || text.includes("uncle") || text.includes("grand")) return "second_degree"
  return "other"
}

function parseDiagnosisAge(value: string): number | undefined {
  const match = value.match(/(?:age|at)\s*(\d{2})\b/i) || value.match(/\b(\d{2})\s*(?:years old|yo|y\/o)\b/i)
  if (!match) return undefined
  const age = Number.parseInt(match[1], 10)
  return Number.isFinite(age) ? age : undefined
}

function parseCancerType(value: string): string {
  const text = normalized(value)
  if (includesAny(text, ["colon", "colorectal", "rectal"])) return "colorectal cancer"
  if (text.includes("breast")) return "breast cancer"
  if (text.includes("ovarian")) return "ovarian cancer"
  if (text.includes("prostate")) return "prostate cancer"
  if (text.includes("lung")) return "lung cancer"
  if (text.includes("cervical")) return "cervical cancer"
  if (text.includes("endometrial") || text.includes("uterine")) return "endometrial cancer"
  if (includesAny(text, ["cancer", "carcinoma", "melanoma"])) return "cancer"
  return value.trim() || "cancer"
}

function extractPackYears(terms: string[]): number | undefined {
  const combined = terms.join(" ").toLowerCase()
  const match = combined.match(/(\d{1,3})\s*(?:pack[-\s]?years?|pack year)/)
  if (!match) return undefined
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) ? value : undefined
}

function extractQuitYears(terms: string[]): number | undefined {
  const combined = terms.join(" ").toLowerCase()
  const match = combined.match(/quit\s*(?:smoking)?\s*(\d{1,2})\s*years?\s*ago/)
  if (!match) return undefined
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) ? value : undefined
}

function legacySex(value?: string): SexAtBirth {
  const text = normalized(value)
  if (includesAny(text, ["female", "woman", "women"])) return "female"
  if (includesAny(text, ["male", "man", "men"])) return "male"
  return "unknown"
}

function legacySymptoms(symptoms: string[]): ScreeningIntake["symptoms"] {
  const text = symptoms.map(normalized).join(" | ")
  return {
    rectalBleeding: includesAny(text, ["rectal bleeding", "blood in stool", "bloody stool"]),
    unexplainedWeightLoss: includesAny(text, ["weight loss", "unexplained weight"]),
    breastMass: includesAny(text, ["breast mass", "breast lump", "lump in breast"]),
    hemoptysis: includesAny(text, ["hemoptysis", "coughing blood", "blood in sputum"]),
    abnormalUterineBleeding: includesAny(text, ["abnormal uterine bleeding", "postmenopausal bleeding", "heavy bleeding"]),
    neurologicDeficit: includesAny(text, ["weakness", "facial droop", "neurologic deficit", "new paralysis"]),
    severePain: includesAny(text, ["severe pain", "worst pain"]),
    otherRedFlags: symptoms.filter((item) => includesAny(normalized(item), ["red flag", "rapidly worsening"])),
  }
}

function legacyCancerHistory(conditions: string[]): ScreeningIntake["personalHistory"]["cancers"] {
  return conditions
    .filter((entry) => includesAny(normalized(entry), ["cancer", "carcinoma", "melanoma"]))
    .filter((entry) =>
      includesAny(normalized(entry), ["personal history", "history of", "survivor", "treated for"]) ||
      !includesAny(normalized(entry), ["family", "mother", "father", "brother", "sister", "parent"])
    )
    .map((entry) => ({ type: parseCancerType(entry), diagnosisAge: parseDiagnosisAge(entry) }))
}

export function screeningIntakeFromLegacy(input: LegacyScreeningInput = {}): ScreeningIntake {
  const conditions = input.conditions || []
  const familyHistory = input.familyHistory || []
  const allTerms = [...conditions, ...familyHistory]
  const allSmokingTerms = [...conditions, ...familyHistory, ...(input.symptoms || [])]
  const smokingText = allSmokingTerms.map(normalized).join(" | ")
  const formerSmokingSignal = includesAny(smokingText, [
    "former smoker",
    "used to smoke",
    "quit smoking",
    "ex-smoker",
  ])
  const genes = allTerms
    .flatMap((term) => term.split(/[^a-zA-Z0-9]+/))
    .map((term) => normalizeGene(term))
    .filter((gene): gene is NonNullable<ReturnType<typeof normalizeGene>> => Boolean(gene))
  const hasGenericHereditarySignal = allTerms.some((term) =>
    includesAny(normalized(term), [
      "reported germline mutation signal",
      "germline mutation",
      "hereditary cancer",
      "inherited cancer",
      "pathogenic variant",
      "mutation carrier",
    ])
  )
  const uniqueGenes = Array.from(new Set([
    ...genes,
    ...(hasGenericHereditarySignal && genes.length === 0 ? ["HEREDITARY" as const] : []),
  ]))
  const packYears = extractPackYears(allSmokingTerms)
  const quitYearsAgo = extractQuitYears(allSmokingTerms)

  return {
    patientId: input.patientId,
    demographics: {
      age: clampAge(input.age),
      sexAtBirth: legacySex(input.gender),
    },
    personalHistory: {
      cancers: legacyCancerHistory(conditions),
      colonPolyps: conditions.some((entry) => includesAny(normalized(entry), ["colon polyp", "adenoma"])),
      advancedAdenoma: conditions.some((entry) => normalized(entry).includes("advanced adenoma")),
      inflammatoryBowelDisease: conditions.some((entry) =>
        includesAny(normalized(entry), ["inflammatory bowel disease", "ulcerative colitis", "crohn", "ibd"])
      ),
      priorChestRadiation: conditions.some((entry) => normalized(entry).includes("chest radiation")),
      immunosuppression: conditions.some((entry) => normalized(entry).includes("immunosuppression")),
      hysterectomy: conditions.some((entry) => normalized(entry).includes("hysterectomy")),
      cervixPresent: input.reportedHistory?.cervixPresent === "no" ||
        conditions.some((entry) => includesAny(normalized(entry), ["cervix absent", "cervix removed", "no cervix"]))
        ? false
        : input.reportedHistory?.cervixPresent === "yes" ||
          conditions.some((entry) => includesAny(normalized(entry), ["cervix present", "cervix intact", "have my cervix"]))
          ? true
          : undefined,
    },
    familyHistory: familyHistory.map((entry) => {
      const entryUpper = normalized(entry).toUpperCase()
      const matchedGene = uniqueGenes.find((gene) => entryUpper.includes(gene))
      return {
        relationship: parseRelationship(entry),
        cancerType: parseCancerType(entry),
        diagnosisAge: parseDiagnosisAge(entry),
        knownMutation: matchedGene,
      }
    }),
    genetics: {
      knownPathogenicVariants: uniqueGenes.map((gene) => ({ gene, classification: "pathogenic" as const })),
    },
    smoking: {
      currentSmoker:
        typeof input.smoker === "boolean"
          ? input.smoker && !formerSmokingSignal
          : undefined,
      formerSmoker:
        formerSmokingSignal || (!input.smoker && quitYearsAgo !== undefined)
          ? true
          : typeof input.smoker === "boolean"
            ? false
            : undefined,
      packYears,
      quitYearsAgo,
    },
    priorScreening: conditions
      .filter((entry) => includesAny(normalized(entry), ["colonoscopy", "fit", "stool", "cologuard", "ct colonography", "virtual colonoscopy", "mammogram", "pap", "hpv", "ldct", "low-dose ct", "lung ct", "chest ct", "ct chest", "psa"]))
      .map((entry) => ({
        screeningType: entry,
        date: entry.match(/\b(20\d{2}|19\d{2})\b/)?.[1],
        result: includesAny(normalized(entry), ["abnormal", "positive", "polyp", "adenoma", "mass", "nodule"])
          ? "abnormal"
          : includesAny(normalized(entry), ["normal", "negative", "clear", "no polyp"])
            ? "normal"
            : "unknown",
        details: entry.includes(":") ? entry.split(":").slice(1).join(":").trim() : undefined,
      })),
    symptoms: legacySymptoms(input.symptoms || []),
    reportedHistory: input.reportedHistory,
  }
}

function addUnknownIntakeRecommendation(recommendations: ScreeningRecommendation[]) {
  addUnique(recommendations, recommendation({
    id: "complete-screening-intake",
    cancerType: "general prevention",
    screeningName: "Complete screening intake",
    status: "unknown",
    riskCategory: "unknown",
    rationale: "The current answers do not include enough age, sex-at-birth, symptom, family-history, or prior-screening detail to produce guideline-based screening guidance safely.",
    recommendedNextStep: "Add age, sex used for screening intervals, prior screening dates, and any family or personal cancer history.",
    suggestedTiming: "Before relying on this plan",
    sourceId: "uspstf-a-b-2025",
    evidenceGrade: "Not graded",
    requiresClinicianReview: false,
    patientFriendlyExplanation: "OpenRx needs a little more context before it can show screening guidance safely.",
    clinicianSummary: "Screening intake incomplete; no definitive screening status generated.",
    nextSteps: ["request_care_navigation"],
  }))
}

function addRedFlagRecommendations(recommendations: ScreeningRecommendation[], intake: ScreeningIntake) {
  for (const finding of detectRedFlags(intake)) {
    addUnique(recommendations, recommendation({
      id: `red-flag-${finding.key}`,
      cancerType: finding.cancerContext,
      screeningName: `${finding.label} evaluation`,
      status: "urgent_clinician_review",
      riskCategory: "symptomatic",
      rationale: `${finding.label} is a symptom signal. This should be handled as diagnostic evaluation, not routine preventive screening.`,
      recommendedNextStep: finding.nextSteps.includes("seek_urgent_care")
        ? "Seek timely medical evaluation now, especially if symptoms are new, heavy, worsening, or accompanied by weakness, fainting, chest pain, or shortness of breath."
        : "Request clinician review so the correct diagnostic pathway can be chosen.",
      suggestedTiming: "Now or as soon as clinically appropriate",
      sourceId: "nci-screening-overview-2026",
      evidenceGrade: "Not graded",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "Because you reported a symptom, OpenRx should not treat this as routine screening. A clinician should help decide the right diagnostic next step.",
      clinicianSummary: `Reported red flag: ${finding.label}. Route to diagnostic evaluation rather than preventive screening interval logic.`,
      nextSteps: finding.nextSteps,
    }))
  }
}

function addPersonalCancerHistoryRecommendations(recommendations: ScreeningRecommendation[], intake: ScreeningIntake) {
  for (const cancer of intake.personalHistory.cancers || []) {
    const cancerType = parseCancerType(cancer.type)
    const slug = normalized(cancerType).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cancer"
    addUnique(recommendations, recommendation({
      id: `personal-history-${slug}`,
      cancerType,
      screeningName: `${cancerType.replace(/\b\w/g, (char) => char.toUpperCase())} follow-up plan`,
      status: "surveillance_or_follow_up",
      riskCategory: "personal_history",
      rationale: `A personal history of ${cancerType} is not routine average-risk screening. It usually needs individualized surveillance or survivorship follow-up.`,
      recommendedNextStep: "Request specialist review or bring prior treatment and pathology records to your clinician so the follow-up interval can be personalized.",
      suggestedTiming: "Clinician-guided",
      sourceId: "nci-screening-overview-2026",
      evidenceGrade: "Not graded",
      requiresClinicianReview: true,
      patientFriendlyExplanation: `Because you reported a personal history of ${cancerType}, OpenRx should route you to a personalized follow-up plan rather than routine screening advice.`,
      clinicianSummary: `Personal history of ${cancerType}; exact surveillance rule not implemented in OpenRx. Confirm disease course, treatment, stage/pathology, and current survivorship plan.`,
      nextSteps: ["request_specialist_review", "request_care_navigation", "download_clinician_summary"],
    }))
  }
}

function addPriorAbnormalResultRecommendations(recommendations: ScreeningRecommendation[], intake: ScreeningIntake) {
  const abnormalColorectal = intake.priorScreening.filter(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), [
        "colonoscopy",
        "fit",
        "stool",
        "cologuard",
        "ct colonography",
        "virtual colonoscopy",
      ])
  )
  if (abnormalColorectal.length > 0) {
    addUnique(recommendations, recommendation({
      id: "prior-abnormal-colorectal-result-review",
      cancerType: "colorectal cancer",
      screeningName: "Prior abnormal colorectal result review",
      status: "surveillance_or_follow_up",
      riskCategory: "increased_risk",
      rationale: "A prior positive colorectal test, polyp, or adenoma should not be assigned an average-risk screening interval without the procedure and pathology details.",
      recommendedNextStep: "Bring the colonoscopy or test report and pathology to primary care or gastroenterology so the correct follow-up interval can be determined.",
      suggestedTiming: "Before using an average-risk interval",
      sourceId: "uspstf-crc-2021",
      evidenceGrade: "Not graded",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "The result you reported may need a surveillance plan rather than routine average-risk screening. OpenRx needs the report details and should not guess the interval.",
      clinicianSummary: `Prior abnormal colorectal screening reported: ${abnormalColorectal.map((item) => `${item.screeningType}${item.date ? ` (${item.date})` : ""}`).join("; ")}. Obtain procedure/pathology details and recommended recall interval.`,
      nextSteps: ["request_colonoscopy", "request_specialist_review", "download_clinician_summary"],
    }))
  }

  const abnormalLungCt = intake.priorScreening.filter(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), ["ldct", "low-dose ct", "lung ct", "chest ct", "ct chest"])
  )
  if (abnormalLungCt.length > 0) {
    addUnique(recommendations, recommendation({
      id: "prior-abnormal-lung-ct-review",
      cancerType: "lung cancer",
      screeningName: "Prior abnormal chest CT follow-up",
      status: "surveillance_or_follow_up",
      riskCategory: "increased_risk",
      rationale: "A prior abnormal chest CT or lung nodule should follow the documented diagnostic or nodule-management plan rather than a routine annual screening assumption.",
      recommendedNextStep: "Bring the CT report and recommended follow-up plan to primary care, pulmonology, or the ordering clinician.",
      suggestedTiming: "Use the report's follow-up recommendation",
      sourceId: "uspstf-lung-2021",
      evidenceGrade: "Not graded",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "An abnormal CT needs report-specific follow-up. OpenRx should not replace that plan with a routine screening interval.",
      clinicianSummary: `Prior abnormal chest CT reported: ${abnormalLungCt.map((item) => `${item.screeningType}${item.date ? ` (${item.date})` : ""}`).join("; ")}. Obtain Lung-RADS or diagnostic impression and recommended follow-up.`,
      nextSteps: ["request_specialist_review", "request_imaging", "download_clinician_summary"],
    }))
  }

  const abnormalMammogram = intake.priorScreening.filter(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), ["mammogram", "mammography"])
  )
  if (abnormalMammogram.length > 0) {
    addUnique(recommendations, recommendation({
      id: "prior-abnormal-mammogram-review",
      cancerType: "breast cancer",
      screeningName: "Prior abnormal mammogram follow-up",
      status: "surveillance_or_follow_up",
      riskCategory: "increased_risk",
      rationale: "A prior abnormal mammogram needs the report-specific diagnostic follow-up plan rather than a routine biennial screening assumption.",
      recommendedNextStep: "Bring the mammogram report and any recommended diagnostic imaging or biopsy plan to the ordering clinician or breast imaging center.",
      suggestedTiming: "Use the report's follow-up recommendation",
      sourceId: "uspstf-breast-2024",
      evidenceGrade: "Not graded",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "An abnormal mammogram should follow the radiology report. OpenRx should not replace that plan with a routine screening interval.",
      clinicianSummary: `Prior abnormal mammogram reported: ${abnormalMammogram.map((item) => `${item.screeningType}${item.date ? ` (${item.date})` : ""}`).join("; ")}. Obtain BI-RADS assessment and recommended diagnostic follow-up.`,
      nextSteps: ["request_imaging", "request_specialist_review", "download_clinician_summary"],
    }))
  }

  const abnormalCervical = intake.priorScreening.filter(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), ["pap", "hpv", "cervical"])
  )
  if (abnormalCervical.length > 0) {
    addUnique(recommendations, recommendation({
      id: "prior-abnormal-cervical-result-review",
      cancerType: "cervical cancer",
      screeningName: "Prior abnormal Pap or HPV follow-up",
      status: "surveillance_or_follow_up",
      riskCategory: "increased_risk",
      rationale: "A prior abnormal Pap, positive HPV test, or cervical precancer finding requires result-specific surveillance rather than a routine average-risk interval.",
      recommendedNextStep: "Bring the cytology, HPV, colposcopy, and pathology results to gynecology or the clinician managing the follow-up plan.",
      suggestedTiming: "Use the documented follow-up recommendation",
      sourceId: "uspstf-cervical-2018",
      evidenceGrade: "Not graded",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "An abnormal cervical result needs a result-specific follow-up plan. OpenRx should not guess the interval.",
      clinicianSummary: `Prior abnormal cervical screening reported: ${abnormalCervical.map((item) => `${item.screeningType}${item.date ? ` (${item.date})` : ""}`).join("; ")}. Obtain cytology/HPV genotype, colposcopy/pathology, and recall plan.`,
      nextSteps: ["request_cervical_screening", "request_specialist_review", "download_clinician_summary"],
    }))
  }
}

function addHereditaryRiskRecommendations(recommendations: ScreeningRecommendation[], intake: ScreeningIntake) {
  const genes = (intake.genetics.knownPathogenicVariants || [])
    .filter((variant) => variant.classification !== "unknown")
    .map((variant) => variant.gene)
  const normalizedGenes = genes.map((gene) => normalizeGene(gene)).filter((gene): gene is NonNullable<ReturnType<typeof normalizeGene>> => Boolean(gene))
  const pathways = getPathwaysForGenes(normalizedGenes)

  if (normalizedGenes.length === 0) return
  const hasGenericSignal = normalizedGenes.includes("HEREDITARY")
  const specificGenes = Array.from(new Set(normalizedGenes.filter((gene) => gene !== "HEREDITARY")))
  const variantLabel = specificGenes.length > 0
    ? specificGenes.join(", ")
    : "reported inherited-risk signal"

  addUnique(recommendations, recommendation({
    id: "hereditary-cancer-genetic-counseling",
    cancerType: pathways.length ? pathways.join(", ") : "hereditary cancer risk",
    screeningName: "Genetic counseling and high-risk pathway review",
    status: "high_risk",
    riskCategory: "hereditary_risk",
    rationale: hasGenericSignal && specificGenes.length === 0
      ? "A reported inherited-risk or germline mutation signal can change screening start age, modality, and interval."
      : `Known pathogenic or likely pathogenic variants (${variantLabel}) can change screening start age, modality, and interval.`,
    recommendedNextStep: "Request genetic counseling or high-risk clinic review before relying on average-risk screening intervals.",
    suggestedTiming: "Before choosing a routine screening interval",
    sourceId: "nci-cancer-genetics-2024",
    evidenceGrade: "Not graded",
    requiresClinicianReview: true,
    patientFriendlyExplanation: "A known inherited-risk result may mean your screening plan should be different from average-risk guidelines. OpenRx can help organize genetic counseling or high-risk clinic review.",
    clinicianSummary: `Known hereditary cancer signal: ${variantLabel}. Exact NCCN interval logic is not encoded; route to genetics/high-risk specialist review.`,
    nextSteps: ["request_genetic_counseling", "request_specialist_review", "download_clinician_summary"],
  }))
}

function addFamilyHistoryOverrides(recommendations: ScreeningRecommendation[], intake: ScreeningIntake) {
  const crcFamily = familyCancer(intake, ["colon", "colorectal", "rectal"])
  if (crcFamily.length > 0) {
    const earlyOrFirstDegree = hasFirstDegreeFamilyCancer(intake, ["colon", "colorectal", "rectal"]) || hasEarlyFamilyCancer(intake, ["colon", "colorectal", "rectal"], 60)
    addUnique(recommendations, recommendation({
      id: "crc-family-history-review",
      cancerType: "colorectal cancer",
      screeningName: earlyOrFirstDegree ? "Colonoscopy and GI review" : "Colorectal family-history review",
      status: "needs_clinician_review",
      riskCategory: earlyOrFirstDegree ? "increased_risk" : "unknown",
      rationale: "Family history can change colorectal screening start age, modality, and interval, so average-risk USPSTF logic should not be applied blindly.",
      recommendedNextStep: "Request GI or primary-care review for colonoscopy planning and bring family diagnosis ages plus any prior colonoscopy/pathology records.",
      suggestedTiming: earlyOrFirstDegree ? "Before routine average-risk interval is used" : "At next preventive visit",
      sourceId: "acg-crc-2021",
      evidenceGrade: "Conditional; very low-quality evidence",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "Because you reported colorectal cancer in the family, the practical next step is usually colonoscopy/GI planning rather than a generic average-risk checklist. A clinician should confirm the exact timing.",
      clinicianSummary: `Family colorectal history entries: ${crcFamily.map((entry) => `${entry.relationship}:${entry.cancerType}${entry.diagnosisAge ? `@${entry.diagnosisAge}` : ""}`).join("; ")}. Exact ACG/USMSTF family-history interval not implemented.`,
      nextSteps: ["request_colonoscopy", "request_referral", "request_specialist_review", "download_clinician_summary"],
    }))
  }

  const brcaFamily = familyCancer(intake, ["breast", "ovarian", "tubal", "peritoneal"])
  const prostateFamily = familyCancer(intake, ["prostate"])
  const hasKnownFamilyMutation = intake.familyHistory.some((entry) => entry.knownMutation)
  const inheritedProstateGene = (intake.genetics.knownPathogenicVariants || []).some((variant) =>
    ["BRCA", "BRCA1", "BRCA2", "HOXB13", "ATM", "CHEK2"].includes(normalizeGene(variant.gene) || "")
  )

  if (
    intake.demographics.sexAtBirth === "male" &&
    (prostateFamily.length > 0 || inheritedProstateGene || hasKnownFamilyMutation)
  ) {
    addUnique(recommendations, recommendation({
      id: "hereditary-prostate-screening-review",
      cancerType: "prostate cancer",
      screeningName: "PSA and hereditary prostate-risk review",
      status: "high_risk",
      riskCategory: "hereditary_risk",
      rationale: "Family prostate cancer or inherited-risk variants can change prostate screening timing and should not be handled as routine average-risk screening alone.",
      recommendedNextStep: "Request a PSA shared-decision visit with primary care or urology, and genetics/high-risk review when a mutation is known or suspected.",
      suggestedTiming: "Now or at the next preventive visit",
      sourceId: "uspstf-prostate-2018",
      evidenceGrade: "C",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "Because you reported prostate cancer family history or an inherited-risk signal, ask for a PSA discussion and high-risk review rather than treating this as routine screening only.",
      clinicianSummary: `Prostate hereditary-risk signal detected: ${prostateFamily.map((entry) => `${entry.relationship}:${entry.cancerType}${entry.diagnosisAge ? `@${entry.diagnosisAge}` : ""}`).join("; ") || "mutation/familial signal"}. Exact NCCN interval logic is not encoded; route to urology/genetics or high-risk review.`,
      nextSteps: ["request_psa_discussion", "request_specialist_review", "request_genetic_counseling", "download_clinician_summary"],
    }))
  }

  if (brcaFamily.length > 0 || hasKnownFamilyMutation) {
    const mutationOnly = brcaFamily.length === 0 && hasKnownFamilyMutation
    addUnique(recommendations, recommendation({
      id: "brca-family-history-risk-assessment",
      cancerType: mutationOnly ? "hereditary cancer risk" : "breast/ovarian hereditary risk",
      screeningName: mutationOnly ? "Genetic counseling and inherited-risk review" : "Genetic counseling and BRCA-related risk assessment",
      status: "needs_clinician_review",
      riskCategory: "hereditary_risk",
      rationale: mutationOnly
        ? "A known familial mutation or inherited-risk signal can warrant clinician review and genetic counseling before using routine screening intervals."
        : "Family breast, ovarian, tubal, peritoneal cancer, or known familial mutation can warrant a validated familial risk assessment and possible genetic counseling.",
      recommendedNextStep: "Request genetic counseling or a clinician-led hereditary risk assessment.",
      suggestedTiming: mutationOnly ? "Before relying on average-risk intervals" : "Before deciding whether average-risk breast screening is enough",
      sourceId: mutationOnly ? "nci-cancer-genetics-2024" : "uspstf-brca-2019",
      evidenceGrade: mutationOnly ? "Not graded" : "B",
      requiresClinicianReview: true,
      patientFriendlyExplanation: mutationOnly
        ? "A reported inherited-risk result may change which screenings are appropriate and when they should start. A clinician or genetic counselor should review it."
        : "Your family history may mean you should be checked for hereditary risk and offered genetic counseling before choosing a routine screening plan.",
      clinicianSummary: mutationOnly
        ? "Known familial mutation/hereditary signal reported without breast/ovarian family-history pattern; route to genetics/high-risk review."
        : "USPSTF BRCA-related risk assessment pathway triggered by family history/familial mutation signal.",
      nextSteps: ["request_genetic_counseling", "request_specialist_review", "download_clinician_summary"],
    }))
  }

  const mappedFamilyTerms = [
    "colon",
    "colorectal",
    "rectal",
    "breast",
    "ovarian",
    "tubal",
    "peritoneal",
    "prostate",
  ]
  const unmappedFamilyHistory = intake.familyHistory.filter(
    (entry) => !includesAny(normalized(entry.cancerType), mappedFamilyTerms)
  )
  if (unmappedFamilyHistory.length > 0) {
    addUnique(recommendations, recommendation({
      id: "other-family-cancer-history-review",
      cancerType: "familial cancer risk",
      screeningName: "Family cancer history review",
      status: "needs_clinician_review",
      riskCategory: "unknown",
      rationale: "Some family cancer patterns may warrant inherited-risk assessment, but OpenRx does not have a version-stamped screening interval for the reported pattern.",
      recommendedNextStep: "Review the exact cancer type, relative, diagnosis age, and whether multiple related cancers occurred on one side of the family with a clinician or genetic counselor.",
      suggestedTiming: "At the next preventive visit",
      sourceId: "nci-cancer-genetics-2024",
      evidenceGrade: "Not graded",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "This family history does not automatically add a routine screening test in OpenRx. A clinician can decide whether the pattern suggests inherited risk or another follow-up.",
      clinicianSummary: `Unmapped family cancer history: ${unmappedFamilyHistory.map((entry) => `${entry.relationship}:${entry.cancerType}${entry.diagnosisAge ? `@${entry.diagnosisAge}` : ""}`).join("; ")}. No deterministic interval encoded; review pedigree and genetics referral criteria.`,
      nextSteps: ["request_genetic_counseling", "request_specialist_review", "download_clinician_summary"],
    }))
  }
}

function addHighRiskColorectalHistoryRecommendations(
  recommendations: ScreeningRecommendation[],
  intake: ScreeningIntake
) {
  if (intake.personalHistory.inflammatoryBowelDisease) {
    addUnique(recommendations, recommendation({
      id: "ibd-colorectal-surveillance-review",
      cancerType: "colorectal cancer",
      screeningName: "IBD colorectal surveillance review",
      status: "surveillance_or_follow_up",
      riskCategory: "increased_risk",
      rationale: "Colonic inflammatory bowel disease uses disease-duration, extent, inflammation, and prior-dysplasia surveillance rather than average-risk colorectal screening intervals.",
      recommendedNextStep: "Request gastroenterology review and bring the IBD diagnosis date, disease extent, prior colonoscopy/pathology, and any dysplasia history.",
      suggestedTiming: "Gastroenterology-directed",
      sourceId: "acg-uc-2025",
      evidenceGrade: "Guideline-directed clinician review",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "IBD involving the colon needs a surveillance plan from gastroenterology. OpenRx should not assign an average-risk interval.",
      clinicianSummary: "Colonic IBD signal detected. Confirm disease duration/extent, inflammatory activity, PSC, family history, prior dysplasia, and colonoscopy quality before setting surveillance.",
      nextSteps: ["request_colonoscopy", "request_specialist_review", "download_clinician_summary"],
    }))
  }

  if (intake.personalHistory.advancedAdenoma || intake.personalHistory.colonPolyps) {
    addUnique(recommendations, recommendation({
      id: "post-polypectomy-surveillance-review",
      cancerType: "colorectal cancer",
      screeningName: "Post-polypectomy surveillance review",
      status: "surveillance_or_follow_up",
      riskCategory: "increased_risk",
      rationale: "After colon polyps or an advanced adenoma, the next colonoscopy interval depends on the number, size, histology, completeness of removal, and quality of the prior exam.",
      recommendedNextStep: "Bring the colonoscopy and pathology reports to gastroenterology or primary care so the USMSTF surveillance interval can be applied.",
      suggestedTiming: "Use the pathology-based recall plan",
      sourceId: "usmstf-polypectomy-2020",
      evidenceGrade: "Consensus recommendation",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "A history of polyps or advanced adenoma needs pathology-based surveillance, not a routine average-risk schedule.",
      clinicianSummary: "Polyp/advanced adenoma history reported. Obtain number, size, histology, resection completeness, bowel preparation quality, and recommended recall interval.",
      nextSteps: ["request_colonoscopy", "request_specialist_review", "download_clinician_summary"],
    }))
  }
}

function addHighRiskCervicalHistoryRecommendations(
  recommendations: ScreeningRecommendation[],
  intake: ScreeningIntake
) {
  if (!intake.personalHistory.immunosuppression || hasCancerHistory(intake, "cervical")) return
  addUnique(recommendations, recommendation({
    id: "cervical-immunosuppression-review",
    cancerType: "cervical cancer",
    screeningName: "Immunosuppression-specific cervical screening review",
    status: "needs_clinician_review",
    riskCategory: "increased_risk",
    rationale: "USPSTF average-risk cervical screening intervals do not apply to people with a compromised immune system.",
    recommendedNextStep: "Request gynecology or primary-care review using the immune condition, medications, cervix status, and prior Pap/HPV results.",
    suggestedTiming: "Before using an average-risk interval",
    sourceId: "uspstf-cervical-2018",
    evidenceGrade: "Outside average-risk scope",
    requiresClinicianReview: true,
    patientFriendlyExplanation: "Immunosuppression can change cervical screening timing. OpenRx should not apply the routine average-risk schedule.",
    clinicianSummary: "Immunosuppression reported. Confirm condition/therapy, cervix status, HIV/transplant context if relevant, and prior cytology/HPV history before setting interval.",
    nextSteps: ["request_cervical_screening", "request_specialist_review", "download_clinician_summary"],
  }))
}

function addAverageRiskCancerScreening(recommendations: ScreeningRecommendation[], intake: ScreeningIntake) {
  const age = intake.demographics.age
  const sexAtBirth = intake.demographics.sexAtBirth || "unknown"
  const cervixPresent = intake.personalHistory.cervixPresent
  const hasAbnormalColorectalScreening = intake.priorScreening.some(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), ["colonoscopy", "fit", "stool", "cologuard", "ct colonography", "virtual colonoscopy"])
  )
  const hasHighRiskCrc = intake.personalHistory.colonPolyps || intake.personalHistory.advancedAdenoma || intake.personalHistory.inflammatoryBowelDisease || hasCancerHistory(intake, "colorectal") || familyCancer(intake, ["colon", "colorectal", "rectal"]).length > 0 || hasAbnormalColorectalScreening
  const hasHighRiskBreast = intake.personalHistory.priorChestRadiation || hasCancerHistory(intake, "breast") || (intake.genetics.knownPathogenicVariants || []).some((variant) => ["BRCA", "BRCA1", "BRCA2", "PALB2", "TP53", "PTEN", "CDH1"].includes(normalizeGene(variant.gene) || ""))
  const hasAbnormalMammogram = intake.priorScreening.some(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), ["mammogram", "mammography"])
  )
  const hasAbnormalCervicalScreening = intake.priorScreening.some(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), ["pap", "hpv", "cervical"])
  )
  const hasCervicalSurveillanceRisk = intake.personalHistory.immunosuppression || hasCancerHistory(intake, "cervical") || hasAbnormalCervicalScreening
  const hasAbnormalLungCt = intake.priorScreening.some(
    (item) =>
      item.result === "abnormal" &&
      includesAny(normalized(item.screeningType), ["ldct", "low-dose ct", "lung ct", "chest ct", "ct chest"])
  )

  if (age === undefined) return

  if (!hasHighRiskCrc) {
    const colorectalTests = intake.priorScreening.filter((item) =>
      includesAny(normalized(item.screeningType), ["colonoscopy", "fit", "stool", "cologuard", "ct colonography", "virtual colonoscopy"])
    )
    const colonoscopyYears = latestNormalScreeningYears(intake, ["colonoscopy"])
    const fitYears = latestNormalScreeningYears(intake, ["fit", "stool"])
    const recentlyScreened = (colonoscopyYears !== undefined && colonoscopyYears < 10) || (fitYears !== undefined && fitYears < 1)
    const incompleteColorectalTest = colorectalTests.some((item) => !item.date || item.result === "unknown")
    const screeningDue =
      intake.reportedHistory?.colorectalScreening === "no" ||
      (colorectalTests.length > 0 && !incompleteColorectalTest && !recentlyScreened)
    if (age >= 45 && age <= 75) {
      addUnique(recommendations, recommendation({
        id: "uspstf-average-risk-colorectal",
        cancerType: "colorectal cancer",
        screeningName: "Colorectal cancer screening",
        status: recentlyScreened ? "not_due" : screeningDue ? "due" : "discuss",
        riskCategory: "average_risk",
        rationale: recentlyScreened
          ? "A recent normal colorectal screening entry was reported, so routine average-risk screening may not be due yet."
          : screeningDue
            ? "USPSTF recommends colorectal cancer screening for average-risk adults ages 45 to 75, and the supplied history does not show a current qualifying test."
            : "USPSTF recommends colorectal cancer screening for average-risk adults ages 45 to 75, but the prior-test history is missing, so current due status cannot be settled yet.",
        recommendedNextStep: recentlyScreened
          ? "Confirm the exact test date and result with your clinician."
          : screeningDue
            ? "Request care navigation for FIT, stool DNA, colonoscopy, or another appropriate screening option."
            : "Add the last colorectal test type, date, and result. If none, say that you have never been screened.",
        suggestedTiming: recentlyScreened ? "Confirm interval" : screeningDue ? "Start or update screening now" : "Clarify prior testing first",
        sourceId: "uspstf-crc-2021",
        evidenceGrade: age >= 50 ? "A" : "B",
        requiresClinicianReview: false,
        patientFriendlyExplanation: recentlyScreened
          ? "Based on the screening date you shared, this may not be due yet. Confirm the date and test type with your care team."
          : screeningDue
            ? "Based on age and the prior-screening history supplied, colorectal screening appears due. Symptoms, family history, or prior abnormal results would change the pathway."
            : "Your age falls within the screening range, but OpenRx still needs your prior colorectal test history before calling it due.",
        clinicianSummary: screeningDue
          ? "Average-risk USPSTF colorectal screening logic applied; supplied history indicates no current qualifying screen."
          : "Age-based USPSTF colorectal screening applies, but due status remains unresolved because prior test type/date/result were not supplied.",
        nextSteps: recentlyScreened
          ? ["download_clinician_summary"]
          : screeningDue
            ? ["request_colonoscopy", "request_care_navigation", "download_clinician_summary"]
            : ["request_care_navigation", "download_clinician_summary"],
      }))
    } else if (age >= 76 && age <= 85) {
      addUnique(recommendations, recommendation({
        id: "uspstf-crc-selective-76-85",
        cancerType: "colorectal cancer",
        screeningName: "Colorectal screening shared decision",
        status: "discuss",
        riskCategory: "average_risk",
        rationale: "USPSTF recommends selective colorectal screening ages 76 to 85 based on health, prior screening, and preferences.",
        recommendedNextStep: "Discuss whether further screening makes sense with your clinician.",
        suggestedTiming: "At preventive visit",
        sourceId: "uspstf-crc-2021",
        evidenceGrade: "C",
        requiresClinicianReview: true,
        patientFriendlyExplanation: "At this age, the decision depends on your prior screening and overall health rather than a one-size-fits-all rule.",
        clinicianSummary: "CRC screening age 76-85; selective screening decision needed.",
        nextSteps: ["request_specialist_review", "download_clinician_summary"],
      }))
    }
  }

  if ((sexAtBirth === "female" || sexAtBirth === "intersex") && !hasHighRiskBreast && !hasAbnormalMammogram && age >= 40 && age <= 74) {
    const mammogramTests = intake.priorScreening.filter((item) =>
      includesAny(normalized(item.screeningType), ["mammogram", "mammography"])
    )
    const mammogramYears = latestNormalScreeningYears(intake, ["mammogram", "mammography"])
    const recentlyScreened = mammogramYears !== undefined && mammogramYears < 2
    const incompleteMammogram = mammogramTests.some((item) => !item.date || item.result === "unknown")
    const screeningDue =
      intake.reportedHistory?.breastScreening === "no" ||
      (mammogramTests.length > 0 && !incompleteMammogram && !recentlyScreened)
    addUnique(recommendations, recommendation({
      id: "uspstf-average-risk-breast",
      cancerType: "breast cancer",
      screeningName: "Breast cancer screening mammogram",
      status: recentlyScreened ? "not_due" : screeningDue ? "due" : "discuss",
      riskCategory: "average_risk",
      rationale: recentlyScreened
        ? "A recent normal mammogram was reported, so biennial average-risk screening may not be due yet."
        : screeningDue
          ? "USPSTF recommends biennial mammography for average-risk people assigned female at birth ages 40 to 74, and the supplied history does not show a current mammogram."
          : "USPSTF recommends biennial mammography for average-risk people assigned female at birth ages 40 to 74, but the last mammogram date and result are unknown.",
      recommendedNextStep: recentlyScreened
        ? "Confirm the last mammogram date and recommended next interval."
        : screeningDue
          ? "Request mammogram navigation or discuss with your clinician."
          : "Add the date and result of the last mammogram. If none, say that you have never had one.",
      suggestedTiming: recentlyScreened ? "Confirm interval" : screeningDue ? "Every 2 years when average-risk" : "Clarify prior mammogram first",
      sourceId: "uspstf-breast-2024",
      evidenceGrade: "B",
      requiresClinicianReview: false,
      patientFriendlyExplanation: recentlyScreened
        ? "The mammogram date you shared suggests you may already be current. Confirm the interval with your care team."
        : screeningDue
          ? "Based on age and the prior mammogram history supplied, average-risk mammography appears due."
          : "Your age falls within the mammography range, but OpenRx needs the prior test date and result before calling it due.",
      clinicianSummary: screeningDue
        ? "Average-risk USPSTF breast screening logic applied; supplied history indicates no current mammogram."
        : "USPSTF breast screening eligibility applies, but due status remains unresolved because prior mammogram date/result were not supplied.",
      nextSteps: recentlyScreened
        ? ["download_clinician_summary"]
        : screeningDue
          ? ["request_mammogram", "request_imaging", "download_clinician_summary"]
          : ["request_care_navigation", "download_clinician_summary"],
    }))
  }

  if (
    (sexAtBirth === "female" || sexAtBirth === "intersex") &&
    cervixPresent !== false &&
    !hasCervicalSurveillanceRisk &&
    age >= 21 &&
    age <= 65
  ) {
    const cervicalTests = intake.priorScreening.filter((item) =>
      includesAny(normalized(item.screeningType), ["pap", "hpv", "cervical"])
    )
    const papYears = latestNormalScreeningYears(intake, ["pap", "cervical"])
    const hpvYears = latestNormalScreeningYears(intake, ["hpv"])
    const recentlyScreened =
      (papYears !== undefined && papYears < 3) ||
      (age >= 30 && hpvYears !== undefined && hpvYears < 5)
    const incompleteCervicalTest = cervicalTests.some((item) => !item.date || item.result === "unknown")
    const screeningDue =
      cervixPresent === true &&
      (
        intake.reportedHistory?.cervicalScreening === "no" ||
        (cervicalTests.length > 0 && !incompleteCervicalTest && !recentlyScreened)
      )
    addUnique(recommendations, recommendation({
      id: "uspstf-average-risk-cervical",
      cancerType: "cervical cancer",
      screeningName: "Cervical cancer screening",
      status: recentlyScreened ? "not_due" : screeningDue ? "due" : "discuss",
      riskCategory: "average_risk",
      rationale: recentlyScreened
        ? "A recent normal Pap or HPV screening entry was reported, so average-risk cervical screening may not be due yet."
        : screeningDue
          ? "USPSTF recommends cervical cancer screening for average-risk people with a cervix ages 21 to 65, and the supplied history does not show a current test."
          : "Cervix status and prior Pap/HPV test type, date, and result are needed before current due status can be settled.",
      recommendedNextStep: recentlyScreened
        ? "Confirm the last Pap/HPV result and next interval."
        : screeningDue
          ? "Request cervical screening navigation or discuss the appropriate Pap/HPV strategy with a clinician."
          : "Add whether you currently have a cervix and the type, date, and result of the last Pap or HPV test.",
      suggestedTiming: recentlyScreened
        ? "Confirm interval"
        : screeningDue
          ? age < 30 ? "Pap every 3 years when average-risk" : "Pap/HPV interval depends on test type"
          : "Clarify cervix and prior testing first",
      sourceId: "uspstf-cervical-2018",
      evidenceGrade: "A",
      requiresClinicianReview: false,
      patientFriendlyExplanation: recentlyScreened
        ? "The normal test date you shared suggests cervical screening may already be current. Confirm the interval with your care team."
        : screeningDue
          ? "Based on confirmed cervix status and the prior test history supplied, cervical screening appears due."
          : "OpenRx needs confirmed cervix status and prior Pap/HPV details before calling cervical screening due.",
      clinicianSummary: screeningDue
        ? "Average-risk USPSTF cervical screening logic applied with cervix present and no current qualifying test supplied."
        : "Cervical screening eligibility may apply, but due status remains unresolved pending cervix status and prior test type/date/result.",
      nextSteps: recentlyScreened
        ? ["download_clinician_summary"]
        : screeningDue
          ? ["request_cervical_screening", "request_referral", "download_clinician_summary"]
          : ["request_care_navigation", "download_clinician_summary"],
    }))
  }

  if (
    (sexAtBirth === "female" || sexAtBirth === "intersex") &&
    cervixPresent === false &&
    !hasCervicalSurveillanceRisk &&
    age >= 21
  ) {
    addUnique(recommendations, recommendation({
      id: "cervical-after-cervix-removal-review",
      cancerType: "cervical cancer",
      screeningName: "Cervical screening after cervix removal review",
      status: "discuss",
      riskCategory: "unknown",
      rationale: "USPSTF recommends against routine cervical screening after hysterectomy with cervix removal only when there is no history of high-grade precancer or cervical cancer.",
      recommendedNextStep: "Confirm why the cervix was removed and whether there was any CIN2+, AIS, or cervical cancer history before stopping screening.",
      suggestedTiming: "Confirm surgical and pathology history",
      sourceId: "uspstf-cervical-2018",
      evidenceGrade: "D",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "Routine screening may not be needed after cervix removal, but the reason for surgery and any prior abnormal pathology must be confirmed first.",
      clinicianSummary: "Cervix reported absent. Confirm total hysterectomy, indication, and no prior CIN2+, AIS, or cervical cancer before applying USPSTF Grade D recommendation against routine screening.",
      nextSteps: ["request_specialist_review", "download_clinician_summary"],
    }))
  }

  const lungEligibleSmoking =
    typeof intake.smoking.packYears === "number" &&
    intake.smoking.packYears >= 20 &&
    (intake.smoking.currentSmoker || (typeof intake.smoking.quitYearsAgo === "number" && intake.smoking.quitYearsAgo <= 15))

  if (age >= 50 && age <= 80) {
    if (lungEligibleSmoking && !hasAbnormalLungCt) {
      const lungTests = intake.priorScreening.filter((item) =>
        includesAny(normalized(item.screeningType), ["ldct", "low-dose ct", "lung ct", "chest ct", "ct chest"])
      )
      const priorLdctYears = latestNormalScreeningYears(intake, ["ldct", "low-dose ct", "lung ct", "chest ct", "ct chest"])
      const recentlyScreened = priorLdctYears !== undefined && priorLdctYears < 1
      const incompleteLungTest = lungTests.some((item) => !item.date || item.result === "unknown")
      const screeningDue =
        intake.reportedHistory?.lungScreeningCt === "no" ||
        (lungTests.length > 0 && !incompleteLungTest && !recentlyScreened)
      addUnique(recommendations, recommendation({
        id: "uspstf-lung-ldct",
        cancerType: "lung cancer",
        screeningName: "Low-dose CT lung cancer screening",
        status: recentlyScreened ? "not_due" : screeningDue ? "due" : "discuss",
        riskCategory: "increased_risk",
        rationale: recentlyScreened
          ? "USPSTF recommends annual LDCT for eligible adults, and a recent normal screening CT was reported."
          : screeningDue
            ? "USPSTF recommends annual LDCT for adults ages 50 to 80 with at least 20 pack-years who currently smoke or quit within 15 years, and no current screening CT was reported."
            : "USPSTF annual LDCT eligibility is met from age and smoking exposure, but prior chest CT timing and results were not supplied.",
        recommendedNextStep: recentlyScreened
          ? "Confirm the CT date, result, and next annual screening date."
          : screeningDue
            ? "Request LDCT navigation and smoking-cessation support if relevant."
            : "Add the date and result of any prior screening or diagnostic chest CT before scheduling another scan.",
        suggestedTiming: recentlyScreened ? "Confirm next annual date" : screeningDue ? "Annual when eligible" : "Clarify prior CT first",
        sourceId: "uspstf-lung-2021",
        evidenceGrade: "B",
        requiresClinicianReview: false,
        patientFriendlyExplanation: recentlyScreened
          ? "The CT date you shared suggests annual lung screening may already be current. Confirm the report and next date."
          : screeningDue
            ? "Based on age, smoking history, and the prior CT history supplied, annual LDCT screening appears due."
            : "Age and smoking history fit the USPSTF eligibility range, but OpenRx needs prior chest CT details before calling another scan due.",
        clinicianSummary: screeningDue
          ? "USPSTF lung screening eligibility met; supplied history indicates no current screening LDCT."
          : "USPSTF lung eligibility met, but due status is unresolved pending prior chest CT date, indication, and result.",
        nextSteps: recentlyScreened
          ? ["download_clinician_summary"]
          : screeningDue
            ? ["request_ldct", "request_imaging", "request_care_navigation", "download_clinician_summary"]
            : ["request_care_navigation", "download_clinician_summary"],
      }))
    } else if (
      intake.smoking.currentSmoker ||
      intake.smoking.formerSmoker ||
      // Pack-years with unknown current/quit status must never fall through
      // silently — it's the highest-stakes screening signal in the intake.
      typeof intake.smoking.packYears === "number"
    ) {
      addUnique(recommendations, recommendation({
        id: "lung-smoking-history-clarify",
        cancerType: "lung cancer",
        screeningName: "Clarify lung screening eligibility",
        status: "discuss",
        riskCategory: "unknown",
        rationale: "Smoking was reported, but pack-years and quit timing are needed to determine USPSTF LDCT eligibility.",
        recommendedNextStep: "Add pack-years and quit date or discuss LDCT eligibility with your clinician.",
        suggestedTiming: "Before ordering LDCT screening",
        sourceId: "uspstf-lung-2021",
        evidenceGrade: "B",
        requiresClinicianReview: false,
        patientFriendlyExplanation: "OpenRx needs pack-years and quit timing before it can tell whether lung screening fits USPSTF criteria.",
        clinicianSummary: "Smoking signal present but insufficient detail for LDCT eligibility.",
        nextSteps: ["request_care_navigation", "download_clinician_summary"],
      }))
    } else if (
      intake.smoking.currentSmoker === undefined &&
      intake.smoking.formerSmoker === undefined &&
      intake.smoking.packYears === undefined
    ) {
      addUnique(recommendations, recommendation({
        id: "lung-smoking-history-needed",
        cancerType: "lung cancer",
        screeningName: "Clarify smoking history for lung screening",
        status: "discuss",
        riskCategory: "unknown",
        rationale: "USPSTF LDCT eligibility depends on age, pack-years, current smoking status, and quit timing; smoking history was not supplied.",
        recommendedNextStep: "Add whether the patient ever smoked, total pack-years, whether they currently smoke, and if former, how many years since quitting.",
        suggestedTiming: "Before deciding about LDCT",
        sourceId: "uspstf-lung-2021",
        evidenceGrade: "B",
        requiresClinicianReview: false,
        patientFriendlyExplanation: "At this age, lung screening may matter only if there has been enough smoking exposure. OpenRx needs pack-years and quit timing before recommending LDCT.",
        clinicianSummary: "Age 50-80 but smoking exposure unknown; clarify USPSTF LDCT eligibility variables.",
        nextSteps: ["request_care_navigation", "download_clinician_summary"],
      }))
    }
  }

  if (sexAtBirth === "male" && !hasCancerHistory(intake, "prostate") && age >= 55 && age <= 69) {
    addUnique(recommendations, recommendation({
      id: "uspstf-prostate-shared-decision",
      cancerType: "prostate cancer",
      screeningName: "PSA screening discussion",
      status: "discuss",
      riskCategory: "average_risk",
      rationale: "USPSTF recommends individualized decision-making for PSA-based prostate cancer screening ages 55 to 69.",
      recommendedNextStep: "Discuss potential benefits and harms of PSA screening with a clinician before testing.",
      suggestedTiming: "Shared decision visit",
      sourceId: "uspstf-prostate-2018",
      evidenceGrade: "C",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "For prostate screening, the next step is usually a conversation about benefits and downsides, not an automatic test.",
      clinicianSummary: "USPSTF prostate screening shared decision pathway; no personal prostate cancer history detected.",
      nextSteps: ["request_psa_discussion", "request_specialist_review", "download_clinician_summary"],
    }))
  }
}

function relatedIds(recommendations: ScreeningRecommendation[], predicate: (rec: ScreeningRecommendation) => boolean): string[] {
  return recommendations.filter(predicate).map((rec) => rec.id)
}

function buildClarificationQuestions(
  intake: ScreeningIntake,
  recommendations: ScreeningRecommendation[]
): ScreeningClarification[] {
  const questions: ScreeningClarification[] = []
  const reported = intake.reportedHistory || {}
  const age = intake.demographics.age
  const sexAtBirth = intake.demographics.sexAtBirth || "unknown"
  if (age === undefined || sexAtBirth === "unknown") {
    questions.push({
      id: "clarify-screening-demographics",
      category: "demographics",
      question: age === undefined && sexAtBirth === "unknown"
        ? "What is your age, and what sex was assigned at birth for screening purposes?"
        : age === undefined
          ? "What is your age?"
          : "What sex was assigned at birth for screening purposes?",
      whyItMatters:
        "Age and the organs relevant to screening determine which guideline pathways can be evaluated.",
      relatedRecommendationIds: recommendations.map((rec) => rec.id),
      priority: "required",
    })
  }
  const cancerRecommendationIds = relatedIds(
    recommendations,
    (rec) => rec.cancerType !== "general prevention"
  )
  const personalCancers = intake.personalHistory.cancers || []
  const vaguePersonalCancer = personalCancers.some((entry) =>
    normalized(entry.type) === "cancer" ||
    (!entry.diagnosisAge && !entry.year)
  )
  const incompleteFamilyCancer = intake.familyHistory.some(
    (entry) => !entry.cancerType || normalized(entry.cancerType) === "cancer" || !entry.diagnosisAge
  )

  if (
    vaguePersonalCancer ||
    incompleteFamilyCancer ||
    reported.personalCancer === undefined ||
    reported.familyCancer === undefined
  ) {
    let question =
      "Have you or any close blood relative had cancer? Include who, the cancer type, and the age or year of diagnosis."
    let priority: ScreeningClarification["priority"] = "important"
    if (vaguePersonalCancer) {
      question =
        "For your own cancer history, what cancer was diagnosed, at what age or year, what treatment was given, and what follow-up plan are you on now?"
      priority = "required"
    } else if (incompleteFamilyCancer) {
      question =
        "For each relative with cancer, what was the exact relationship, cancer type, and age at diagnosis?"
      priority = "required"
    } else if (reported.personalCancer !== undefined && reported.familyCancer === undefined) {
      question =
        "Has any close blood relative had cancer? Include the relationship, cancer type, and age at diagnosis."
    } else if (reported.personalCancer === undefined && reported.familyCancer !== undefined) {
      question =
        "Have you ever been diagnosed with cancer? If yes, include the type, diagnosis age or year, treatment, and current follow-up plan."
    }
    questions.push({
      id: "clarify-cancer-history",
      category: "cancer_history",
      question,
      whyItMatters:
        "Personal cancer and detailed family history can replace average-risk screening with surveillance, earlier testing, or genetic-counseling review.",
      relatedRecommendationIds: cancerRecommendationIds,
      priority,
    })
  }

  const colorectalRecommendationIds = relatedIds(
    recommendations,
    (rec) => /colorectal|colonoscop|colon\b/i.test(`${rec.cancerType} ${rec.screeningName}`)
  )
  const colorectalTests = intake.priorScreening.filter((item) =>
    includesAny(normalized(item.screeningType), [
      "colonoscopy",
      "fit",
      "stool",
      "cologuard",
      "ct colonography",
      "virtual colonoscopy",
      "sigmoidoscopy",
    ])
  )
  const abnormalColorectalTest = colorectalTests.find((item) => item.result === "abnormal")
  const incompleteColorectalTest = colorectalTests.find(
    (item) => !item.date || item.result === "unknown"
  )

  if (colorectalRecommendationIds.length > 0) {
    if (abnormalColorectalTest) {
      questions.push({
        id: "clarify-colorectal-abnormal-result",
        category: "prior_test_result",
        question:
          "What did the prior colonoscopy or colorectal test show? Include the date, number/size/type of polyps or adenomas, pathology if available, and the recommended repeat interval.",
        whyItMatters:
          "Abnormal findings use surveillance pathways that can be much shorter than average-risk screening intervals.",
        relatedRecommendationIds: colorectalRecommendationIds,
        priority: "required",
      })
    } else if (reported.colorectalScreening === "yes" && incompleteColorectalTest) {
      questions.push({
        id: "clarify-colorectal-test-details",
        category: "colorectal_history",
        question:
          "When was your last colorectal test, which test was it, and was it normal, positive, or did it find polyps? Include the recommended repeat date if known.",
        whyItMatters:
          "The test type, date, and result determine whether screening is due now or already current.",
        relatedRecommendationIds: colorectalRecommendationIds,
        priority: "required",
      })
    } else if (reported.colorectalScreening === undefined) {
      questions.push({
        id: "clarify-colorectal-screening-history",
        category: "colorectal_history",
        question:
          "Have you had colonoscopy, FIT/stool testing, stool DNA, flexible sigmoidoscopy, or CT colonography before? Include the test, date, and result.",
        whyItMatters:
          "A prior normal test may mean you are not due yet; a positive test or polyps may require a different surveillance interval.",
        relatedRecommendationIds: colorectalRecommendationIds,
        priority: "important",
      })
    }
  }

  const breastRecommendationIds = relatedIds(
    recommendations,
    (rec) => /breast|mammogram|mammography/i.test(`${rec.cancerType} ${rec.screeningName}`)
  )
  const mammogramTests = intake.priorScreening.filter((item) =>
    includesAny(normalized(item.screeningType), ["mammogram", "mammography"])
  )
  const abnormalMammogram = mammogramTests.find((item) => item.result === "abnormal")
  const incompleteMammogram = mammogramTests.find((item) => !item.date || item.result === "unknown")

  if (breastRecommendationIds.length > 0) {
    if (abnormalMammogram) {
      questions.push({
        id: "clarify-abnormal-mammogram",
        category: "prior_test_result",
        question:
          "What did the prior mammogram show? Include the date, BI-RADS assessment, any ultrasound/MRI/biopsy result, and the recommended follow-up.",
        whyItMatters:
          "An abnormal mammogram uses report-specific diagnostic follow-up rather than a routine biennial screening interval.",
        relatedRecommendationIds: breastRecommendationIds,
        priority: "required",
      })
    } else if (reported.breastScreening === "yes" && incompleteMammogram) {
      questions.push({
        id: "clarify-mammogram-details",
        category: "breast_history",
        question:
          "When was your last mammogram, was it normal or abnormal, and was any additional imaging or biopsy recommended?",
        whyItMatters:
          "The date and result determine whether routine screening is current or a diagnostic follow-up pathway is needed.",
        relatedRecommendationIds: breastRecommendationIds,
        priority: "required",
      })
    } else if (
      recommendations.some((rec) => rec.id === "uspstf-average-risk-breast") &&
      reported.breastScreening === undefined
    ) {
      questions.push({
        id: "clarify-mammogram-history",
        category: "breast_history",
        question:
          "Have you had a mammogram before? Include the date, result, and whether additional imaging or biopsy was recommended.",
        whyItMatters:
          "A recent normal mammogram may mean screening is current; an abnormal result requires a different pathway.",
        relatedRecommendationIds: breastRecommendationIds,
        priority: "important",
      })
    }
  }

  const lungRecommendationIds = relatedIds(
    recommendations,
    (rec) => /lung|ldct|low-dose ct/i.test(`${rec.cancerType} ${rec.screeningName}`)
  )
  const lungTests = intake.priorScreening.filter((item) =>
    includesAny(normalized(item.screeningType), ["ldct", "low-dose ct", "lung ct", "chest ct", "ct chest"])
  )
  const incompleteLungTest = lungTests.find((item) => !item.date || item.result === "unknown")
  const abnormalLungTest = lungTests.find((item) => item.result === "abnormal")
  const needsSmokingDetails = recommendations.some(
    (rec) => rec.id === "lung-smoking-history-needed" || rec.id === "lung-smoking-history-clarify"
  )

  if (abnormalLungTest) {
    questions.push({
      id: "clarify-abnormal-lung-ct",
      category: "prior_test_result",
      question:
        "What did the prior chest CT show? Include the date, whether it was screening or diagnostic, the Lung-RADS or radiology impression, nodule size if reported, and the recommended follow-up.",
      whyItMatters:
        "An abnormal CT or lung nodule requires report-specific diagnostic follow-up rather than a routine annual screening assumption.",
      relatedRecommendationIds: lungRecommendationIds,
      priority: "required",
    })
  } else if (needsSmokingDetails) {
    questions.push({
      id: "clarify-smoking-exposure",
      category: "lung_history",
      question:
        "Have you ever smoked? If yes, give total pack-years, whether you smoke now, and how many years ago you quit.",
      whyItMatters:
        "USPSTF lung screening eligibility depends on age, at least 20 pack-years, and current smoking or quitting within 15 years.",
      relatedRecommendationIds: lungRecommendationIds,
      priority: "required",
    })
  } else if (
    recommendations.some((rec) => rec.id === "uspstf-lung-ldct") &&
    reported.lungScreeningCt === undefined
  ) {
    questions.push({
      id: "clarify-prior-lung-screening",
      category: "lung_history",
      question:
        "Have you had a screening low-dose chest CT before? Include the date, result, any lung nodule follow-up, and whether it was screening or a diagnostic CT.",
      whyItMatters:
        "A prior LDCT date and result determine the next annual screen or whether a diagnostic follow-up pathway applies.",
      relatedRecommendationIds: lungRecommendationIds,
      priority: "important",
    })
  } else if (incompleteLungTest) {
    questions.push({
      id: "clarify-lung-ct-result",
      category: "prior_test_result",
      question:
        "What was the date and result of the prior low-dose or lung CT, and was any nodule follow-up recommended?",
      whyItMatters:
        "A screening LDCT and a diagnostic CT are not interchangeable, and an abnormal result needs clinician-directed follow-up.",
      relatedRecommendationIds: lungRecommendationIds,
      priority: "required",
    })
  }

  const cervicalRecommendationIds = relatedIds(
    recommendations,
    (rec) => /cervical|pap|hpv|cervix/i.test(`${rec.cancerType} ${rec.screeningName}`)
  )
  const cervicalTests = intake.priorScreening.filter((item) =>
    includesAny(normalized(item.screeningType), ["pap", "hpv", "cervical"])
  )
  const abnormalCervical = cervicalTests.find((item) => item.result === "abnormal")
  const incompleteCervical = cervicalTests.find((item) => !item.date || item.result === "unknown")

  if (cervicalRecommendationIds.length > 0) {
    if (abnormalCervical) {
      questions.push({
        id: "clarify-abnormal-cervical-result",
        category: "prior_test_result",
        question:
          "What did the abnormal Pap or HPV testing show? Include the date, cytology result, HPV genotype if known, colposcopy/pathology, and recommended follow-up.",
        whyItMatters:
          "Abnormal cervical findings use result-specific surveillance and should not be assigned a routine interval.",
        relatedRecommendationIds: cervicalRecommendationIds,
        priority: "required",
      })
    } else if (recommendations.some((rec) => rec.id === "cervical-after-cervix-removal-review")) {
      questions.push({
        id: "clarify-cervix-removal-history",
        category: "cervical_history",
        question:
          "Was the entire cervix removed, why was surgery performed, and have you ever had CIN2+, AIS, cervical cancer, or an abnormal Pap/HPV result?",
        whyItMatters:
          "Routine screening stops after cervix removal only when the cervix is fully removed and there is no high-grade precancer or cervical cancer history.",
        relatedRecommendationIds: cervicalRecommendationIds,
        priority: "required",
      })
    } else if (reported.cervicalScreening === "yes" && incompleteCervical) {
      questions.push({
        id: "clarify-cervical-test-details",
        category: "cervical_history",
        question:
          "What type of cervical test did you have, when was it done, and was the Pap/HPV result normal or abnormal?",
        whyItMatters:
          "Pap and HPV tests use different intervals, and an abnormal result requires a surveillance pathway.",
        relatedRecommendationIds: cervicalRecommendationIds,
        priority: "required",
      })
    } else if (
      recommendations.some((rec) => rec.id === "uspstf-average-risk-cervical") &&
      (reported.cervixPresent === undefined || reported.cervicalScreening === undefined)
    ) {
      questions.push({
        id: "clarify-cervical-screening-history",
        category: "cervical_history",
        question:
          "Do you currently have a cervix, and when was your last Pap and/or HPV test? Include the test type, date, result, and any prior abnormal finding.",
        whyItMatters:
          "Cervix status, test type, date, and prior abnormal results determine the correct cervical screening or surveillance interval.",
        relatedRecommendationIds: cervicalRecommendationIds,
        priority: "important",
      })
    }
  }

  const sorted = questions.sort(
    (left, right) => Number(right.priority === "required") - Number(left.priority === "required")
  )
  if (sorted.length <= 3) return sorted

  const required = sorted.filter((item) => item.priority === "required")
  if (required.length >= 3) return required.slice(0, 3)

  const routineCategories = new Set<ScreeningClarification["category"]>([
    "colorectal_history",
    "breast_history",
    "lung_history",
    "cervical_history",
  ])
  const routine = sorted.filter(
    (item) => item.priority === "important" && routineCategories.has(item.category)
  )
  const otherImportant = sorted.filter(
    (item) => item.priority === "important" && !routineCategories.has(item.category)
  )
  const roomAfterRequired = 3 - required.length
  const consolidatedRoutine: ScreeningClarification | null = routine.length > 1
    ? {
        id: "clarify-prior-screening-summary",
        category: "prior_test_result",
        question:
          "Which screening tests have you already had that apply here? For each, include the test type, date, result, and any recommended follow-up. Also state whether you currently have a cervix if cervical screening is listed.",
        whyItMatters:
          "Prior test dates and results determine whether screening is due, current, or needs diagnostic or surveillance follow-up.",
        relatedRecommendationIds: Array.from(new Set(routine.flatMap((item) => item.relatedRecommendationIds))),
        priority: "important",
      }
    : routine[0] || null

  return [
    ...required,
    ...otherImportant,
    ...(consolidatedRoutine ? [consolidatedRoutine] : []),
  ].slice(0, required.length + roomAfterRequired)
}

export function recommendScreenings(intake: ScreeningIntake): ScreeningEngineResult {
  const recommendations: ScreeningRecommendation[] = []
  const age = intake.demographics.age
  const hasActionableDemographics = typeof age === "number" || intake.demographics.dateOfBirth
  const highRiskSignals =
    Boolean(intake.personalHistory.cancers?.length) ||
    Boolean(intake.genetics.knownPathogenicVariants?.length) ||
    intake.familyHistory.length > 0 ||
    intake.personalHistory.colonPolyps ||
    intake.personalHistory.advancedAdenoma ||
    intake.personalHistory.inflammatoryBowelDisease
  const redFlags = detectRedFlags(intake)

  if (!hasActionableDemographics && !highRiskSignals && redFlags.length === 0) {
    addUnknownIntakeRecommendation(recommendations)
  }

  addRedFlagRecommendations(recommendations, intake)
  if (redFlags.length > 0) {
    const sourceIds = Array.from(new Set(recommendations.map((item) => item.sourceId).filter((item): item is string => Boolean(item))))
    return {
      generatedAt: new Date().toISOString(),
      engineVersion: SCREENING_ENGINE_VERSION,
      intakeCompleteness: "actionable",
      recommendations: recommendations.sort(compareRecommendations),
      clarificationQuestions: [],
      safetyMessages: [
        "Symptoms reported in this intake should be evaluated as a clinical concern, not handled through routine screening guidance.",
        "Call 911 or seek emergency care now for severe, sudden, or worsening symptoms.",
      ],
      sourceIds,
    }
  }
  addPersonalCancerHistoryRecommendations(recommendations, intake)
  addPriorAbnormalResultRecommendations(recommendations, intake)
  addHereditaryRiskRecommendations(recommendations, intake)
  addFamilyHistoryOverrides(recommendations, intake)
  addHighRiskColorectalHistoryRecommendations(recommendations, intake)
  addHighRiskCervicalHistoryRecommendations(recommendations, intake)
  addAverageRiskCancerScreening(recommendations, intake)

  const sourceIds = Array.from(new Set(recommendations.map((item) => item.sourceId).filter((item): item is string => Boolean(item))))
  const clarificationQuestions = buildClarificationQuestions(intake, recommendations)
  const intakeCompleteness: ScreeningEngineResult["intakeCompleteness"] =
    hasActionableDemographics &&
    clarificationQuestions.length === 0 &&
    (inputHasPriorHistory(intake) || highRiskSignals || redFlags.length > 0)
      ? "actionable"
      : hasActionableDemographics || highRiskSignals || redFlags.length > 0
      ? "partial"
      : "minimal"

  return {
    generatedAt: new Date().toISOString(),
    engineVersion: SCREENING_ENGINE_VERSION,
    intakeCompleteness,
    recommendations: recommendations.sort(compareRecommendations),
    clarificationQuestions,
    safetyMessages: [
      "OpenRx provides guideline-based education and care navigation support; it does not replace clinician judgment.",
      "Symptoms, personal cancer history, hereditary risk, or prior abnormal results should be reviewed with a clinician before routine screening intervals are used.",
    ],
    sourceIds,
  }
}

function inputHasPriorHistory(intake: ScreeningIntake): boolean {
  return (
    intake.priorScreening.length > 0 ||
    Boolean(intake.personalHistory.cancers?.length) ||
    Boolean(
      intake.reportedHistory &&
      Object.values(intake.reportedHistory).some((value) => value === "yes" || value === "no")
    )
  )
}

function statusRank(status: ScreeningStatus): number {
  switch (status) {
    case "urgent_clinician_review":
      return 0
    case "surveillance_or_follow_up":
      return 1
    case "high_risk":
      return 2
    case "needs_clinician_review":
      return 3
    case "due":
      return 4
    case "discuss":
      return 5
    case "unknown":
      return 6
    case "not_due":
      return 7
    default:
      return 8
  }
}

function compareRecommendations(left: ScreeningRecommendation, right: ScreeningRecommendation): number {
  const statusDelta = statusRank(left.status) - statusRank(right.status)
  if (statusDelta !== 0) return statusDelta
  return left.screeningName.localeCompare(right.screeningName)
}

export function nextStepLabel(step: ScreeningNextStep): string {
  switch (step) {
    case "request_care_navigation":
      return "Request care navigation"
    case "request_referral":
      return "Request referral help"
    case "request_imaging":
      return "Request imaging help"
    case "request_lab":
      return "Request lab help"
    case "request_colonoscopy":
      return "Request colonoscopy help"
    case "request_mammogram":
      return "Request mammogram help"
    case "request_ldct":
      return "Request LDCT help"
    case "request_cervical_screening":
      return "Request cervical screening help"
    case "request_psa_discussion":
      return "Request PSA discussion"
    case "request_genetic_counseling":
      return "Request genetic counseling"
    case "request_specialist_review":
      return "Request specialist review"
    case "download_clinician_summary":
      return "Prepare clinician summary"
    case "seek_urgent_care":
      return "Seek urgent care"
    default:
      return "Request next step"
  }
}
