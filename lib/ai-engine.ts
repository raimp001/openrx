import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { OPENCLAW_CONFIG } from "./openclaw/config"
import { getLiveSnapshotByWallet } from "./live-data.server"
import { parseScreeningIntakeNarrative } from "./screening-intake"
import { nextStepLabel, recommendScreenings, screeningIntakeFromLegacy } from "./screening/recommend"
import { getGuidelineSource } from "./screening/sources"
import type { ScreeningRecommendation } from "./screening/types"

// ── AI Clients ────────────────────────────────────────────
const getClaudeClient = () =>
  process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
})

// ── Agent Action Log (in-memory, production would use DB) ─
export interface AgentAction {
  id: string
  agentId: string
  agentName: string
  action: string
  detail: string
  timestamp: string
  channel: string
}

const actionLog: AgentAction[] = []

export function logAction(agentId: string, action: string, detail: string, channel = "system") {
  const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === agentId)
  const entry: AgentAction = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentId,
    agentName: agent?.name || agentId,
    action,
    detail,
    timestamp: new Date().toISOString(),
    channel,
  }
  actionLog.unshift(entry)
  if (actionLog.length > 50) actionLog.pop()
  return entry
}

export function getRecentActions(limit = 10): AgentAction[] {
  return actionLog.slice(0, limit)
}

// ── Conversation Memory (per-agent sessions) ─────────────
interface ConversationMessage {
  role: "system" | "user" | "assistant"
  content: string
}

const conversations = new Map<string, ConversationMessage[]>()
const MAX_CONVERSATION_SESSIONS = 300

function getConversation(sessionKey: string): ConversationMessage[] {
  if (!conversations.has(sessionKey)) {
    if (conversations.size >= MAX_CONVERSATION_SESSIONS) {
      const oldestKey = conversations.keys().next().value
      if (oldestKey) conversations.delete(oldestKey)
    }
    conversations.set(sessionKey, [])
  } else {
    // LRU: move accessed entry to end of Map iteration order
    const existing = conversations.get(sessionKey)!
    conversations.delete(sessionKey)
    conversations.set(sessionKey, existing)
  }
  return conversations.get(sessionKey)!
}

function addToConversation(sessionKey: string, role: "user" | "assistant", content: string) {
  const conv = getConversation(sessionKey)
  conv.push({ role, content })
  // Keep last 20 messages to avoid token overflow
  if (conv.length > 20) {
    conversations.set(sessionKey, conv.slice(-20))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Care-navigation pathway library — concrete steps for "how do I schedule X" /
// "find care for X" intent. Lead with substance, not a survey.
interface CarePathway {
  match: RegExp
  title: string
  summary: string
  steps: string[]
  followUps: string[]
  references: Array<{ label: string; url: string }>
}

const CARE_PATHWAYS: CarePathway[] = [
  {
    match: /\b(colon|colorectal|colonoscop|fit-?dna|cologuard)\b/i,
    title: "colorectal cancer screening",
    summary:
      "USPSTF recommends colorectal cancer screening for average-risk adults ages 45–75 (selective 76–85). Common options: colonoscopy every 10 years, FIT every year, or stool DNA-FIT every 1–3 years. Family history or symptoms move you to a clinician-driven pathway sooner.",
    steps: [
      "Confirm risk tier: average risk vs first-degree relative with CRC/advanced polyps, known Lynch/FAP, IBD, or new GI symptoms (bleeding, change in stools, weight loss).",
      "Choose the test with your clinician: colonoscopy (gold standard, sedation, prep) or stool-based FIT/FIT-DNA (no prep, but a positive result still requires colonoscopy).",
      "Get the order or referral: a PCP can order stool tests directly; colonoscopy usually needs a GI referral or direct-access scheduling at a colonoscopy center.",
      "Verify coverage: under the ACA, screening colonoscopy and FIT/FIT-DNA are typically $0 cost-share — confirm the CPT/diagnosis code with the plan so a polyp removal is not reclassified as diagnostic.",
      "Schedule and prep: book the procedure 4–8 weeks out, follow the bowel-prep instructions exactly, and arrange a ride home if sedation is used.",
    ],
    followUps: [
      "Are you average risk, or do you have family history, prior polyps, IBD, or symptoms?",
      "Do you prefer colonoscopy or a stool-based test (FIT / FIT-DNA)?",
      "Do you have a PCP and an in-network gastroenterology option?",
    ],
    references: [
      { label: "USPSTF: Colorectal cancer screening (2021)", url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening" },
      { label: "ACS: Colorectal cancer screening guidelines", url: "https://www.cancer.org/cancer/types/colon-rectal-cancer/detection-diagnosis-staging/acs-recommendations.html" },
      { label: "CDC: Colorectal cancer screening tests", url: "https://www.cdc.gov/colorectal-cancer/screening/index.html" },
    ],
  },
  {
    match: /\b(mammogram|breast\s*cancer)\b/i,
    title: "breast cancer screening",
    summary:
      "USPSTF (2024) recommends biennial mammography for average-risk people assigned female at birth ages 40–74. Personal/family history of breast or ovarian cancer or known BRCA may move you to earlier or supplemental screening (MRI).",
    steps: [
      "Confirm risk: family history of breast/ovarian/prostate/pancreatic cancer, prior chest-wall radiation, or known BRCA/PALB2/CHEK2.",
      "If average risk: ask your PCP or OB/GYN for a mammography order or use a direct-access mammography center.",
      "If high risk: request genetic counseling and discuss adding annual breast MRI (typically alternating with mammogram every 6 months).",
      "Verify coverage: screening mammogram is $0 cost-share under ACA; diagnostic follow-up imaging may have cost-share — ask before booking.",
      "Schedule at an accredited center (ACR-accredited / FDA-certified) and bring prior images for comparison.",
    ],
    followUps: [
      "Any first-degree relatives with breast, ovarian, prostate, or pancreatic cancer?",
      "Have you had a mammogram before? If so, where, so prior images can be sent over?",
      "Do you want help finding an in-network mammography center?",
    ],
    references: [
      { label: "USPSTF: Breast cancer screening (2024)", url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening" },
      { label: "ACS: Breast cancer screening", url: "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection.html" },
    ],
  },
  {
    match: /\b(lung|ldct|low[-\s]?dose\s*ct)\b/i,
    title: "lung cancer screening",
    summary:
      "USPSTF recommends annual low-dose CT (LDCT) for adults 50–80 with a 20+ pack-year smoking history who currently smoke or quit within the last 15 years. Shared decision-making and a smoking-cessation plan are required for coverage.",
    steps: [
      "Confirm eligibility: age 50–80, ≥20 pack-years, current smoker or quit ≤15 years ago, and able to tolerate curative treatment.",
      "Schedule a shared decision-making visit with a PCP — required by CMS for Medicare coverage and by most commercial plans.",
      "Get the LDCT order and a referral to a radiology center that participates in an ACR-designated lung cancer screening registry.",
      "Plan the follow-up: results are scored on Lung-RADS; positive findings route to pulmonology, sometimes biopsy. Build that pathway in before the scan.",
      "Pair every screen with active tobacco-cessation support — counseling plus pharmacotherapy (NRT, varenicline, or bupropion).",
    ],
    followUps: [
      "What is your pack-year history (packs/day × years)?",
      "If you quit, how many years ago?",
      "Do you want a referral for tobacco-cessation support alongside the scan?",
    ],
    references: [
      { label: "USPSTF: Lung cancer screening (2021)", url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening" },
      { label: "CMS: Lung cancer screening with LDCT", url: "https://www.cms.gov/medicare-coverage-database/view/ncacal-decision-memo.aspx?proposed=N&NCAId=304" },
    ],
  },
  {
    match: /\b(cervical|pap|hpv)\b/i,
    title: "cervical cancer screening",
    summary:
      "USPSTF recommends cervical cancer screening for people with a cervix ages 21–65: cytology every 3 years (21–29), and 21+ options (cytology every 3 yrs, hr-HPV every 5 yrs, or co-test every 5 yrs) for ages 30–65.",
    steps: [
      "Confirm screening eligibility: cervix present, age 21–65, no high-risk history (HIV, immunocompromise, in-utero DES, prior CIN/cervical cancer).",
      "Choose the test with your clinician: Pap alone, primary hr-HPV, or HPV/Pap co-test.",
      "Schedule with PCP or OB/GYN. Many plans cover screening at $0 cost-share — verify coding (Z01.419 / Z11.51) before the visit.",
      "If a result is abnormal, expect ASCCP-guided follow-up: repeat testing, colposcopy, or biopsy. Do not skip the loop-closure visit.",
    ],
    followUps: [
      "When was your last Pap or HPV test, and what was the result?",
      "Have you had the HPV vaccine series?",
    ],
    references: [
      { label: "USPSTF: Cervical cancer screening", url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/cervical-cancer-screening" },
      { label: "ACS: Cervical cancer screening guidelines", url: "https://www.cancer.org/cancer/types/cervical-cancer/detection-diagnosis-staging/screening.html" },
    ],
  },
  {
    match: /\b(prostate|psa)\b/i,
    title: "prostate cancer screening",
    summary:
      "USPSTF recommends shared decision-making for PSA-based screening in men 55–69 (Grade C); recommends against routine screening at 70+. Black men and those with first-degree relatives diagnosed at <65 may benefit from earlier discussion (45–50).",
    steps: [
      "Schedule a shared decision-making visit with a PCP or urology to weigh benefit vs over-diagnosis.",
      "If proceeding, draw a baseline PSA; many clinicians use age-adjusted thresholds and PSA velocity rather than a single cut-off.",
      "Plan the follow-up pathway in advance: elevated PSA usually triggers repeat PSA, free PSA / PSA density, MRI, and only then biopsy.",
      "If you have family or African ancestry risk, ask about starting the conversation at 45 and discuss BRCA-related risk.",
    ],
    followUps: [
      "Any first-degree relatives with prostate, breast, ovarian, or pancreatic cancer?",
      "Have you had a PSA before, and what was the result?",
    ],
    references: [
      { label: "USPSTF: Prostate cancer screening", url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prostate-cancer-screening" },
      { label: "ACS: Prostate cancer screening", url: "https://www.cancer.org/cancer/types/prostate-cancer/detection-diagnosis-staging/acs-recommendations.html" },
    ],
  },
]

const SCHEDULING_INTENT_RE = /\b(schedule|book|set\s*up|how\s+do\s+i\s+(?:get|schedule|book)|where\s+do\s+i\s+(?:go|book))\b/i
const FIND_CARE_INTENT_RE = /\b(find|search|look\s+for|near\s+me|in\s+network)\b/i

function detectCarePathway(message: string): CarePathway | null {
  if (!message) return null
  return CARE_PATHWAYS.find((p) => p.match.test(message)) || null
}

export function buildCareNavigationResponse(message: string): string | null {
  if (!message) return null
  const pathway = detectCarePathway(message)
  if (!pathway) return null
  const isAction = SCHEDULING_INTENT_RE.test(message) || FIND_CARE_INTENT_RE.test(message)
  if (!isAction) return null

  const stepLines = pathway.steps.map((step, i) => `- Step ${i + 1}. ${step}`)
  const refs = pathway.references.map((r) => `- [${r.label}](${r.url})`)
  const followUps = pathway.followUps.slice(0, 2).map((q) => `- ${q}`)

  return [
    `Direct answer: here is the practical pathway to schedule ${pathway.title} — concrete steps, not a survey.`,
    "",
    pathway.summary,
    "",
    "What to do now",
    ...stepLines,
    "",
    "Question to refine this",
    ...followUps,
    "",
    "References",
    ...refs,
    "",
    "Safety note",
    "OpenRx surfaces guideline-based steps and care-navigation help. It does not place orders, confirm appointments, or guarantee insurance coverage by itself.",
  ].join("\n")
}

function buildFallbackAgentResponse(agentId: string, message: string): string {
  const trimmedMessage = message.trim()
  const careAnswer = buildCareNavigationResponse(trimmedMessage)
  if (careAnswer) return careAnswer

  const contextLine = trimmedMessage ? `Direct answer: I’m looking at “${trimmedMessage.slice(0, 140)}${trimmedMessage.length > 140 ? "..." : ""}.”` : "Direct answer: I can help with the next step."

  switch (agentId) {
    case "rx":
      return `${contextLine}\n\nWhat to do now\nConfirm the exact medication names, doses, kidney history, allergies, pregnancy status if relevant, and why the medication is being used. Do not stop or combine prescribed medication without clinician/pharmacist guidance. If this is a refill emergency or you are out of a critical medicine, call the pharmacy or prescriber now.\n\nReferences\n- [MedlinePlus: Medicines](https://medlineplus.gov/medicines.html)\n- [FDA: Drug interactions](https://www.fda.gov/drugs/resources-you-drugs/drug-interactions-what-you-should-know)\n\nSafety note\nThis is medication-safety education, not a prescription change or substitute for a clinician/pharmacist review.`
    case "scheduling":
      return `Direct answer: here is the OpenRx care-navigation flow when the visit type is not clear yet.\n\nWhat to do now\n- Step 1. Name the visit type — preventive screening, sick/symptom visit, follow-up, specialist consult, or telehealth.\n- Step 2. Decide who can place the order: PCP-direct (most labs, FIT, mammogram), specialist referral (GI for colonoscopy, urology for PSA work-up), or self-referral if your plan allows.\n- Step 3. Check coverage and network — confirm in-network providers, prior-auth requirements, copay tier, and whether a referral is required to keep cost-share preventive.\n- Step 4. Pick a time window (mornings, evenings, telehealth) and reserve the slot directly with the provider; prepare any forms, fasting, or prep instructions.\n- Step 5. Add reminders and a same-day plan: transport, time off, and the follow-up route if the visit produces an abnormal result.\n\nReferences\n- [HealthCare.gov: Preventive care benefits](https://www.healthcare.gov/coverage/preventive-care-benefits/)\n- [MedlinePlus: Choosing a primary care provider](https://medlineplus.gov/ency/article/001939.htm)\n\nSafety note\nOpenRx can stage a scheduling request, but it does not confirm appointments or place medical orders by itself.`
    case "billing":
      return `${contextLine}\n\nWhat to do now\nUse the claim number, date of service, insurer, amount owed, EOB/denial reason, and whether the provider is in-network. OpenRx can separate patient responsibility from insurer responsibility and draft next questions for the plan or billing office.\n\nReferences\n- [CMS: Understanding health care bills](https://www.cms.gov/medical-bill-rights/help/guides/understanding-health-care-bills)\n\nSafety note\nThis is billing navigation, not a legal determination or coverage guarantee.`
    case "prior-auth":
      return `${contextLine}\n\nWhat to do now\nConfirm the drug/procedure, payer, diagnosis, urgency, prior treatments, and supporting clinical notes. If there is a denial, collect the denial reason and deadline before drafting an appeal.\n\nReferences\n- [CMS: Electronic prior authorization](https://www.cms.gov/priorities/electronic-prior-authorization/overview)\n\nSafety note\nOpenRx can help prepare and track prior-auth work, but it cannot guarantee approval.`
    case "screening":
      return `${contextLine}\n\nWhat to do now\nShare age, sex used for screening intervals, family history, symptoms, smoking pack-years/quit date, and prior screening dates. I’ll answer directly in chat and cite the relevant guideline links.\n\nReferences\n- [USPSTF recommendations](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations)\n- [CDC cancer screening tests](https://www.cdc.gov/cancer/prevention/screening.html)\n\nSafety note\nThis is screening decision support, not a diagnosis or order.`
    case "trials":
      return `${contextLine}\n\nWhat to do now\nConfirm condition, stage, mutation/biomarker if known, current treatment, recent labs, and travel radius. I can summarize likely trial leads, but final eligibility must come from the study team.\n\nReferences\n- [ClinicalTrials.gov](https://clinicaltrials.gov/)\n- [NCI: Clinical trials information](https://www.cancer.gov/research/participate/clinical-trials)\n\nSafety note\nTrial matching is informational and does not determine eligibility.`
    case "triage":
      return `${contextLine}\n\nWhat to do now\nIf symptoms include chest pain, trouble breathing, stroke symptoms, severe allergic reaction, severe bleeding, sudden weakness, or fainting, call 911 or seek emergency care now. Otherwise, tell me onset, severity, associated symptoms, medications, and whether symptoms are worsening.\n\nReferences\n- [MedlinePlus: When to use the emergency room](https://medlineplus.gov/ency/patientinstructions/000593.htm)\n- [CDC: Stroke signs and symptoms](https://www.cdc.gov/stroke/signs-symptoms/index.html)\n\nSafety note\nThis is safety triage guidance, not a diagnosis. Emergency symptoms should not wait for chat.`
    case "second-opinion":
      return `${contextLine}\n\nWhat to do now\nShare the diagnosis, current plan, key test results, medications, and the decision you are unsure about. I’ll turn that into clinician-ready questions and identify what information is missing.\n\nReferences\n- [NCI: Finding health care services](https://www.cancer.gov/about-cancer/managing-care/services)\n\nSafety note\nThis supports preparation for medical review; it does not replace an examining clinician.`
    case "onboarding":
      return `${contextLine}\n\nWhat to do now\nStart with only what is needed: contact preference, primary care, pharmacy, medications, insurance if you want cost/network help, and the care goal you want OpenRx to handle first.\n\nReferences\n- [HealthIT.gov: Patient access to health information](https://www.healthit.gov/topic/patient-access-health-information)\n\nSafety note\nOnly share sensitive data when you want OpenRx to use it for care navigation.`
    default:
      return `${contextLine}\n\nWhat to do now\nAsk the clinical question in plain language and include the few details that change the answer: age, sex when relevant, symptoms, medication names/doses, diagnosis, prior test dates, and urgency. I’ll answer in chat first and only hand off when an action is needed.\n\nReferences\n- [MedlinePlus](https://medlineplus.gov/)\n- [CDC](https://www.cdc.gov/)\n\nSafety note\nOpenRx is clinical decision support and care navigation, not a diagnosis or substitute for clinician judgment.`
  }
}

const SCREENING_QUERY_TERMS = [
  "screening",
  "colonoscopy",
  "colon cancer",
  "colorectal",
  "mammogram",
  "pap",
  "hpv",
  "ldct",
  "lung cancer",
  "psa",
  "prostate",
  "brca",
  "lynch",
  "family history",
]

const SCREENING_ELIGIBLE_AGENTS = new Set(["screening", "wellness", "coordinator"])

function looksLikeScreeningQuestion(agentId: string, message: string): boolean {
  if (!SCREENING_ELIGIBLE_AGENTS.has(agentId)) return false
  if (agentId === "screening") return true
  const lowered = message.toLowerCase()
  if (/\b(?:hx|fhx|fam hx)\b/.test(lowered)) return true
  return SCREENING_QUERY_TERMS.some((term) => lowered.includes(term))
}

function conciseStatus(status: ScreeningRecommendation["status"]): string {
  return status.replace(/_/g, " ")
}

function screeningGroupTitle(rec: ScreeningRecommendation): "Due now" | "Needs clinician review" | "Upcoming or depends" | "Current / not indicated" {
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

function sourceMarkdown(rec: ScreeningRecommendation): string {
  const source = getGuidelineSource(rec.sourceId)
  if (source && rec.sourceId === "high-risk-clinician-review") {
    return source.url
      ? `Evidence gap / high-risk pathway: clinician or genetics review recommended ([NCCN guidelines](${source.url}))`
      : "Evidence gap / high-risk pathway: clinician or genetics review recommended."
  }
  if (source?.url) {
    return `[${source.organization}: ${source.topic}](${source.url})`
  }
  return `${rec.sourceSystem}${rec.sourceVersion ? ` ${rec.sourceVersion}` : ""}`
}

function formatScreeningRecommendation(rec: ScreeningRecommendation, index: number): string {
  const nextStep = rec.nextSteps[0] ? nextStepLabel(rec.nextSteps[0]) : rec.recommendedNextStep
  const review = rec.requiresClinicianReview ? " Clinician review is needed before using this as a routine screening interval." : ""

  return [
    `${index}. ${rec.screeningName} — ${conciseStatus(rec.status)} (${rec.riskCategory.replace(/_/g, " ")}).`,
    `Why: ${rec.patientFriendlyExplanation}${review}`,
    `Next: ${nextStep}. ${rec.recommendedNextStep}`,
    `Source: ${sourceMarkdown(rec)}.`,
  ].join("\n")
}

function formatScreeningGroups(recommendations: ScreeningRecommendation[]): string[] {
  const order: Array<ReturnType<typeof screeningGroupTitle>> = [
    "Due now",
    "Needs clinician review",
    "Upcoming or depends",
    "Current / not indicated",
  ]
  const grouped = new Map<string, ScreeningRecommendation[]>()
  recommendations.forEach((rec) => {
    const group = screeningGroupTitle(rec)
    grouped.set(group, [...(grouped.get(group) || []), rec])
  })

  return order.flatMap((group) => {
    const items = grouped.get(group) || []
    if (items.length === 0) return []
    return [
      group,
      ...items.map((rec, index) => formatScreeningRecommendation(rec, index + 1)),
    ]
  })
}

function buildReferenceList(recommendations: ScreeningRecommendation[]): string[] {
  const links = new Map<string, string>()
  recommendations.forEach((rec) => {
    const source = getGuidelineSource(rec.sourceId)
    if (source?.url) links.set(`${source.organization}: ${source.topic}`, source.url)
  })
  links.set("CDC: Cancer screening tests", "https://www.cdc.gov/cancer/prevention/screening.html")
  links.set("ACS: Cancer screening guidelines", "https://www.cancer.org/cancer/screening/american-cancer-society-guidelines-for-the-early-detection-of-cancer.html")
  return [
    ...Array.from(links.entries()).map(([label, url]) => `- [${label}](${url})`),
    `- Sources verified against the live publisher pages on ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`,
  ]
}

function buildFollowUpQuestion(recommendations: ScreeningRecommendation[]): string | null {
  if (recommendations.some((rec) => rec.id === "lung-smoking-history-needed" || rec.id === "lung-smoking-history-clarify")) {
    return "One follow-up that would sharpen this: has the patient ever smoked at least 20 pack-years, and if former, how many years since quitting?"
  }
  if (recommendations.some((rec) => rec.id === "uspstf-average-risk-cervical")) {
    return "One follow-up if relevant: does the patient have a cervix, and when was the last Pap/HPV test?"
  }
  if (recommendations.some((rec) => rec.status === "needs_clinician_review" || rec.status === "high_risk")) {
    return "One follow-up that would help: what were the exact family diagnosis ages, genetic test result, and prior screening dates?"
  }
  return null
}

function summarizeParsedScreeningInput(message: string): string {
  const parsed = parseScreeningIntakeNarrative(message).extracted
  const details = [
    typeof parsed.age === "number" ? `age ${parsed.age}` : undefined,
    parsed.gender,
    parsed.familyHistory.length ? parsed.familyHistory.join("; ") : undefined,
    parsed.conditions.length ? parsed.conditions.join("; ") : undefined,
    parsed.symptoms.length ? `symptoms: ${parsed.symptoms.join(", ")}` : undefined,
  ].filter(Boolean)

  return details.length ? details.join(", ") : "the details you shared"
}

export function buildDeterministicScreeningResponse(message: string): string {
  const parsed = parseScreeningIntakeNarrative(message)

  if (!parsed.ready) {
    return [
      "Direct answer: I can help, but I need one missing detail before giving screening guidance safely.",
      parsed.clarificationQuestion || "Share your age, sex used for screening intervals, symptoms, family history, smoking history, and prior screening dates if known.",
      "",
      "Safety note: OpenRx is clinical decision support, not a diagnosis, medical order, or insurance approval.",
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

  const recommendations = engineResult.recommendations

  if (recommendations.length === 0) {
    return [
      `Direct answer: based on what you shared (${summarizeParsedScreeningInput(message)}), I do not have enough source-backed detail to show a screening recommendation safely.`,
      "Next: request care navigation or add prior screening dates, symptoms, family history diagnosis ages, and smoking pack-years if relevant.",
      "Safety note: OpenRx is clinical decision support, not a diagnosis, medical order, or insurance approval.",
    ].join("\n")
  }

  const summary = summarizeParsedScreeningInput(message)
  const followUp = buildFollowUpQuestion(recommendations)
  const dueLeads = recommendations
    .filter((rec) => rec.status === "due" || rec.status === "high_risk" || rec.status === "urgent_clinician_review")
    .slice(0, 3)
  const headline = dueLeads.length
    ? `Direct answer: ${dueLeads.map((rec) => rec.screeningName.toLowerCase()).join(", ")} should move now. Profile: ${summary}.`
    : `Direct answer: here is the guideline-aligned screening plan for ${summary}.`
  return [
    headline,
    "",
    ...formatScreeningGroups(recommendations),
    "",
    ...(followUp ? ["Question to refine this", followUp, ""] : []),
    "References",
    ...buildReferenceList(recommendations),
    "",
    "Safety note: this is guideline-based clinical decision support and care navigation education. It does not diagnose disease, replace clinician judgment, place an order, or guarantee insurance coverage.",
  ].join("\n\n")
}

// ── GQA-inspired Patient Context Cache ───────────────────
// Mirrors grouped-query attention: one expensive context fetch is shared
// across multiple agent heads in the same session window, avoiding
// re-fetching the same patient snapshot for every expert in a fan-out call.
interface CachedContext {
  text: string
  expiresAt: number
}
const contextCache = new Map<string, CachedContext>()
const CONTEXT_TTL_MS = 30_000 // 30 s — covers a full MoE fan-out round-trip
const MAX_CONTEXT_CACHE_SIZE = 200

function pruneContextCache() {
  const now = Date.now()
  const entries = Array.from(contextCache.entries())
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) contextCache.delete(key)
  }
  if (contextCache.size > MAX_CONTEXT_CACHE_SIZE) {
    const sorted = Array.from(contextCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    const toRemove = sorted.slice(0, contextCache.size - MAX_CONTEXT_CACHE_SIZE)
    for (const [key] of toRemove) contextCache.delete(key)
  }
}

async function getPatientContext(walletAddress?: string): Promise<string> {
  pruneContextCache()
  const cacheKey = walletAddress || `__anon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}__`
  const cached = contextCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text
  }

  const snapshot = await getLiveSnapshotByWallet(walletAddress)
  if (!snapshot.patient) {
    const text =
      "CURRENT PATIENT DATA: No live patient profile found. Ask the user to complete setup or share the minimum details needed for the current question."
    contextCache.set(cacheKey, { text, expiresAt: Date.now() + CONTEXT_TTL_MS })
    return text
  }

  const patient = snapshot.patient
  const activeMedications = snapshot.prescriptions.filter((prescription) => prescription.status === "active")
  const upcomingAppointments = snapshot.appointments
    .filter((appointment) => new Date(appointment.scheduled_at).getTime() > Date.now())
    .slice(0, 5)
  const unreadCount = snapshot.messages.filter((message) => !message.read).length
  const pcp = snapshot.physicians.find((physician) => physician.id === patient.primary_physician_id)

  const text = `
CURRENT PATIENT DATA (use this to give specific, personalized answers):

Patient: ${patient.full_name}
DOB: ${patient.date_of_birth} | Gender: ${patient.gender}
Insurance: ${patient.insurance_provider} ${patient.insurance_plan} (${patient.insurance_id})
PCP: ${pcp?.full_name || "Not assigned"} (${pcp?.specialty || ""})
Allergies: ${patient.allergies.join(", ") || "None"}
Medical History: ${patient.medical_history.map((item) => `${item.condition} (${item.status})`).join(", ")}

Active Medications (${activeMedications.length}):
${activeMedications.map((medication) => `- ${medication.medication_name} ${medication.dosage}, ${medication.frequency}`).join("\n")}

Upcoming Appointments (${upcomingAppointments.length}):
${upcomingAppointments.map((appointment) => {
  const physician = snapshot.physicians.find((item) => item.id === appointment.physician_id)
  return `- ${new Date(appointment.scheduled_at).toLocaleDateString()} ${new Date(appointment.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — ${physician?.full_name || "Clinician"} — ${appointment.reason}`
}).join("\n")}

Recent Claims (${snapshot.claims.length}):
${snapshot.claims.slice(0, 5).map((claim) => `- ${claim.claim_number}: $${claim.total_amount} — ${claim.status}${claim.denial_reason ? ` (denied: ${claim.denial_reason})` : ""}`).join("\n")}

Prior Authorizations (${snapshot.priorAuths.length}):
${snapshot.priorAuths.map((auth) => `- ${auth.procedure_name}: ${auth.status}${auth.denial_reason ? ` (denied: ${auth.denial_reason})` : ""}`).join("\n")}

Unread Messages: ${unreadCount}
`.trim()

  contextCache.set(cacheKey, { text, expiresAt: Date.now() + CONTEXT_TTL_MS })
  return text
}

async function createCompletionWithRetry(params: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  max_tokens: number
  temperature: number
}) {
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await openai.chat.completions.create(params, { timeout: 20000 })
    } catch (error) {
      lastError = error
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status)
        : undefined
      const retryable = status === 408 || status === 429 || (typeof status === "number" && status >= 500)
      if (!retryable || attempt === 1) break
      await delay(350 * (attempt + 1))
    }
  }

  throw lastError
}

function friendlyAIError(status?: number, rawMessage?: string): string {
  if (status === 401) {
    return "Our AI service needs a configuration update. The care team has been notified — please try again shortly."
  }
  if (status === 429 || (rawMessage && rawMessage.includes("rate_limit"))) {
    return "Our AI assistant is handling a high volume of requests right now. Please wait a moment and try again."
  }
  if (status === 529 || (rawMessage && rawMessage.includes("overloaded"))) {
    return "Our AI assistant is temporarily at capacity. Please try again in a few minutes."
  }
  if (typeof status === "number" && status >= 500) {
    return "Our AI service experienced a temporary issue. Please try again in a moment."
  }
  if (rawMessage && (rawMessage.includes("timeout") || rawMessage.includes("ETIMEDOUT"))) {
    return "The request took longer than expected. Please try again — shorter questions tend to get faster responses."
  }
  return "Something went wrong while processing your request. Please try again, and if the issue continues, contact your care team."
}

// ── Core Agent Engine ────────────────────────────────────
export async function runAgent(params: {
  agentId: string
  message: string
  sessionId?: string
  walletAddress?: string
  // Pre-fetched context can be passed in to avoid re-fetching during fan-out.
  _cachedPatientContext?: string
}): Promise<{ response: string; agentId: string; handoff?: string }> {
  const { agentId, message, sessionId, walletAddress } = params
  const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === agentId)

  if (!agent) {
    return { response: "Unknown agent.", agentId }
  }

  const sessionKey = sessionId || `${agentId}-default`

  if (looksLikeScreeningQuestion(agentId, message)) {
    const response = buildDeterministicScreeningResponse(message)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("screening", "deterministic-screening-response", `${message.slice(0, 60)}...`, "portal")
    return { response, agentId: "screening" }
  }

  // Care-navigation pathway shortcut. When the user asks "how do I schedule
  // colon cancer screening?" / "find a mammogram center near me" we answer
  // with concrete, guideline-aligned steps instead of asking for visit type
  // and insurance up front.
  if (
    (agentId === "scheduling" || agentId === "coordinator" || agentId === "wellness") &&
    detectCarePathway(message) &&
    (SCHEDULING_INTENT_RE.test(message) || FIND_CARE_INTENT_RE.test(message))
  ) {
    const response = buildCareNavigationResponse(message)
    if (response) {
      addToConversation(sessionKey, "user", message)
      addToConversation(sessionKey, "assistant", response)
      logAction(agentId, "care-pathway-response", `${message.slice(0, 60)}...`, "portal")
      return { response, agentId }
    }
  }

  const claude = getClaudeClient()

  // Keep the demo path useful even when the hosted model provider is unavailable.
  if (!claude && !process.env.OPENAI_API_KEY) {
    return { response: buildFallbackAgentResponse(agentId, message), agentId }
  }

  const patientContext = params._cachedPatientContext ?? await getPatientContext(walletAddress)

  // Build system prompt with patient context
  const systemPrompt = `${agent.systemPrompt}

${patientContext}

IMPORTANT RULES:
- You ARE ${agent.name}. Stay in character.
- Use the patient data above to give SPECIFIC answers (reference their actual meds, appointments, claims by name).
- Behave like a clinical evidence chat assistant: answer directly in this chat first. Do not tell the user to open another page just to see clinical guidance.
- For clinical, medication, symptom, screening, prevention, billing, or prior-auth questions, use this visible structure when useful:
  Direct answer
  What to do now
  References
  Safety note
- Include 2-5 relevant, trustworthy inline Markdown links in References when guidelines or patient education sources are relevant. Prefer USPSTF, CDC, NIH/NCI, MedlinePlus, FDA, CMS, and major society guideline pages.
- Ask at most one concise follow-up question when a missing detail changes the answer. Otherwise provide the best cautious answer from available context.
- Keep actions optional. Only include [HANDOFF:agentId] when the user explicitly asks to find care, schedule, submit, pay, appeal, or otherwise take an operational action.
- Available agents to hand off to: ${(agent.canMessage as readonly string[]).join(", ")}
- Never make up patient-specific data, citations, orders, coverage, or diagnoses that are not supported by the patient context or cited source.`

  const conv = getConversation(sessionKey)

  // ── Reasoning mode (DeepSeek R1-inspired) ───────────────
  // High-stakes agents (prior-auth, second-opinion, triage) get an
  // internal chain-of-thought scratchpad that is stripped before the
  // final answer reaches the patient — matching how reasoning-specialized
  // models like DeepSeek R1 separate thinking from output tokens.
  const highStakesAgents = new Set(["prior-auth", "second-opinion", "triage"])
  const useReasoning = highStakesAgents.has(agentId) && !!claude

  try {
    let response: string

    if (claude) {
      const anthropicMessages: Anthropic.MessageParam[] = [
        ...conv.filter((m) => m.role !== "system").map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ]

      if (useReasoning) {
        // Extended thinking: give the model a private scratchpad (budget_tokens)
        // before producing its visible response. Reasoning blocks are stripped
        // so only the answer text reaches the caller.
        const completion = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 16000,
          thinking: { type: "enabled", budget_tokens: 10000 },
          system: systemPrompt,
          messages: anthropicMessages,
        })
        response = completion.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("") || "I couldn't process that. Could you try again?"
      } else {
        const completion = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          system: systemPrompt,
          messages: anthropicMessages,
        })
        response = completion.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("") || "I couldn't process that. Could you try again?"
      }
    } else {
      const completion = await createCompletionWithRetry({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...conv,
          { role: "user", content: message },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      })
      response = completion.choices[0]?.message?.content || "I couldn't process that. Could you try again?"
    }

    // Check for handoff
    let handoff: string | undefined
    const handoffMatch = response.match(/\[HANDOFF:(\w[\w-]*)\]/)
    if (handoffMatch) {
      handoff = handoffMatch[1]
      response = response.replace(/\[HANDOFF:\w[\w-]*\]/, "").trim()
    }

    // Save to memory
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)

    // Log the action
    logAction(agentId, "responded", `${message.slice(0, 60)}...`, "portal")

    return { response, agentId, handoff }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined
    console.error(`Agent ${agentId} error:`, errMsg || error)

    const errorNote = friendlyAIError(status, errMsg)
    const fallback = buildFallbackAgentResponse(agentId, message)
    return { response: `${errorNote}\n\n${fallback}`, agentId }
  }
}

// ── MoE-Inspired Parallel Expert Fan-out ────────────────
// Mirrors Sparse MoE architecture: instead of routing to a single expert
// sequentially, fan out to the top-K most relevant specialist agents in
// parallel (like how MoE layers activate multiple experts per token),
// then synthesize with a coordinator pass.
export async function runParallelExperts(params: {
  expertIds: string[]
  message: string
  sessionId?: string
  walletAddress?: string
}): Promise<{ agentId: string; response: string }[]> {
  // Fetch patient context once — shared across all expert calls (GQA cache hit)
  const sharedContext = await getPatientContext(params.walletAddress)

  const settled = await Promise.allSettled(
    params.expertIds.map((agentId) =>
      runAgent({
        agentId,
        message: params.message,
        sessionId: params.sessionId ? `${params.sessionId}-${agentId}` : undefined,
        walletAddress: params.walletAddress,
        _cachedPatientContext: sharedContext,
      }).then((r) => ({ agentId: r.agentId, response: r.response }))
    )
  )
  return settled.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : { agentId: params.expertIds[i], response: "This specialist is temporarily unavailable. Please try again shortly." }
  )
}

// ── Coordinator with Real Routing ────────────────────────
export async function runCoordinator(
  message: string,
  sessionId?: string,
  walletAddress?: string
): Promise<{
  response: string
  agentId: string
  handoff?: string
}> {
  const result = await runAgent({
    agentId: "coordinator",
    message,
    sessionId,
    walletAddress,
  })

  // If coordinator hands off, run the target agent
  if (result.handoff) {
    const targetAgent = OPENCLAW_CONFIG.agents.find((a) => a.id === result.handoff)
    if (targetAgent) {
      logAction("coordinator", "routed", `→ ${targetAgent.name}: ${message.slice(0, 40)}...`)

      const followUp = await runAgent({
        agentId: result.handoff,
        message,
        sessionId: sessionId ? `${sessionId}-${result.handoff}` : undefined,
        walletAddress,
      })

      // Combine coordinator's intro with specialist's response
      return {
        response: `${result.response}\n\n---\n\n**${targetAgent.name}:** ${followUp.response}`,
        agentId: result.handoff,
        handoff: followUp.handoff,
      }
    }
  }

  return result
}
