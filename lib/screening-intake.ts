import type { ScreeningReportedHistory } from "./screening/types"

export interface ScreeningIntakeResult {
  ready: boolean
  clarificationQuestion?: string
  extracted: {
    age?: number
    gender?: string
    sexAtBirth?: string
    bmi?: number
    smoker?: boolean
    smokingPackYears?: number
    quitYearsAgo?: number
    symptoms: string[]
    redFlags: string[]
    familyHistory: string[]
    conditions: string[]
    genes: string[]
    knownMutationOrSyndrome: string[]
    priorAbnormalFindings: string[]
    reportedHistory: ScreeningReportedHistory
    location?: string
  }
}

const GENE_MARKERS = [
  "brca",
  "brca1",
  "brca2",
  "palb2",
  "atm",
  "chek2",
  "hoxb13",
  "lynch",
  "mlh1",
  "msh2",
  "msh6",
  "pms2",
  "apc",
  "mutyh",
  "epcam",
]

const FAMILY_CUES = [
  "family history",
  "mother",
  "father",
  "mom",
  "dad",
  "brother",
  "sister",
  "sibling",
  "parent",
  "uncle",
  "aunt",
  "grandmother",
  "grandfather",
  "cousin",
]

const CONDITION_KEYWORDS = [
  "diabetes",
  "hypertension",
  "hyperlipidemia",
  "kidney disease",
  "copd",
  "asthma",
  "heart disease",
  "stroke",
]

const SCREENING_RISK_HISTORY_KEYWORDS = [
  "inflammatory bowel disease",
  "ulcerative colitis",
  "crohn disease",
  "crohn's disease",
  "colon polyp",
  "colon polyps",
  "advanced adenoma",
  "chest radiation",
  "immunosuppression",
]

const SCREENING_HISTORY_KEYWORDS = [
  "colonoscopy",
  "fit",
  "stool test",
  "cologuard",
  "mammogram",
  "mammography",
  "pap",
  "hpv",
  "ldct",
  "low-dose ct",
  "chest ct",
  "ct chest",
  "ct colonography",
  "virtual colonoscopy",
  "psa",
]

const SYMPTOM_KEYWORDS = [
  "fatigue",
  "chest pain",
  "chest discomfort",
  "chest tightness",
  "chest pressure",
  "dizziness",
  "shortness of breath",
  "difficulty breathing",
  "trouble breathing",
  "fainting",
  "syncope",
  "passed out",
  "weight loss",
  "palpitations",
  "headache",
  "severe headache",
  "abdominal pain",
  "nausea",
  "vomiting",
  "blurred vision",
  "numbness",
  "tingling",
  "swelling",
  "fever",
  "night sweats",
  "blood in stool",
  "rectal bleeding",
  "bloody stool",
  "blood in urine",
  "coughing blood",
  "hemoptysis",
  "breast lump",
  "breast mass",
  "abnormal uterine bleeding",
  "postmenopausal bleeding",
  "joint pain",
  "muscle weakness",
  "confusion",
  "memory loss",
  "insomnia",
  "anxiety",
  "depression",
]

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term))
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(text)
}

function nearestMatch(
  text: string,
  keywordIndex: number,
  pattern: RegExp
): RegExpMatchArray | undefined {
  return Array.from(text.matchAll(pattern))
    .sort((left, right) => {
      const leftDistance = Math.abs((left.index || 0) - keywordIndex)
      const rightDistance = Math.abs((right.index || 0) - keywordIndex)
      return leftDistance - rightDistance
    })[0]
}

function screeningMentionContext(lowered: string, keyword: string) {
  const keywordIndex = lowered.indexOf(keyword)
  if (keywordIndex < 0) return null
  const clauseStart = Math.max(
    lowered.lastIndexOf(".", keywordIndex),
    lowered.lastIndexOf("!", keywordIndex),
    lowered.lastIndexOf("?", keywordIndex),
    lowered.lastIndexOf("\n", keywordIndex),
    lowered.lastIndexOf(",", keywordIndex),
    lowered.lastIndexOf(";", keywordIndex)
  ) + 1
  const clauseEnds = [".", "!", "?", "\n", ",", ";"]
    .map((separator) => lowered.indexOf(separator, keywordIndex + keyword.length))
    .filter((index) => index >= 0)
  const clauseEnd = clauseEnds.length > 0 ? Math.min(...clauseEnds) : lowered.length
  const clause = lowered.slice(clauseStart, clauseEnd).trim()
  const localKeywordIndex = Math.max(0, clause.indexOf(keyword))
  return { clause, localKeywordIndex }
}

function extractFamilyHistory(lowered: string): string[] {
  const hasFamilyContext = includesAny(lowered, FAMILY_CUES) || lowered.includes("hereditary")
  if (!hasFamilyContext) return []

  const findings: string[] = []

  if (includesAny(lowered, ["prostate cancer", "prostate ca"])) {
    findings.push("family history of prostate cancer")
  }

  if (includesAny(lowered, ["colorectal cancer", "colon cancer", "rectal cancer"])) {
    findings.push("family history of colorectal cancer")
  }

  if (includesAny(lowered, ["breast cancer", "ovarian cancer"])) {
    findings.push("family history of breast/ovarian cancer")
  }

  if (includesAny(lowered, ["lymphoma", "leukemia", "blood cancer", "hematologic cancer"])) {
    findings.push("family history of lymphoma or hematologic cancer")
  }

  if (includesAny(lowered, ["polyposis", "familial adenomatous polyposis", "fap", "mutyh-associated polyposis"])) {
    findings.push("family history of polyposis syndrome")
  }

  if (lowered.includes("lynch")) {
    findings.push("family history of lynch syndrome")
  }

  const ageSpecificMatches = Array.from(
    lowered.matchAll(
      /\b(mother|father|mom|dad|brother|sister|sibling|parent|uncle|aunt|grandmother|grandfather)\b[^.!?\n]{0,60}\b(prostate|colon|colorectal|breast|ovarian)\b[^.!?\n]{0,20}\b(?:age|at)\s*(\d{2})\b/g
    )
  )
  ageSpecificMatches.forEach((entry) => {
    const relation = entry[1]
    const site = entry[2]
    const age = entry[3]
    findings.push(`${relation} had ${site} cancer at age ${age}`)
  })

  return unique(findings)
}

export function parseScreeningIntakeNarrative(input: string): ScreeningIntakeResult {
  const narrative = input.trim()
  const lowered = narrative.toLowerCase()

  const ageMatch =
    lowered.match(/\b(\d{1,3})[-\s]*(?:years?[-\s]*old|year[-\s]*old)\b/) ||
    lowered.match(/(?<!\bat\s)\bage\s*(?:is|=|:)?\s*(\d{1,3})\b/) ||
    lowered.match(/\b(\d{1,3})\s*(?:years?\s*old|yo|y\/o)\b/) ||
    lowered.match(/\bi am\s+(\d{1,3})\b/) ||
    lowered.match(/\b(\d{2})\s*(?:m|male|man|f|female|woman)\b/) ||
    lowered.match(
      /(?:^|\n)\s*(\d{1,3})(?=\s+(?:hx\b|history\b|male\b|female\b|man\b|woman\b|m\b|f\b|father\b|mother\b|parent\b|family\b|smok\w*\b|brca\w*\b|lynch\b|mutation\b|cancer\b|lymphoma\b|with\b)|\s*$)/
    )
  const age = ageMatch ? Number.parseInt(ageMatch[1], 10) : undefined

  let gender: string | undefined
  if (/\b\d{2}\s*f\b|\bfemale\b|\bwoman\b|\blady\b/.test(lowered)) gender = "female"
  else if (/\b\d{2}\s*m\b|\bmale\b|\bman\b|\bgentleman\b/.test(lowered)) gender = "male"

  const bmiMatch = lowered.match(/\bbmi\s*(?:is|=|:)?\s*(\d{1,2}(?:\.\d+)?)\b/)
  const bmi = bmiMatch ? Number.parseFloat(bmiMatch[1]) : undefined

  const formerSmoking = /\bformer smoker\b|\bquit smoking\b|\bquit\s+\d{1,2}\s+years?\s+ago\b|\bused to smoke\b|\bex-smoker\b/.test(lowered)
  const currentSmoking =
    /\bcurrent smoker\b|\bsmoking now\b|\bsmokes\b|\bi smoke\b/.test(lowered) ||
    (/\bsmoker\b|\bsmoking\b|\bsmoke\b/.test(lowered) && !formerSmoking)
  const smoker = currentSmoking ? true : formerSmoking ? false : undefined

  const symptoms = unique(
    SYMPTOM_KEYWORDS.filter((keyword) => lowered.includes(keyword))
  )
  const familyHistory = extractFamilyHistory(lowered)

  const smokingContext: string[] = []
  const packYearMatch = lowered.match(/\b(\d{1,3})\s*pack[-\s]?years?\b/)
  if (packYearMatch) smokingContext.push(`${packYearMatch[1]} pack-years`)
  const quitMatch = lowered.match(/\bquit(?:\s+smoking)?\s*(\d{1,2})\s*years?\s*ago\b/)
  if (quitMatch) smokingContext.push(`quit smoking ${quitMatch[1]} years ago`)
  if (formerSmoking) smokingContext.push("former smoker")
  if (currentSmoking) smokingContext.push("current smoker")

  const conditions = unique([
    ...CONDITION_KEYWORDS.filter((keyword) => lowered.includes(keyword)),
    ...SCREENING_RISK_HISTORY_KEYWORDS.filter((keyword) => lowered.includes(keyword)),
    ...smokingContext,
  ])

  const noPersonalOrFamilyCancerSignal =
    /\b(?:no|without|denies?)\s+personal\s+(?:or|and)\s+family\s+(?:history|hx)\s+of\s+(?:any\s+)?cancer\b/.test(lowered)
  const noPersonalCancerSignal =
    noPersonalOrFamilyCancerSignal ||
    /\b(?:no|without|denies?)\s+(?:personal\s+)?(?:history|hx)\s+of\s+(?:any\s+)?cancer\b|\bnever (?:had|diagnosed with) cancer\b/.test(lowered)

  // "family history of breast cancer" must never read as a personal history.
  const personalCancerMatch = lowered.match(
    /\b(?:personal history of|(?<!family\s)history of|survivor of|treated for|diagnosed with|i had|i have had)\s+([^.!?\n]{0,42}?(?:cancer|carcinoma|melanoma))\b/
  )
  const compactPersonalCancerMatch = lowered.match(
    /\bhx(?:\s+of)?\s+(cancer)\b(?![^.!?\n]{0,25}\b(?:in|of)\s+(?:my\s+)?(?:mother|father|mom|dad|brother|sister|sibling|parent|uncle|aunt|grandmother|grandfather))/
  )
  const personalCancerValue = noPersonalCancerSignal
    ? undefined
    : personalCancerMatch?.[1] || compactPersonalCancerMatch?.[1]
  if (personalCancerValue) {
    conditions.push(`personal history of ${personalCancerValue.trim()}`)
  }

  SCREENING_HISTORY_KEYWORDS.forEach((keyword) => {
    const found = keyword.length <= 3 ? hasWord(lowered, keyword) : lowered.includes(keyword)
    if (!found) return
    const mention = screeningMentionContext(lowered, keyword)
    const localContext = mention?.clause || keyword
    const localKeywordIndex = mention?.localKeywordIndex || 0
    if (
      /\b(?:never had|no prior|not had|have not had|haven't had)\b[^.!?\n]{0,45}$/.test(
        localContext.slice(0, Math.max(0, localContext.indexOf(keyword)))
      )
    ) {
      return
    }
    const nearbyYear = nearestMatch(localContext, localKeywordIndex, /\b(20\d{2}|19\d{2})\b/g)?.[1]
    const nearestResult = nearestMatch(
      localContext,
      localKeywordIndex,
      /\b(abnormal|positive|polyps?|adenomas?|mass|nodules?|cin[123]|normal|negative|clear|no polyps?)\b/g
    )?.[1]
    const result = nearestResult && /^(abnormal|positive|polyps?|adenomas?|mass|nodules?|cin[123])$/.test(nearestResult)
      ? "abnormal"
      : nearestResult
        ? "normal"
        : ""
    conditions.push(
      `${result ? `${result} ` : ""}${keyword}${nearbyYear ? ` ${nearbyYear}` : ""}${result === "abnormal" && localContext !== keyword ? `: ${localContext.trim()}` : ""}`.trim()
    )
  })

  if (lowered.includes("germline")) {
    conditions.push("germline mutation reported")
  }
  if (includesAny(lowered, ["hereditary cancer", "inherited cancer"])) {
    conditions.push("hereditary cancer syndrome concern")
  }

  const genes = unique(
    GENE_MARKERS.filter((marker) => hasWord(lowered, marker))
      .map((marker) => marker.toUpperCase())
  )
  if (genes.length > 0) {
    conditions.push(...genes.map((gene) => `${gene} mutation carrier`))
  }

  const redFlags = unique(symptoms.filter((symptom) =>
    includesAny(symptom, [
      "chest pain",
      "chest pressure",
      "shortness of breath",
      "fainting",
      "syncope",
      "blood in stool",
      "rectal bleeding",
      "bloody stool",
      "coughing blood",
      "hemoptysis",
      "breast lump",
      "breast mass",
      "abnormal uterine bleeding",
      "postmenopausal bleeding",
      "confusion",
      "muscle weakness",
    ])
  ))
  const priorAbnormalFindings = unique(
    conditions.filter((condition) => /\babnormal\b|\bpolyps?\b|\badenomas?\b|\bcin[23]\b/i.test(condition))
  )
  const noPersonalCancer = noPersonalCancerSignal
  const noFamilyCancer =
    noPersonalOrFamilyCancerSignal ||
    /\b(?:no|without|denies?)\s+family\s+(?:history|hx)\s+of\s+(?:any\s+)?cancer\b/.test(lowered)
  const noColorectalScreening =
    /\b(?:never had|no prior|not had|have not had|haven't had)\b[^.!?\n]{0,35}\b(colonoscopy|fit|stool test|cologuard|colorectal screening|ct colonography|virtual colonoscopy)\b/.test(lowered)
  const hasColorectalScreening =
    !noColorectalScreening &&
    /\b(colonoscopy|fit|stool test|cologuard|colorectal screening|ct colonography|virtual colonoscopy)\b/.test(lowered)
  const noLungScreeningCt =
    /\b(?:never had|no prior|not had|have not had|haven't had)\b[^.!?\n]{0,35}\b(ldct|low-dose ct|lung ct|chest ct|ct chest)\b/.test(lowered)
  const hasLungScreeningCt =
    !noLungScreeningCt && /\b(ldct|low-dose ct|lung ct|chest ct|ct chest)\b/.test(lowered)
  const noBreastScreening =
    /\b(?:never had|no prior|not had|have not had|haven't had)\b[^.!?\n]{0,35}\b(mammogram|mammography)\b/.test(lowered)
  const hasBreastScreening =
    !noBreastScreening && /\b(mammogram|mammography)\b/.test(lowered)
  const noCervicalScreening =
    /\b(?:never had|no prior|not had|have not had|haven't had)\b[^.!?\n]{0,35}\b(pap|pap smear|hpv test|cervical screening)\b/.test(lowered)
  const hasCervicalScreening =
    !noCervicalScreening && /\b(pap|pap smear|hpv test|cervical screening)\b/.test(lowered)
  const cervixAbsent =
    /\b(?:no cervix|without a cervix|cervix (?:was )?removed|total hysterectomy|hysterectomy with cervix removed)\b/.test(lowered)
  const cervixPresent =
    !cervixAbsent && /\b(?:cervix present|with a cervix|have (?:a|my) cervix|still have (?:a|my) cervix|cervix intact|supracervical hysterectomy)\b/.test(lowered)
  if (/\bhysterectomy\b/.test(lowered)) conditions.push("hysterectomy")
  if (cervixAbsent) conditions.push("cervix absent")
  if (cervixPresent) conditions.push("cervix present")
  const neverSmoked = /\b(?:never smoked|never smoker|non[- ]smoker|do not smoke|don't smoke)\b/.test(lowered)
  const reportedHistory: ScreeningReportedHistory = {
    personalCancer: noPersonalCancer ? "no" : personalCancerValue ? "yes" : undefined,
    familyCancer: noFamilyCancer ? "no" : familyHistory.length > 0 ? "yes" : undefined,
    colorectalScreening: noColorectalScreening ? "no" : hasColorectalScreening ? "yes" : undefined,
    breastScreening: noBreastScreening ? "no" : hasBreastScreening ? "yes" : undefined,
    cervicalScreening: noCervicalScreening ? "no" : hasCervicalScreening ? "yes" : undefined,
    lungScreeningCt: noLungScreeningCt ? "no" : hasLungScreeningCt ? "yes" : undefined,
    cervixPresent: cervixAbsent ? "no" : cervixPresent ? "yes" : undefined,
    smoking: neverSmoked ? "no" : smoker !== undefined || packYearMatch ? "yes" : undefined,
  }
  const locationMatch = narrative.match(/\b\d{5}(?:-\d{4})?\b|\b(?:near|in)\s+([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})\b/)
  const location = locationMatch?.[0]?.replace(/^(near|in)\s+/i, "").trim()

  const extracted = {
    age,
    gender,
    sexAtBirth: gender,
    bmi,
    smoker,
    smokingPackYears: packYearMatch ? Number.parseInt(packYearMatch[1], 10) : undefined,
    quitYearsAgo: quitMatch ? Number.parseInt(quitMatch[1], 10) : undefined,
    symptoms,
    redFlags,
    familyHistory,
    conditions: unique(conditions),
    genes,
    knownMutationOrSyndrome: genes,
    priorAbnormalFindings,
    reportedHistory,
    location,
  }

  const hasRiskSignals =
    extracted.conditions.length > 0 || extracted.familyHistory.length > 0 || extracted.genes.length > 0
  const hasUsefulSignals =
    typeof extracted.age === "number" ||
    typeof extracted.bmi === "number" ||
    extracted.symptoms.length > 0 ||
    hasRiskSignals

  if (hasUsefulSignals) {
    return { ready: true, extracted }
  }

  return {
    ready: false,
    clarificationQuestion:
      "Share one line with your age and any known family/genetic risk (for example family prostate/colorectal cancer, BRCA2, Lynch, APC, MUTYH).",
    extracted,
  }
}

export function summarizeScreeningIntake(extracted: ScreeningIntakeResult["extracted"]): string {
  const details: string[] = []
  if (typeof extracted.age === "number") details.push(`Age ${extracted.age}`)
  if (extracted.sexAtBirth) details.push(`sex for screening: ${extracted.sexAtBirth}`)
  if (extracted.familyHistory.length) details.push(extracted.familyHistory.slice(0, 2).join("; "))
  if (typeof extracted.smokingPackYears === "number") details.push(`${extracted.smokingPackYears} pack-years`)
  if (extracted.knownMutationOrSyndrome.length) details.push(`${extracted.knownMutationOrSyndrome.join(", ")} reported`)
  if (extracted.priorAbnormalFindings.length) details.push("prior abnormal finding reported")
  if (extracted.redFlags.length) details.push("symptom warning reported")
  if (extracted.location) details.push(`location ${extracted.location}`)
  return details.length ? details.join(" · ") : "Limited context supplied; confirm details with a clinician."
}
