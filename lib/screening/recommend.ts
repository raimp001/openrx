import type {
  ScreeningEngineResult,
  ScreeningIntake,
  ScreeningNextStep,
  ScreeningRecommendation,
  ScreeningRelationship,
  ScreeningSourceSystem,
  ScreeningStatus,
  SexAtBirth,
} from "./types"
import { getGuidelineSource } from "./sources"
import { detectRedFlags } from "./red-flags"
import { getPathwaysForGenes, normalizeGene } from "./hereditary-risk"

export type LegacyScreeningInput = {
  patientId?: string
  age?: number
  gender?: string
  smoker?: boolean
  familyHistory?: string[]
  symptoms?: string[]
  conditions?: string[]
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

function recommendation(input: Omit<ScreeningRecommendation, "sourceVersion" | "sourceSystem"> & { sourceSystem?: ScreeningSourceSystem }): ScreeningRecommendation {
  const source = input.sourceId ? getGuidelineSource(input.sourceId) : undefined
  const rec: ScreeningRecommendation = {
    ...input,
    sourceSystem: input.sourceSystem || source?.organization || "PENDING",
    sourceVersion: source?.versionOrDate,
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
    .filter((item) => item.result !== "abnormal")
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
    .filter((entry) => includesAny(normalized(entry), ["personal history", "history of", "survivor", "treated for"]))
    .filter((entry) => includesAny(normalized(entry), ["cancer", "carcinoma", "melanoma"]))
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
      inflammatoryBowelDisease: conditions.some((entry) => includesAny(normalized(entry), ["ulcerative colitis", "crohn", "ibd"])),
      priorChestRadiation: conditions.some((entry) => normalized(entry).includes("chest radiation")),
      immunosuppression: conditions.some((entry) => normalized(entry).includes("immunosuppression")),
      hysterectomy: conditions.some((entry) => normalized(entry).includes("hysterectomy")),
      cervixPresent: conditions.some((entry) => normalized(entry).includes("cervix present")) || undefined,
    },
    familyHistory: familyHistory.map((entry) => ({
      relationship: parseRelationship(entry),
      cancerType: parseCancerType(entry),
      diagnosisAge: parseDiagnosisAge(entry),
      knownMutation: uniqueGenes[0],
    })),
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
      .filter((entry) => includesAny(normalized(entry), ["colonoscopy", "fit", "mammogram", "pap", "hpv", "ldct", "psa"]))
      .map((entry) => ({
        screeningType: entry,
        date: entry.match(/\b(20\d{2}|19\d{2})\b/)?.[1],
        result: normalized(entry).includes("abnormal") ? "abnormal" : normalized(entry).includes("normal") ? "normal" : "unknown",
      })),
    symptoms: legacySymptoms(input.symptoms || []),
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
    sourceId: "pending-high-risk-oncology",
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
      sourceId: "pending-high-risk-oncology",
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
      sourceId: "pending-high-risk-oncology",
      requiresClinicianReview: true,
      patientFriendlyExplanation: `Because you reported a personal history of ${cancerType}, OpenRx should route you to a personalized follow-up plan rather than routine screening advice.`,
      clinicianSummary: `Personal history of ${cancerType}; exact surveillance rule not implemented in OpenRx. Confirm disease course, treatment, stage/pathology, and current survivorship plan.`,
      nextSteps: ["request_specialist_review", "request_care_navigation", "download_clinician_summary"],
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
    sourceId: "pending-high-risk-oncology",
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
      screeningName: earlyOrFirstDegree ? "Colorectal high-risk screening review" : "Colorectal family-history review",
      status: "needs_clinician_review",
      riskCategory: earlyOrFirstDegree ? "increased_risk" : "unknown",
      rationale: "Family history can change colorectal screening start age, modality, and interval, so average-risk USPSTF logic should not be applied blindly.",
      recommendedNextStep: "Request GI or primary-care review and bring family diagnosis ages plus any prior colonoscopy/pathology records.",
      suggestedTiming: earlyOrFirstDegree ? "Before routine average-risk interval is used" : "At next preventive visit",
      sourceId: "pending-high-risk-oncology",
      requiresClinicianReview: true,
      patientFriendlyExplanation: "Because you reported colorectal cancer in the family, you may need a different plan than average-risk screening. A clinician should confirm the right interval.",
      clinicianSummary: `Family colorectal history entries: ${crcFamily.map((entry) => `${entry.relationship}:${entry.cancerType}${entry.diagnosisAge ? `@${entry.diagnosisAge}` : ""}`).join("; ")}. Exact ACG/USMSTF family-history interval not implemented.`,
      nextSteps: ["request_colonoscopy", "request_referral", "request_specialist_review", "download_clinician_summary"],
    }))
  }

  const brcaFamily = familyCancer(intake, ["breast", "ovarian", "tubal", "peritoneal"])
  const hasKnownFamilyMutation = intake.familyHistory.some((entry) => entry.knownMutation)
  if (brcaFamily.length > 0 || hasKnownFamilyMutation) {
    const mutationOnly = brcaFamily.length === 0 && hasKnownFamilyMutation
    addUnique(recommendations, recommendation({
      id: "brca-family-history-risk-assessment",
      cancerType: mutationOnly ? "hereditary cancer risk" : "breast/ovarian hereditary risk",
      screeningName: mutationOnly ? "Inherited-risk assessment" : "BRCA-related risk assessment",
      status: "needs_clinician_review",
      riskCategory: "hereditary_risk",
      rationale: mutationOnly
        ? "A known familial mutation or inherited-risk signal can warrant clinician review and genetic counseling before using routine screening intervals."
        : "Family breast, ovarian, tubal, peritoneal cancer, or known familial mutation can warrant a validated familial risk assessment and possible genetic counseling.",
      recommendedNextStep: "Request genetic counseling or a clinician-led hereditary risk assessment.",
      suggestedTiming: mutationOnly ? "Before relying on average-risk intervals" : "Before deciding whether average-risk breast screening is enough",
      sourceId: mutationOnly ? "pending-high-risk-oncology" : "uspstf-brca-2019",
      evidenceGrade: mutationOnly ? undefined : "B",
      requiresClinicianReview: true,
      patientFriendlyExplanation: mutationOnly
        ? "A reported inherited-risk result may change which screenings are appropriate and when they should start. A clinician or genetic counselor should review it."
        : "Your family history may mean you should be checked for hereditary risk before choosing a routine screening plan.",
      clinicianSummary: mutationOnly
        ? "Known familial mutation/hereditary signal reported without breast/ovarian family-history pattern; route to genetics/high-risk review."
        : "USPSTF BRCA-related risk assessment pathway triggered by family history/familial mutation signal.",
      nextSteps: ["request_genetic_counseling", "request_specialist_review", "download_clinician_summary"],
    }))
  }
}

function addAverageRiskCancerScreening(recommendations: ScreeningRecommendation[], intake: ScreeningIntake) {
  const age = intake.demographics.age
  const sexAtBirth = intake.demographics.sexAtBirth || "unknown"
  const cervixPresent = intake.personalHistory.cervixPresent !== false && !intake.personalHistory.hysterectomy
  const hasHighRiskCrc = intake.personalHistory.colonPolyps || intake.personalHistory.advancedAdenoma || intake.personalHistory.inflammatoryBowelDisease || hasCancerHistory(intake, "colorectal") || familyCancer(intake, ["colon", "colorectal", "rectal"]).length > 0
  const hasHighRiskBreast = intake.personalHistory.priorChestRadiation || hasCancerHistory(intake, "breast") || (intake.genetics.knownPathogenicVariants || []).some((variant) => ["BRCA", "BRCA1", "BRCA2", "PALB2", "TP53", "PTEN", "CDH1"].includes(normalizeGene(variant.gene) || ""))
  const hasCervicalSurveillanceRisk = intake.personalHistory.immunosuppression || hasCancerHistory(intake, "cervical")

  if (age === undefined) return

  if (!hasHighRiskCrc) {
    const colonoscopyYears = latestNormalScreeningYears(intake, ["colonoscopy"])
    const fitYears = latestNormalScreeningYears(intake, ["fit", "stool"])
    const recentlyScreened = (colonoscopyYears !== undefined && colonoscopyYears < 10) || (fitYears !== undefined && fitYears < 1)
    if (age >= 45 && age <= 75) {
      addUnique(recommendations, recommendation({
        id: "uspstf-average-risk-colorectal",
        cancerType: "colorectal cancer",
        screeningName: "Colorectal cancer screening",
        status: recentlyScreened ? "not_due" : "due",
        riskCategory: "average_risk",
        rationale: recentlyScreened
          ? "A recent normal colorectal screening entry was reported, so routine average-risk screening may not be due yet."
          : "USPSTF recommends colorectal cancer screening for average-risk adults ages 45 to 75.",
        recommendedNextStep: recentlyScreened ? "Confirm the exact test date and result with your clinician." : "Request care navigation for FIT, stool DNA, colonoscopy, or another appropriate screening option.",
        suggestedTiming: recentlyScreened ? "Confirm interval" : "Start or update screening now",
        sourceId: "uspstf-crc-2021",
        evidenceGrade: age >= 50 ? "A" : "B",
        requiresClinicianReview: false,
        patientFriendlyExplanation: recentlyScreened
          ? "Based on the screening date you shared, this may not be due yet. Confirm the date and test type with your care team."
          : "Based on age alone, this screening may be recommended for average-risk adults. Symptoms or family history would change the pathway.",
        clinicianSummary: "Average-risk USPSTF colorectal screening logic applied; no high-risk CRC modifiers detected in supplied intake.",
        nextSteps: recentlyScreened ? ["download_clinician_summary"] : ["request_colonoscopy", "request_care_navigation", "download_clinician_summary"],
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

  if ((sexAtBirth === "female" || sexAtBirth === "intersex") && !hasHighRiskBreast && age >= 40 && age <= 74) {
    const mammogramYears = latestNormalScreeningYears(intake, ["mammogram", "mammography"])
    const recentlyScreened = mammogramYears !== undefined && mammogramYears < 2
    addUnique(recommendations, recommendation({
      id: "uspstf-average-risk-breast",
      cancerType: "breast cancer",
      screeningName: "Breast cancer screening mammogram",
      status: recentlyScreened ? "not_due" : "due",
      riskCategory: "average_risk",
      rationale: recentlyScreened
        ? "A recent normal mammogram was reported, so biennial average-risk screening may not be due yet."
        : "USPSTF recommends biennial mammography for average-risk people assigned female at birth ages 40 to 74.",
      recommendedNextStep: recentlyScreened ? "Confirm the last mammogram date and recommended next interval." : "Request mammogram navigation or discuss with your clinician.",
      suggestedTiming: recentlyScreened ? "Confirm interval" : "Every 2 years when average-risk",
      sourceId: "uspstf-breast-2024",
      evidenceGrade: "B",
      requiresClinicianReview: false,
      patientFriendlyExplanation: recentlyScreened
        ? "The mammogram date you shared suggests you may already be current. Confirm the interval with your care team."
        : "Based on age and sex used for screening intervals, mammography may be recommended every other year for average-risk patients.",
      clinicianSummary: "Average-risk USPSTF breast screening logic applied; no high-risk breast modifiers detected in supplied intake.",
      nextSteps: recentlyScreened ? ["download_clinician_summary"] : ["request_mammogram", "request_imaging", "download_clinician_summary"],
    }))
  }

  if ((sexAtBirth === "female" || sexAtBirth === "intersex") && cervixPresent && !hasCervicalSurveillanceRisk && age >= 21 && age <= 65) {
    addUnique(recommendations, recommendation({
      id: "uspstf-average-risk-cervical",
      cancerType: "cervical cancer",
      screeningName: "Cervical cancer screening",
      status: "due",
      riskCategory: "average_risk",
      rationale: "USPSTF recommends cervical cancer screening for average-risk people with a cervix ages 21 to 65 using age-appropriate Pap/HPV strategies.",
      recommendedNextStep: "Request cervical screening navigation or confirm your latest Pap/HPV date with your clinician.",
      suggestedTiming: age < 30 ? "Pap every 3 years when average-risk" : "Pap/HPV interval depends on test type",
      sourceId: "uspstf-cervical-2018",
      evidenceGrade: "A",
      requiresClinicianReview: false,
      patientFriendlyExplanation: "If you have a cervix and no special high-risk history, cervical screening may be recommended in this age range.",
      clinicianSummary: "Average-risk USPSTF cervical screening logic applied; verify cervix status and prior Pap/HPV result before scheduling.",
      nextSteps: ["request_cervical_screening", "request_referral", "download_clinician_summary"],
    }))
  }

  const lungEligibleSmoking =
    typeof intake.smoking.packYears === "number" &&
    intake.smoking.packYears >= 20 &&
    (intake.smoking.currentSmoker || (typeof intake.smoking.quitYearsAgo === "number" && intake.smoking.quitYearsAgo <= 15))

  if (age >= 50 && age <= 80) {
    if (lungEligibleSmoking) {
      addUnique(recommendations, recommendation({
        id: "uspstf-lung-ldct",
        cancerType: "lung cancer",
        screeningName: "Low-dose CT lung cancer screening",
        status: "due",
        riskCategory: "increased_risk",
        rationale: "USPSTF recommends annual LDCT for adults ages 50 to 80 with at least 20 pack-years who currently smoke or quit within 15 years.",
        recommendedNextStep: "Request LDCT navigation and smoking-cessation support if relevant.",
        suggestedTiming: "Annual when eligible",
        sourceId: "uspstf-lung-2021",
        evidenceGrade: "B",
        requiresClinicianReview: false,
        patientFriendlyExplanation: "Based on age and smoking history, LDCT screening may be appropriate if you are healthy enough for evaluation and treatment if needed.",
        clinicianSummary: "USPSTF lung screening criteria met from supplied age/pack-year/current-or-recent smoking history.",
        nextSteps: ["request_ldct", "request_imaging", "request_care_navigation", "download_clinician_summary"],
      }))
    } else if (intake.smoking.currentSmoker || intake.smoking.formerSmoker) {
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
  addPersonalCancerHistoryRecommendations(recommendations, intake)
  addHereditaryRiskRecommendations(recommendations, intake)
  addFamilyHistoryOverrides(recommendations, intake)
  addAverageRiskCancerScreening(recommendations, intake)

  const sourceIds = Array.from(new Set(recommendations.map((item) => item.sourceId).filter((item): item is string => Boolean(item))))
  const intakeCompleteness: ScreeningEngineResult["intakeCompleteness"] =
    hasActionableDemographics && (inputHasPriorHistory(intake) || highRiskSignals || redFlags.length > 0)
      ? "actionable"
      : hasActionableDemographics || highRiskSignals || redFlags.length > 0
      ? "partial"
      : "minimal"

  return {
    generatedAt: new Date().toISOString(),
    intakeCompleteness,
    recommendations: recommendations.sort(compareRecommendations),
    safetyMessages: [
      "OpenRx provides guideline-based education and care navigation support; it does not replace clinician judgment.",
      "Symptoms, personal cancer history, hereditary risk, or prior abnormal results should be reviewed with a clinician before routine screening intervals are used.",
    ],
    sourceIds,
  }
}

function inputHasPriorHistory(intake: ScreeningIntake): boolean {
  return intake.priorScreening.length > 0 || Boolean(intake.personalHistory.cancers?.length)
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
