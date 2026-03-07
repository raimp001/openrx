export interface ScreeningIntakeResult {
  ready: boolean
  clarificationQuestion?: string
  extracted: {
    age?: number
    gender?: string
    bmi?: number
    smoker?: boolean
    symptoms: string[]
    familyHistory: string[]
    conditions: string[]
    genes: string[]
  }
}

const GENE_MARKERS = [
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
  "cancer",
]

const SYMPTOM_KEYWORDS = [
  "fatigue",
  "chest pain",
  "chest discomfort",
  "dizziness",
  "shortness of breath",
  "fainting",
  "weight loss",
  "palpitations",
  "headache",
  "abdominal pain",
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

  if (includesAny(lowered, ["polyposis", "familial adenomatous polyposis", "fap", "mutyh-associated polyposis"])) {
    findings.push("family history of polyposis syndrome")
  }

  if (lowered.includes("lynch")) {
    findings.push("family history of lynch syndrome")
  }

  const ageSpecificMatches = Array.from(
    lowered.matchAll(
      /\b(mother|father|brother|sister|sibling|parent|uncle|aunt|grandmother|grandfather)\b[^.!?\n]{0,60}\b(prostate|colon|colorectal|breast|ovarian)\b[^.!?\n]{0,20}\b(?:age|at)\s*(\d{2})\b/g
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
    lowered.match(/\b(\d{1,3})\s*(?:years?\s*old|yo|y\/o)\b/) ||
    lowered.match(/\bi am\s+(\d{1,3})\b/)
  const age = ageMatch ? Number.parseInt(ageMatch[1], 10) : undefined

  let gender: string | undefined
  if (/\bmale\b|\bman\b|\bgentleman\b/.test(lowered)) gender = "male"
  if (/\bfemale\b|\bwoman\b|\blady\b/.test(lowered)) gender = "female"

  const bmiMatch = lowered.match(/\bbmi\s*(?:is|=|:)?\s*(\d{1,2}(?:\.\d+)?)\b/)
  const bmi = bmiMatch ? Number.parseFloat(bmiMatch[1]) : undefined

  const smoker = /\bsmoker\b|\bsmoking\b|\bsmokes\b/.test(lowered)

  const symptoms = unique(
    SYMPTOM_KEYWORDS.filter((keyword) => lowered.includes(keyword))
  )
  const familyHistory = extractFamilyHistory(lowered)

  const conditions = unique(CONDITION_KEYWORDS.filter((keyword) => lowered.includes(keyword)))

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

  const extracted = {
    age,
    gender,
    bmi,
    smoker,
    symptoms,
    familyHistory,
    conditions: unique(conditions),
    genes,
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
