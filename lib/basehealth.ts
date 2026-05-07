import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import {
  recommendScreenings,
  screeningIntakeFromLegacy,
  type LegacyScreeningInput,
} from "@/lib/screening/recommend"
import type { ScreeningRecommendation as StructuredScreeningRecommendation } from "@/lib/screening/types"

interface BasePatientProfile {
  id: string
  date_of_birth: string
  medical_history: { condition: string; diagnosed: string; status: string }[]
}

export type RiskTier = "low" | "moderate" | "high"
export type RiskImpact = "protective" | "monitor" | "elevated" | "urgent"

export interface ScreeningInput {
  patientId?: string
  patient?: BasePatientProfile
  age?: number
  gender?: string
  bmi?: number
  smoker?: boolean
  familyHistory?: string[]
  symptoms?: string[]
  conditions?: string[]
  vitals?: Array<{
    systolic?: number
    diastolic?: number
  }>
  labs?: Array<{
    test_name: string
    results: Array<{ value: string }>
    status?: string
  }>
  vaccinations?: Array<{
    vaccine_name: string
    status: string
  }>
}

export interface ScreeningFactor {
  label: string
  impact: RiskImpact
  scoreDelta: number
  evidence: string
}

export interface ScreeningRecommendation {
  id: string
  name: string
  priority: "low" | "medium" | "high"
  ownerAgent: "screening" | "wellness" | "scheduling" | "trials"
  reason: string
}

export interface ScreeningAssessment {
  patientId: string
  generatedAt: string
  overallRiskScore: number
  riskTier: RiskTier
  factors: ScreeningFactor[]
  recommendedScreenings: ScreeningRecommendation[]
  nextActions: string[]
  structuredRecommendations?: StructuredScreeningRecommendation[]
  screeningIntakeCompleteness?: "minimal" | "partial" | "actionable"
  safetyMessages?: string[]
}

export interface SecondOpinionInput {
  patientId?: string
  patient?: BasePatientProfile
  diagnosis: string
  currentPlan: string
  symptoms?: string[]
  medications?: string[]
}

export interface SecondOpinionResult {
  generatedAt: string
  diagnosis: string
  agreement: "supports-current-plan" | "partial-agreement" | "needs-clinician-review"
  confidence: "low" | "moderate" | "high"
  summary: string
  keyQuestions: string[]
  alternativeConsiderations: string[]
  redFlags: string[]
  specialistSuggestions: string[]
}

export interface TrialMatchInput {
  patientId?: string
  patient?: BasePatientProfile
  condition?: string
  location?: string
}

export interface TrialMatch {
  id: string
  title: string
  phase: string
  status: string
  sponsor: string
  location: string
  remoteEligible: boolean
  condition: string
  matchScore: number
  fit: "strong" | "possible"
  reasons: string[]
  url: string
  summary: string
}

interface CtGovLocation {
  facility?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

interface CtGovStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string
      briefTitle?: string
    }
    statusModule?: {
      overallStatus?: string
    }
    sponsorCollaboratorsModule?: {
      leadSponsor?: {
        name?: string
      }
    }
    conditionsModule?: {
      conditions?: string[]
    }
    descriptionModule?: {
      briefSummary?: string
    }
    designModule?: {
      phases?: string[]
    }
    contactsLocationsModule?: {
      locations?: CtGovLocation[]
    }
    eligibilityModule?: {
      minimumAge?: string
      maximumAge?: string
    }
  }
}

interface CtGovResponse {
  studies?: CtGovStudy[]
}

const US_STATE_ALIASES: Record<string, string> = {
  al: "alabama",
  alaska: "alaska",
  ak: "alaska",
  arizona: "arizona",
  az: "arizona",
  arkansas: "arkansas",
  ar: "arkansas",
  california: "california",
  ca: "california",
  colorado: "colorado",
  co: "colorado",
  connecticut: "connecticut",
  ct: "connecticut",
  delaware: "delaware",
  de: "delaware",
  florida: "florida",
  fl: "florida",
  georgia: "georgia",
  ga: "georgia",
  hawaii: "hawaii",
  hi: "hawaii",
  idaho: "idaho",
  id: "idaho",
  illinois: "illinois",
  il: "illinois",
  indiana: "indiana",
  in: "indiana",
  iowa: "iowa",
  ia: "iowa",
  kansas: "kansas",
  ks: "kansas",
  kentucky: "kentucky",
  ky: "kentucky",
  louisiana: "louisiana",
  la: "louisiana",
  maine: "maine",
  me: "maine",
  maryland: "maryland",
  md: "maryland",
  massachusetts: "massachusetts",
  ma: "massachusetts",
  michigan: "michigan",
  mi: "michigan",
  minnesota: "minnesota",
  mn: "minnesota",
  mississippi: "mississippi",
  ms: "mississippi",
  missouri: "missouri",
  mo: "missouri",
  montana: "montana",
  mt: "montana",
  nebraska: "nebraska",
  ne: "nebraska",
  nevada: "nevada",
  nv: "nevada",
  "new hampshire": "new hampshire",
  nh: "new hampshire",
  "new jersey": "new jersey",
  nj: "new jersey",
  "new mexico": "new mexico",
  nm: "new mexico",
  "new york": "new york",
  ny: "new york",
  "north carolina": "north carolina",
  nc: "north carolina",
  "north dakota": "north dakota",
  nd: "north dakota",
  ohio: "ohio",
  oh: "ohio",
  oklahoma: "oklahoma",
  ok: "oklahoma",
  oregon: "oregon",
  or: "oregon",
  pennsylvania: "pennsylvania",
  pa: "pennsylvania",
  "rhode island": "rhode island",
  ri: "rhode island",
  "south carolina": "south carolina",
  sc: "south carolina",
  "south dakota": "south dakota",
  sd: "south dakota",
  tennessee: "tennessee",
  tn: "tennessee",
  texas: "texas",
  tx: "texas",
  utah: "utah",
  ut: "utah",
  vermont: "vermont",
  vt: "vermont",
  virginia: "virginia",
  va: "virginia",
  washington: "washington",
  wa: "washington",
  "west virginia": "west virginia",
  wv: "west virginia",
  wisconsin: "wisconsin",
  wi: "wisconsin",
  wyoming: "wyoming",
  wy: "wyoming",
  "district of columbia": "district of columbia",
  dc: "district of columbia",
}

interface ParsedTrialLocationQuery {
  raw: string
  normalized: string
  city?: string
  state?: string
  zip?: string
  stateOnly: boolean
  wantsRemote: boolean
}

interface TrialLocationMatch {
  entry: CtGovLocation | null
  score: number
}

const DEFAULT_PATIENT: BasePatientProfile = {
  id: "unknown-patient",
  date_of_birth: "1980-01-01",
  medical_history: [],
}

function resolvePatient(inputPatient?: BasePatientProfile): BasePatientProfile {
  return inputPatient || DEFAULT_PATIENT
}

function calcAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--
  }
  return age
}

function priorityWeight(priority: ScreeningRecommendation["priority"]): number {
  if (priority === "high") return 3
  if (priority === "medium") return 2
  return 1
}

function parseLabValue(value: string): number | null {
  const numeric = Number.parseFloat(value)
  if (Number.isNaN(numeric)) return null
  return numeric
}

function normalizeGender(value?: string): "female" | "male" | "unknown" {
  const normalized = (value || "").toLowerCase()
  if (/\bfemale\b|\bwoman\b|\bwomen\b|\blady\b/.test(normalized)) return "female"
  if (/\bmale\b|\bman\b|\bmen\b|\bgentleman\b/.test(normalized)) return "male"
  return "unknown"
}

function structuredPriority(rec: StructuredScreeningRecommendation): ScreeningRecommendation["priority"] {
  if (
    rec.status === "urgent_clinician_review" ||
    rec.status === "high_risk" ||
    rec.status === "surveillance_or_follow_up" ||
    rec.status === "needs_clinician_review"
  ) {
    return "high"
  }
  if (rec.status === "due" || rec.status === "discuss") return "medium"
  return "low"
}

function structuredOwner(rec: StructuredScreeningRecommendation): ScreeningRecommendation["ownerAgent"] {
  if (rec.nextSteps.some((step) => step.includes("genetic") || step.includes("specialist"))) return "screening"
  if (rec.nextSteps.some((step) => step.includes("colonoscopy") || step.includes("mammogram") || step.includes("ldct") || step.includes("referral"))) return "scheduling"
  return "screening"
}

function toLegacyScreeningRecommendation(rec: StructuredScreeningRecommendation): ScreeningRecommendation {
  return {
    id: `engine-${rec.id}`,
    name: rec.screeningName,
    priority: structuredPriority(rec),
    ownerAgent: structuredOwner(rec),
    reason: rec.patientFriendlyExplanation,
  }
}

function buildScreeningEngineInput(input: ScreeningInput, patient: BasePatientProfile, age: number): LegacyScreeningInput {
  return {
    patientId: input.patientId || patient.id,
    age,
    gender: input.gender,
    smoker: input.smoker,
    familyHistory: input.familyHistory,
    symptoms: input.symptoms,
    conditions: [
      ...(input.conditions || []),
      ...patient.medical_history.map((item) => item.condition),
    ],
  }
}

export function assessHealthScreening(input: ScreeningInput = {}): ScreeningAssessment {
  const patient = resolvePatient(input.patient)
  const age = input.age ?? calcAge(patient.date_of_birth)
  const gender = normalizeGender(input.gender)
  const isFemale = gender === "female"
  const isMale = gender === "male"
  const vitals = input.vitals || []
  const labs = input.labs || []
  const vaccines = input.vaccinations || []

  const latestVital = vitals[0]
  const conditionSet = new Set(
    [...patient.medical_history.map((item) => item.condition), ...(input.conditions || [])].map((item) =>
      item.toLowerCase()
    )
  )
  const symptoms = (input.symptoms || []).map((item) => item.toLowerCase())
  const familyHistory = (input.familyHistory || []).map((item) => item.toLowerCase())
  const riskText = [...Array.from(conditionSet), ...symptoms, ...familyHistory].join(" ")
  const inheritedRiskSignal =
    /\b(brca|lynch|germline|mutation|pathogenic variant|carrier|apc|mutyh|palb2|atm|chek2|hoxb13)\b/.test(
      riskText
    )

  const factors: ScreeningFactor[] = []
  let score = 10

  function addFactor(label: string, scoreDelta: number, impact: RiskImpact, evidence: string) {
    score += scoreDelta
    factors.push({ label, scoreDelta, impact, evidence })
  }

  if (age >= 65) addFactor("Age 65+", 18, "elevated", "Higher baseline chronic disease risk.")
  else if (age >= 50) addFactor("Age 50-64", 11, "monitor", "Preventive screening intensity should increase.")
  else if (age >= 35) addFactor("Age 35-49", 5, "monitor", "Moderate preventive monitoring window.")

  if (Array.from(conditionSet).some((item) => item.includes("diabetes"))) {
    addFactor("Type 2 diabetes history", 22, "elevated", "Existing cardiometabolic risk driver.")
  }
  if (Array.from(conditionSet).some((item) => item.includes("hypertension"))) {
    addFactor("Hypertension history", 13, "elevated", "Blood pressure control affects stroke and kidney risk.")
  }
  if (Array.from(conditionSet).some((item) => item.includes("hyperlipidemia"))) {
    addFactor("Hyperlipidemia history", 10, "monitor", "LDL control remains a long-term target.")
  }

  if (input.smoker) {
    addFactor("Smoking exposure", 12, "elevated", "Smoking increases cardiopulmonary risk.")
  }

  if (latestVital?.systolic && latestVital?.diastolic) {
    if (latestVital.systolic >= 140 || latestVital.diastolic >= 90) {
      addFactor("Recent elevated blood pressure", 12, "elevated", "Latest reading above preferred target.")
    } else if (latestVital.systolic >= 130 || latestVital.diastolic >= 80) {
      addFactor("Borderline blood pressure", 6, "monitor", "Close monitoring recommended.")
    }
  }

  const a1cResult = labs.find((lab) => lab.test_name.toLowerCase().includes("a1c"))
  const a1cValue = a1cResult ? parseLabValue(a1cResult.results[0]?.value || "") : null
  if (a1cValue !== null) {
    if (a1cValue >= 7) addFactor("A1C >= 7.0", 12, "elevated", "Glycemic control is above most targets.")
    else if (a1cValue >= 6.5) addFactor("A1C 6.5-6.9", 8, "monitor", "Risk remains elevated despite improvement.")
    else addFactor("A1C under 6.5", -4, "protective", "Current glycemic control is favorable.")
  }

  if (typeof input.bmi === "number") {
    if (input.bmi >= 35) addFactor("BMI >= 35", 14, "elevated", "Higher metabolic risk burden.")
    else if (input.bmi >= 30) addFactor("BMI 30-34.9", 8, "monitor", "Weight management remains an active lever.")
    else if (input.bmi < 25) addFactor("BMI under 25", -3, "protective", "Healthy weight range lowers baseline risk.")
  }

  const urgentSymptoms = [
    "chest pain", "chest discomfort", "chest tightness", "chest pressure",
    "shortness of breath", "difficulty breathing", "can't breathe", "trouble breathing",
    "fainting", "syncope", "passed out", "blacked out", "lost consciousness",
    "vision loss", "sudden blindness", "blurred vision",
    "stroke", "facial drooping", "slurred speech", "sudden numbness",
    "severe headache", "worst headache",
    "coughing blood", "vomiting blood", "blood in stool",
    "suicidal", "self-harm", "want to die",
    "seizure", "convulsion",
    "anaphylaxis", "throat closing", "severe allergic",
  ]
  if (symptoms.some((symptom) => urgentSymptoms.some((urgent) => symptom.includes(urgent)))) {
    addFactor("Urgent symptom pattern", 22, "urgent", "Immediate triage escalation recommended.")
  }

  if (familyHistory.length > 0) {
    const familyScore = Math.min(12, familyHistory.length * 3)
    addFactor(
      "Family history signals",
      familyScore,
      "monitor",
      `Reported ${familyHistory.length} family history risk factor(s).`
    )
  }

  if (inheritedRiskSignal) {
    addFactor(
      "Inherited-risk signal reported",
      12,
      "elevated",
      "Known or suspected germline risk can change cancer screening pathways and should be reviewed with genetics or a high-risk clinic."
    )
  }

  const overdueVaccines = vaccines.filter((vaccine) => vaccine.status === "overdue")
  if (overdueVaccines.length > 0) {
    addFactor(
      "Overdue vaccinations",
      6,
      "monitor",
      `${overdueVaccines.length} vaccine(s) are overdue and increase avoidable risk.`
    )
  }

  score = Math.max(0, Math.min(100, score))

  const riskTier: RiskTier = score >= 65 ? "high" : score >= 35 ? "moderate" : "low"
  const recommendations: ScreeningRecommendation[] = []

  function addRecommendation(rec: ScreeningRecommendation) {
    if (recommendations.some((item) => item.id === rec.id)) return
    recommendations.push(rec)
  }

  if (age >= 18) {
    addRecommendation({
      id: "blood-pressure-screening",
      name: "Blood pressure screening",
      priority: latestVital?.systolic && latestVital.systolic >= 130 ? "medium" : "low",
      ownerAgent: "screening",
      reason: "Adults should stay current on blood pressure screening, with confirmation outside clinic when elevated.",
    })
    addRecommendation({
      id: "depression-screening",
      name: "Depression screening",
      priority: "low",
      ownerAgent: "wellness",
      reason: "Adults should be screened when systems exist for accurate diagnosis, treatment, and follow-up.",
    })
    addRecommendation({
      id: "unhealthy-alcohol-drug-screening",
      name: "Alcohol and unhealthy drug use screening",
      priority: "low",
      ownerAgent: "wellness",
      reason: "Routine behavioral screening can identify risks that affect preventive care and medication safety.",
    })
  }

  if (age >= 18 && age <= 79) {
    addRecommendation({
      id: "hepatitis-c-screening",
      name: "Hepatitis C screening",
      priority: "low",
      ownerAgent: "screening",
      reason: "Adults 18 to 79 should have hepatitis C screening at least once, with repeat testing based on risk.",
    })
  }

  if (age >= 15 && age <= 65) {
    addRecommendation({
      id: "hiv-screening",
      name: "HIV screening",
      priority: "low",
      ownerAgent: "screening",
      reason: "Adolescents and adults 15 to 65 should be screened for HIV, with additional testing when risk is higher.",
    })
  }

  if (age >= 35 && age <= 70 && (typeof input.bmi !== "number" || input.bmi >= 25)) {
    addRecommendation({
      id: "diabetes-screening",
      name: "Prediabetes and type 2 diabetes screening",
      priority: input.bmi && input.bmi >= 30 ? "medium" : "low",
      ownerAgent: "screening",
      reason: "Adults 35 to 70 with overweight or obesity should be screened and offered preventive intervention when indicated.",
    })
  }

  if (
    age >= 40 &&
    age <= 75 &&
    (input.smoker ||
      Array.from(conditionSet).some((item) =>
        item.includes("diabetes") || item.includes("hypertension") || item.includes("hyperlipidemia")
      ))
  ) {
    addRecommendation({
      id: "cardiovascular-risk-statin-review",
      name: "Cardiovascular risk and lipid review",
      priority: "medium",
      ownerAgent: "screening",
      reason: "Adults 40 to 75 with cardiovascular risk factors should have risk-based lipid/statin discussion.",
    })
  }

  if (Array.from(conditionSet).some((item) => item.includes("diabetes"))) {
    addRecommendation({
      id: "a1c-quarterly",
      name: "Quarterly Hemoglobin A1C",
      priority: "high",
      ownerAgent: "screening",
      reason: "A1C trend should be tracked every 3 months for diabetes control.",
    })
    addRecommendation({
      id: "retina-annual",
      name: "Annual retinal exam",
      priority: "high",
      ownerAgent: "wellness",
      reason: "Diabetes increases retinopathy risk; annual screening is recommended.",
    })
    addRecommendation({
      id: "kidney-panel",
      name: "Microalbumin and kidney function panel",
      priority: "high",
      ownerAgent: "screening",
      reason: "Urine protein history indicates closer kidney monitoring is useful.",
    })
  }

  if (age >= 45 && age <= 75) {
    addRecommendation({
      id: "colon-screening",
      name: "Colorectal cancer screening",
      priority: "medium",
      ownerAgent: "scheduling",
      reason: "Adults 45 to 75 should stay current on colorectal cancer screening; colonoscopy is one option among several.",
    })
  } else if (age >= 76 && age <= 85) {
    addRecommendation({
      id: "colon-screening-shared-decision",
      name: "Colorectal cancer screening shared decision",
      priority: "low",
      ownerAgent: "scheduling",
      reason: "Adults 76 to 85 should individualize colorectal screening based on prior screening, health, and preferences.",
    })
  }

  if (isFemale && age >= 40 && age <= 74) {
    addRecommendation({
      id: "breast-cancer-screening",
      name: "Breast cancer screening mammogram",
      priority: "medium",
      ownerAgent: "scheduling",
      reason: "Women 40 to 74 should receive biennial screening mammography.",
    })
  }

  if (isFemale && age >= 21 && age <= 65) {
    addRecommendation({
      id: "cervical-cancer-screening",
      name: "Cervical cancer screening",
      priority: "medium",
      ownerAgent: "scheduling",
      reason: "Women 21 to 65 should stay current on Pap and/or HPV-based cervical cancer screening intervals.",
    })
  }

  if (
    (riskText.includes("breast cancer") ||
      riskText.includes("ovarian cancer") ||
      riskText.includes("brca") ||
      riskText.includes("brca1") ||
      riskText.includes("brca2"))
  ) {
    addRecommendation({
      id: "brca-risk-assessment",
      name: "BRCA-related cancer risk assessment",
      priority: "high",
      ownerAgent: "screening",
      reason: "Personal or family breast/ovarian cancer history or BRCA signal should trigger formal familial risk assessment and counseling referral when positive.",
    })
  }

  if (inheritedRiskSignal) {
    addRecommendation({
      id: "hereditary-risk-review",
      name: "Genetic counseling and high-risk screening review",
      priority: "high",
      ownerAgent: "screening",
      reason:
        "A reported germline mutation or hereditary-risk signal should be reviewed before relying only on average-risk intervals.",
    })
  }

  if (age >= 50 && age <= 80 && (input.smoker || Array.from(conditionSet).some((item) => item.includes("copd")))) {
    addRecommendation({
      id: "lung-screen",
      name: "Low-dose CT lung cancer screening",
      priority: "medium",
      ownerAgent: "screening",
      reason: "Adults 50 to 80 with qualifying 20 pack-year smoking history who currently smoke or quit within 15 years should discuss annual LDCT eligibility.",
    })
  }

  if (isMale && age >= 65 && age <= 75 && input.smoker) {
    addRecommendation({
      id: "aaa-ultrasound",
      name: "Abdominal aortic aneurysm ultrasound",
      priority: "medium",
      ownerAgent: "scheduling",
      reason: "Men 65 to 75 who have ever smoked should receive one-time AAA screening with ultrasonography.",
    })
  }

  if (isFemale && age >= 65) {
    addRecommendation({
      id: "osteoporosis-screening",
      name: "Osteoporosis screening",
      priority: "medium",
      ownerAgent: "scheduling",
      reason: "Women 65 years or older should be screened for osteoporosis to prevent fractures.",
    })
  }

  vaccines
    .filter((vaccine) => vaccine.status === "due" || vaccine.status === "overdue")
    .forEach((vaccine, index) => {
      addRecommendation({
        id: `vaccine-${index}`,
        name: `${vaccine.vaccine_name} update`,
        priority: vaccine.status === "overdue" ? "high" : "medium",
        ownerAgent: "scheduling",
        reason: vaccine.status === "overdue" ? "Vaccine is overdue." : "Vaccine is due soon.",
      })
    })

  addRecommendation({
    id: "risk-recheck",
    name: "Repeat AI risk screening in 30 days",
    priority: "low",
    ownerAgent: "screening",
    reason: "Continuous monitoring catches trend changes early.",
  })

  const orderedRecommendations = recommendations.sort(
    (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)
  )

  const nextActions = [
    riskTier === "high"
      ? "Book a clinician review within 7 days to confirm risk priorities."
      : riskTier === "moderate"
      ? "Review this plan with your primary care team during your next visit."
      : "Continue preventive cadence and re-screen monthly.",
    "Share any new symptoms immediately with the triage or screening agent.",
    "Track adherence and blood pressure readings to improve trend confidence.",
  ]
  const screeningEngine = recommendScreenings(screeningIntakeFromLegacy(buildScreeningEngineInput(input, patient, age)))
  const engineRecommendations = screeningEngine.recommendations
    .filter((rec) => rec.status !== "not_due")
    .map(toLegacyScreeningRecommendation)
  const mergedLegacyRecommendations = [...orderedRecommendations]
  for (const rec of engineRecommendations) {
    if (!mergedLegacyRecommendations.some((item) => item.id === rec.id || item.name === rec.name)) {
      mergedLegacyRecommendations.push(rec)
    }
  }
  const safetyNextActions = screeningEngine.recommendations
    .filter((rec) => rec.requiresClinicianReview)
    .slice(0, 3)
    .map((rec) => rec.recommendedNextStep)
  const mergedNextActions = Array.from(new Set([...safetyNextActions, ...nextActions]))

  return {
    patientId: patient.id,
    generatedAt: new Date().toISOString(),
    overallRiskScore: score,
    riskTier,
    factors: factors.sort((a, b) => b.scoreDelta - a.scoreDelta),
    recommendedScreenings: mergedLegacyRecommendations.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)),
    nextActions: mergedNextActions,
    structuredRecommendations: screeningEngine.recommendations,
    screeningIntakeCompleteness: screeningEngine.intakeCompleteness,
    safetyMessages: screeningEngine.safetyMessages,
  }
}

export function reviewSecondOpinion(input: SecondOpinionInput): SecondOpinionResult {
  const patient = resolvePatient(input.patient)
  const diagnosis = input.diagnosis.trim()
  const plan = input.currentPlan.trim()
  const diagnosisLower = diagnosis.toLowerCase()
  const planLower = plan.toLowerCase()

  const redFlags: string[] = []
  const symptomText = (input.symptoms || []).join(" ").toLowerCase()
  if (symptomText.includes("chest pain") || symptomText.includes("shortness of breath")) {
    redFlags.push("Potential emergency symptom language detected; urgent triage should be considered.")
  }
  if (symptomText.includes("confusion") || symptomText.includes("fainting")) {
    redFlags.push("Neurologic warning symptoms reported; same-day clinician follow-up is advised.")
  }

  const agreement: SecondOpinionResult["agreement"] = "needs-clinician-review"
  const confidence: SecondOpinionResult["confidence"] = "low"

  const keyQuestions = [
    "What objective markers would confirm that this treatment is working in 90 days?",
    "What would trigger a treatment escalation or specialist referral?",
    "Are there lower-cost alternatives with similar outcomes for this plan?",
  ]

  if (diagnosisLower.includes("diabetes")) {
    keyQuestions.push("Should kidney protection or cardiometabolic therapy be adjusted now or after the next A1C?")
  }
  if (diagnosisLower.includes("hypertension")) {
    keyQuestions.push("Would home blood pressure averaging change medication targets?")
  }

  const alternativeConsiderations = [
    "Medication adherence barriers should be reviewed before assuming treatment failure.",
    "Coordinating nutrition and activity goals can improve outcomes without adding medications.",
    "Shared decision-making on side effects versus benefits may improve long-term plan adherence.",
  ]

  if (patient.medical_history.some((item) => item.condition.toLowerCase().includes("kidney"))) {
    alternativeConsiderations.push("Kidney function trends should be monitored when adjusting cardiometabolic medications.")
  }

  const specialistSuggestions: string[] = []
  if (diagnosisLower.includes("diabetes")) specialistSuggestions.push("Endocrinology")
  if (diagnosisLower.includes("kidney") || diagnosisLower.includes("nephro")) specialistSuggestions.push("Nephrology")
  if (diagnosisLower.includes("cardio") || diagnosisLower.includes("hypertension")) specialistSuggestions.push("Cardiology")
  if (specialistSuggestions.length === 0) specialistSuggestions.push("Primary Care Follow-up")

  const summary = "The available details are too limited for confidence; a direct clinician review is strongly recommended."

  return {
    generatedAt: new Date().toISOString(),
    diagnosis,
    agreement,
    confidence,
    summary,
    keyQuestions,
    alternativeConsiderations,
    redFlags,
    specialistSuggestions,
  }
}

function parseAgeYears(value?: string): number | null {
  if (!value || value.toUpperCase() === "N/A") return null
  const match = value.match(/(\d+)/)
  if (!match) return null
  const numeric = Number.parseInt(match[1], 10)
  if (!Number.isFinite(numeric)) return null
  if (value.toLowerCase().includes("month")) return Math.floor(numeric / 12)
  return numeric
}

function buildTrialSearchTerms(condition: string, history: string[]): string {
  if (condition) return condition
  return history.slice(0, 3).join(" ")
}

function normalizeTrialLocationText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function canonicalizeUsState(value?: string): string | null {
  const normalized = normalizeTrialLocationText(value)
  if (!normalized) return null
  return US_STATE_ALIASES[normalized] || null
}

function parseTrialLocationQuery(value?: string): ParsedTrialLocationQuery {
  const normalized = normalizeTrialLocationText(value)
  const wantsRemote = /\b(remote|virtual|telehealth|telemedicine|online|nationwide)\b/.test(normalized)
  const zipMatch = normalized.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch?.[1]
  const withoutZip = zip ? normalizeTrialLocationText(normalized.replace(zipMatch![0], " ")) : normalized
  if (!normalized) {
    return { raw: value || "", normalized, stateOnly: false, wantsRemote }
  }

  if (withoutZip === "new york") {
    return {
      raw: value || "",
      normalized,
      city: "new york",
      state: "new york",
      zip,
      stateOnly: false,
      wantsRemote,
    }
  }

  const commaParts = withoutZip.split(",").map((part) => part.trim()).filter(Boolean)
  if (commaParts.length >= 2) {
    const state = canonicalizeUsState(commaParts.at(-1))
    const city = commaParts.slice(0, -1).join(" ").trim() || undefined
    return { raw: value || "", normalized, city, state: state || undefined, zip, stateOnly: Boolean(state && !city), wantsRemote }
  }

  const directState = canonicalizeUsState(withoutZip)
  if (directState) {
    return { raw: value || "", normalized, state: directState, zip, stateOnly: true, wantsRemote }
  }

  const tokens = withoutZip.split(" ")
  const trailingTwo = tokens.length > 1 ? canonicalizeUsState(tokens.slice(-2).join(" ")) : null
  if (trailingTwo) {
    const city = tokens.slice(0, -2).join(" ").trim() || undefined
    return { raw: value || "", normalized, city, state: trailingTwo, zip, stateOnly: !city, wantsRemote }
  }

  const trailingOne = tokens.length > 1 ? canonicalizeUsState(tokens.at(-1)) : null
  if (trailingOne) {
    const city = tokens.slice(0, -1).join(" ").trim() || undefined
    return { raw: value || "", normalized, city, state: trailingOne, zip, stateOnly: !city, wantsRemote }
  }

  return { raw: value || "", normalized, city: withoutZip || undefined, zip, stateOnly: false, wantsRemote }
}

function buildTrialLocationLabel(entry?: CtGovLocation | null): string {
  if (!entry) return "Location pending"
  const site = [entry.facility, entry.city, entry.state, entry.country].filter(Boolean)
  if (site.length === 0) return "Location pending"
  return site.join(", ")
}

function scoreTrialLocationEntry(entry: CtGovLocation, parsed: ParsedTrialLocationQuery): number {
  const city = normalizeTrialLocationText(entry.city)
  const state = canonicalizeUsState(entry.state)
  const zip = entry.zip?.slice(0, 5)

  if (parsed.zip) {
    if (zip === parsed.zip) return 7
    return 0
  }

  if (parsed.stateOnly) {
    return parsed.state && state === parsed.state ? 5 : 0
  }

  let score = 0

  if (parsed.city) {
    if (city === parsed.city) {
      score += 5
    } else if (city.includes(parsed.city) || parsed.city.includes(city)) {
      score += 3
    } else {
      return 0
    }
  }

  if (parsed.state) {
    if (state === parsed.state) {
      score += parsed.city ? 2 : 4
    } else {
      return 0
    }
  }

  return score
}

function findBestTrialLocationMatch(
  locations: CtGovLocation[],
  parsed: ParsedTrialLocationQuery
): TrialLocationMatch {
  let best: TrialLocationMatch = { entry: null, score: 0 }
  for (const entry of locations) {
    const score = scoreTrialLocationEntry(entry, parsed)
    if (score > best.score) {
      best = { entry, score }
    }
  }
  return best
}

async function fetchCtGovStudies(opts: {
  queryTerm: string
  location?: string
  pageSize: number
}): Promise<CtGovStudy[]> {
  const params = new URLSearchParams()
  params.set("format", "json")
  params.set("countTotal", "false")
  params.set("pageSize", String(opts.pageSize))
  params.set("filter.overallStatus", "RECRUITING")
  if (opts.queryTerm) params.set("query.term", opts.queryTerm)
  if (opts.location?.trim()) params.set("query.locn", opts.location.trim())

  const response = await fetchWithTimeout(
    `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`,
    { next: { revalidate: 900 } },
    10000
  )
  if (!response.ok) return []

  const payload = (await response.json()) as CtGovResponse
  return payload.studies || []
}

function dedupeCtGovStudies(studies: CtGovStudy[]): CtGovStudy[] {
  const seen = new Set<string>()
  const deduped: CtGovStudy[] = []
  studies.forEach((study) => {
    const id = study.protocolSection?.identificationModule?.nctId
    if (!id || seen.has(id)) return
    seen.add(id)
    deduped.push(study)
  })
  return deduped
}

function scoreTrialStudies(
  studies: CtGovStudy[],
  opts: {
    age: number
    locationQuery: string
    parsedLocation: ParsedTrialLocationQuery
    conditionQuery: string
    conditionHistory: string[]
    conditionText: string
    inputCondition?: string
  }
): TrialMatch[] {
  const matches: TrialMatch[] = []

  for (const study of studies) {
    const protocol = study.protocolSection
    const id = protocol?.identificationModule?.nctId
    const title = protocol?.identificationModule?.briefTitle
    if (!id || !title) continue

    const minAge = parseAgeYears(protocol?.eligibilityModule?.minimumAge)
    const maxAge = parseAgeYears(protocol?.eligibilityModule?.maximumAge)
    if (minAge !== null && opts.age < minAge) continue
    if (maxAge !== null && opts.age > maxAge) continue

    const conditions = protocol?.conditionsModule?.conditions || []
    const summary = protocol?.descriptionModule?.briefSummary || "No study summary provided."
    const sponsor = protocol?.sponsorCollaboratorsModule?.leadSponsor?.name || "Unknown sponsor"
    const phase = protocol?.designModule?.phases?.[0] || "Not specified"
    const status = (protocol?.statusModule?.overallStatus || "RECRUITING").toLowerCase()
    const locations = protocol?.contactsLocationsModule?.locations || []
    const remoteEligible = locations.length === 0
    const locationMatch = opts.locationQuery
      ? findBestTrialLocationMatch(locations, opts.parsedLocation)
      : { entry: locations[0] || null, score: 0 }
    const displayLocationEntry = locationMatch.entry || locations[0] || null
    const location = remoteEligible ? "Remote / location pending" : buildTrialLocationLabel(displayLocationEntry)

    let score = 30
    const reasons: string[] = []

    if (opts.conditionQuery) {
      const conditionPool = `${conditions.join(" ")} ${summary}`.toLowerCase()
      if (conditionPool.includes(opts.conditionQuery)) {
        score += 35
        reasons.push(`Study focus matches "${opts.inputCondition}".`)
      } else {
        score += 10
        reasons.push("Matched on broader query terms.")
      }
    } else if (opts.conditionText) {
      const conditionPool = `${conditions.join(" ")} ${summary}`.toLowerCase()
      const overlap = opts.conditionHistory.find((item) => conditionPool.includes(item.toLowerCase()))
      if (overlap) {
        score += 24
        reasons.push(`Aligned with patient history: ${overlap}.`)
      }
    }

    if (opts.locationQuery) {
      if (locationMatch.score >= 5) {
        score += 22
        reasons.push(`Location preference matched at ${location}.`)
      } else if (locationMatch.score >= 3) {
        score += 14
        reasons.push(`Trial site aligned with the requested area: ${location}.`)
      } else if (remoteEligible && opts.parsedLocation.wantsRemote) {
        score += 8
        reasons.push("No listed sites yet; may allow remote prescreening.")
      } else {
        continue
      }
    }

    const finalScore = Math.max(0, Math.min(100, score))
    if (finalScore < 35) continue

    matches.push({
      id,
      title,
      phase,
      status,
      sponsor,
      location,
      remoteEligible,
      condition: conditions[0] || opts.inputCondition || "General",
      matchScore: finalScore,
      fit: finalScore >= 65 ? "strong" : "possible",
      reasons,
      url: `https://clinicaltrials.gov/study/${id}`,
      summary,
    })
  }

  return matches
}

export async function matchClinicalTrials(input: TrialMatchInput = {}): Promise<TrialMatch[]> {
  const patient = resolvePatient(input.patient)
  const age = calcAge(patient.date_of_birth)
  const locationQuery = (input.location || "").trim().toLowerCase()
  const parsedLocation = parseTrialLocationQuery(input.location)
  const conditionQuery = (input.condition || "").trim().toLowerCase()
  const conditionHistory = patient.medical_history.map((item) => item.condition.trim()).filter(Boolean)
  const conditionText = conditionHistory.join(" ").toLowerCase()
  const queryTerm = buildTrialSearchTerms(input.condition?.trim() || "", conditionHistory)

  if (!queryTerm && !locationQuery) return []

  try {
    const studies = locationQuery
      ? dedupeCtGovStudies([
          ...(await fetchCtGovStudies({
            queryTerm,
            location: input.location?.trim(),
            pageSize: 60,
          })),
          ...(await fetchCtGovStudies({
            queryTerm,
            pageSize: 250,
          })),
        ])
      : await fetchCtGovStudies({
          queryTerm,
          pageSize: 20,
        })

    const matches = scoreTrialStudies(studies, {
      age,
      locationQuery,
      parsedLocation,
      conditionQuery,
      conditionHistory,
      conditionText,
      inputCondition: input.condition,
    })

    return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10)
  } catch {
    return []
  }
}
