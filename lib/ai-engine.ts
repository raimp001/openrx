import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { OPENCLAW_CONFIG } from "./openclaw/config"
import { getLiveSnapshotByWallet } from "./live-data.server"
import { parseScreeningIntakeNarrative } from "./screening-intake"
import { nextStepLabel, recommendScreenings, screeningIntakeFromLegacy } from "./screening/recommend"
import { getGuidelineSource } from "./screening/sources"
import { parseCareSearchQuery, searchNpiCareDirectory } from "./npi-care-search"
import { DEMO_SCENARIOS, type DemoScenario } from "./demo/prior-auth"
import type { ScreeningRecommendation } from "./screening/types"
import { detectRedFlagText, emergencyResponse } from "./red-flag"
import {
  CLEAN_MODEL_BUSY_MESSAGE,
  modelErrorCode,
  requestIdFromModelError,
  withModelApiBoundary,
} from "./openclaw/model-boundary"

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

function buildFallbackAgentResponse(agentId: string): string {
  switch (agentId) {
    case "rx":
      return `What to do now\nConfirm the exact medication names, doses, kidney history, allergies, pregnancy status if relevant, and why the medication is being used. Do not stop or combine prescribed medication without clinician/pharmacist guidance. If this is a refill emergency or you are out of a critical medicine, call the pharmacy or prescriber now.\n\nReferences\n- [MedlinePlus: Medicines](https://medlineplus.gov/medicines.html)\n- [FDA: Drug interactions](https://www.fda.gov/drugs/resources-you-drugs/drug-interactions-what-you-should-know)\n\nSafety note\nThis is medication-safety education, not a prescription change or substitute for a clinician/pharmacist review.`
    case "scheduling":
      return `What to do now\nTell me the visit type, location, urgency, preferred time window, and insurance plan. If the question is clinical, I’ll answer first; if you ask to find care, OpenRx can then search options and prepare a scheduling request.\n\nReferences\n- [MedlinePlus: Choosing a primary care provider](https://medlineplus.gov/ency/article/001939.htm)\n\nSafety note\nOpenRx can stage a scheduling request, but it does not confirm appointments or place medical orders by itself.`
    case "billing":
      return `What to do now\nUse the claim number, date of service, insurer, amount owed, EOB/denial reason, and whether the provider is in-network. OpenRx can separate patient responsibility from insurer responsibility and draft next questions for the plan or billing office.\n\nReferences\n- [CMS: Understanding health care bills](https://www.cms.gov/medical-bill-rights/help/guides/understanding-health-care-bills)\n\nSafety note\nThis is billing navigation, not a legal determination or coverage guarantee.`
    case "prior-auth":
      return `What to do now\nConfirm the drug/procedure, payer, diagnosis, urgency, prior treatments, and supporting clinical notes. If there is a denial, collect the denial reason and deadline before drafting an appeal.\n\nReferences\n- [CMS: Electronic prior authorization](https://www.cms.gov/priorities/electronic-prior-authorization/overview)\n\nSafety note\nOpenRx can help prepare and track prior-auth work, but it cannot guarantee approval.`
    case "screening":
      return `What to do now\nShare age, sex used for screening intervals, family history, symptoms, smoking pack-years/quit date, and prior screening dates. I’ll answer directly in chat and cite the relevant guideline links.\n\nReferences\n- [USPSTF recommendations](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations)\n- [CDC cancer screening tests](https://www.cdc.gov/cancer/prevention/screening.html)\n\nSafety note\nThis is screening decision support, not a diagnosis or order.`
    case "trials":
      return `What to do now\nConfirm condition, stage, mutation/biomarker if known, current treatment, recent labs, and travel radius. I can summarize likely trial leads, but final eligibility must come from the study team.\n\nReferences\n- [ClinicalTrials.gov](https://clinicaltrials.gov/)\n- [NCI: Clinical trials information](https://www.cancer.gov/research/participate/clinical-trials)\n\nSafety note\nTrial matching is informational and does not determine eligibility.`
    case "triage":
      return `What to do now\nIf symptoms include chest pain, trouble breathing, stroke symptoms, severe allergic reaction, severe bleeding, sudden weakness, or fainting, call 911 or seek emergency care now. Otherwise, tell me onset, severity, associated symptoms, medications, and whether symptoms are worsening.\n\nReferences\n- [MedlinePlus: When to use the emergency room](https://medlineplus.gov/ency/patientinstructions/000593.htm)\n- [CDC: Stroke signs and symptoms](https://www.cdc.gov/stroke/signs-symptoms/index.html)\n\nSafety note\nThis is safety triage guidance, not a diagnosis. Emergency symptoms should not wait for chat.`
    case "second-opinion":
      return `What to do now\nShare the diagnosis, current plan, key test results, medications, and the decision you are unsure about. I’ll turn that into clinician-ready questions and identify what information is missing.\n\nReferences\n- [NCI: Finding health care services](https://www.cancer.gov/about-cancer/managing-care/services)\n\nSafety note\nThis supports preparation for medical review; it does not replace an examining clinician.`
    case "onboarding":
      return `What to do now\nStart with only what is needed: contact preference, primary care, pharmacy, medications, insurance if you want cost/network help, and the care goal you want OpenRx to handle first.\n\nReferences\n- [HealthIT.gov: Patient access to health information](https://www.healthit.gov/topic/patient-access-health-information)\n\nSafety note\nOnly share sensitive data when you want OpenRx to use it for care navigation.`
    default:
      return `What to do now\nAsk the clinical question in plain language and include the few details that change the answer: age, sex when relevant, symptoms, medication names/doses, diagnosis, prior test dates, and urgency. I’ll answer in chat first and only hand off when an action is needed.\n\nReferences\n- [MedlinePlus](https://medlineplus.gov/)\n- [CDC](https://www.cdc.gov/)\n\nSafety note\nOpenRx is clinical decision support and care navigation, not a diagnosis or substitute for clinician judgment.`
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
const CARE_SEARCH_ELIGIBLE_AGENTS = new Set(["scheduling", "coordinator", "screening", "wellness"])
const ZIP_ONLY_PATTERN = /^\s*\d{5}(?:-\d{4})?\s*$/
const EXPLICIT_CARE_SEARCH_PATTERN =
  /\b(find|search|locate|near me|nearby|phone numbers?|who to call|primary care|pcp|physician|doctor|clinic|radiology|imaging center|mammogram center|colonoscopy center|lab near|laboratory)\b/i

function looksLikeScreeningQuestion(agentId: string, message: string): boolean {
  if (!SCREENING_ELIGIBLE_AGENTS.has(agentId)) return false
  if (agentId === "screening") return true
  const lowered = message.toLowerCase()
  if (/\b(?:hx|fhx|fam hx)\b/.test(lowered)) return true
  return SCREENING_QUERY_TERMS.some((term) => lowered.includes(term))
}

function looksLikeCareSearchQuestion(agentId: string, message: string): boolean {
  if (agentId === "scheduling") return true
  if (!CARE_SEARCH_ELIGIBLE_AGENTS.has(agentId)) return false
  return EXPLICIT_CARE_SEARCH_PATTERN.test(message)
}

function lastCareSearchContext(messages: ConversationMessage[]): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .reverse()

  return userMessages.find((message) => /\b(find|search|primary care|pcp|physician|doctor|clinic|radiology|imaging|mammogram|ldct|colonoscopy|lab|laboratory)\b/i.test(message)) || ""
}

function continuesCareSearch(message: string, history: ConversationMessage[]): boolean {
  return ZIP_ONLY_PATTERN.test(message.trim()) && Boolean(lastCareSearchContext(history))
}

function buildCareSearchQuery(message: string, history: ConversationMessage[]): string {
  const trimmed = message.trim()
  const previous = lastCareSearchContext(history)
  if (ZIP_ONLY_PATTERN.test(trimmed) && previous) {
    if (/\b(screening site|these recommendations)\b/i.test(previous)) {
      return `Find primary care near ${trimmed}`
    }
    return `${previous} near ${trimmed}`
  }
  if (/\b\d{5}(?:-\d{4})?\b/.test(trimmed) && previous && !/\b(find|search|primary care|pcp|physician|doctor|clinic|radiology|imaging|mammogram|ldct|colonoscopy|lab|laboratory)\b/i.test(trimmed)) {
    return `${previous} ${trimmed}`
  }
  return trimmed
}

function phoneHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "")
  if (!cleaned) return ""
  if (cleaned.startsWith("+")) return `tel:${cleaned}`
  if (cleaned.length === 10) return `tel:+1${cleaned}`
  return `tel:${cleaned}`
}

async function buildCareSearchChatResponse(message: string, history: ConversationMessage[]): Promise<string> {
  const query = buildCareSearchQuery(message, history)
  const parsed = parseCareSearchQuery(query)

  // Chat care navigation intentionally starts with ZIP. This avoids treating
  // clinical wording in an action prompt as a city and keeps the first search local.
  if (!/\b\d{5}(?:-\d{4})?\b/.test(query)) {
    return [
      "Answer",
      "I can help find public clinic phone numbers, but I need the ZIP code first.",
      "",
      "Question to refine this",
      "What ZIP code should I search near?",
      "",
      "Safety note",
      "OpenRx can list public directory options. It cannot book directly unless that clinic is connected to OpenRx.",
    ].join("\n\n")
  }

  if (!parsed.ready) {
    return [
      "Answer",
      "I can help find public clinic phone numbers, but I need the ZIP code first.",
      "",
      "Question to refine this",
      parsed.clarificationQuestion || "What ZIP code should I search near?",
      "",
      "Safety note",
      "OpenRx can list public directory options. It cannot book directly unless that clinic is connected to OpenRx.",
    ].join("\n\n")
  }

  try {
    const result = await searchNpiCareDirectory(query, { limit: 8 })
    const withPhones = result.matches.filter((match) => match.phone).slice(0, 5)
    const matches = withPhones.length ? withPhones : result.matches.slice(0, 5)
    const location = result.parsed.zip || [result.parsed.city, result.parsed.state].filter(Boolean).join(", ")

    if (matches.length === 0) {
      return [
        "Answer",
        `I could not find a clean match near ${location || "that area"}.`,
        "",
        "What to do now",
        "- Send me a nearby ZIP code, city, or a larger radius and I can search more people around that area.",
        "- You can also tell me the exact service: primary care, GI/colonoscopy, mammogram, lung CT, lab, or genetics.",
        "",
        "Safety note",
        "NPI directory results are public listings, not a guarantee that a clinic accepts your insurance or is taking new patients.",
      ].join("\n\n")
    }

    const lines = matches.map((match, index) => {
      const phone = match.phone ? `[${match.phone}](${phoneHref(match.phone)})` : "phone not listed"
      const specialty = match.specialty || "clinic"
      const address = match.fullAddress || "address not listed"
      return `- ${index + 1}. ${match.name}: ${phone}. ${specialty}. ${address}.`
    })

    return [
      "Answer",
      `Here are public clinic options near ${location || "that area"}. Call first to confirm they take your insurance and are accepting new patients.`,
      "",
      "Care options",
      ...lines,
      "",
      "What to ask when calling",
      "- Are you accepting new patients?",
      "- Do you take my insurance?",
      "- Can this clinician order or coordinate the screening study I need?",
      "- What records, referral, or prior authorization do I need before scheduling?",
      "- If none of these work, tell me and I can search more people around that area.",
      "",
      "Safety note",
      "OpenRx is not booking directly yet unless the clinic joins the platform. These are NPI public directory matches, so call to verify availability, insurance, and whether they can order the study.",
    ].join("\n\n")
  } catch {
    return [
      "Answer",
      "I could not reach the public NPI clinic directory right now.",
      "",
      "What to do now",
      "- Send me the ZIP code again in a moment, or give a nearby city/state and I can retry.",
      "- If the first search fails, let me know and I can search more people around that area.",
      "",
      "Safety note",
      "OpenRx can list contact options, but direct booking depends on clinics joining the platform.",
    ].join("\n\n")
  }
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

function formatScreeningRecommendation(rec: ScreeningRecommendation): string {
  const nextStep = rec.nextSteps[0] ? nextStepLabel(rec.nextSteps[0]) : rec.recommendedNextStep
  const review = rec.requiresClinicianReview ? " Review this with a clinician." : ""

  return `- ${rec.screeningName}: ${conciseStatus(rec.status)}. ${rec.patientFriendlyExplanation}${review} Next: ${nextStep}.`
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
      ...items.map((rec) => formatScreeningRecommendation(rec)),
    ]
  })
}

function buildReferenceList(recommendations: ScreeningRecommendation[]): string[] {
  const links = new Map<string, string>()
  recommendations.forEach((rec) => {
    const source = getGuidelineSource(rec.sourceId)
    if (source?.url) links.set(`${source.organization}: ${source.topic} (${source.versionOrDate})`, source.url)
  })
  links.set("CDC: Cancer screening tests (accessed 2026-05)", "https://www.cdc.gov/cancer/prevention/screening.html")
  links.set("ACS: Cancer screening guidelines (accessed 2026-05)", "https://www.cancer.org/cancer/screening/american-cancer-society-guidelines-for-the-early-detection-of-cancer.html")
  return Array.from(links.entries()).map(([label, url], index) => `${index + 1}. [${label}](${url})`)
}

function buildGeneralScreeningReferences(): string[] {
  return [
    "1. [USPSTF: Preventive screening recommendations (accessed 2026-05)](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations)",
    "2. [CDC: Cancer screening tests (accessed 2026-05)](https://www.cdc.gov/cancer/prevention/screening.html)",
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

export function buildDeterministicScreeningResponse(message: string): string {
  const parsed = parseScreeningIntakeNarrative(message)

  if (!parsed.ready) {
    return [
      "I need one missing detail before giving screening guidance safely.",
      parsed.clarificationQuestion || "Share your age, sex used for screening intervals, symptoms, family history, smoking history, and prior screening dates if known.",
      "",
      "References",
      ...buildGeneralScreeningReferences(),
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
    const hasFamilyHistory = parsed.extracted.familyHistory.length > 0
    return [
      hasFamilyHistory
        ? "OpenRx does not yet have a source-backed routine screening rule for that family-history pattern."
        : "OpenRx does not yet have enough source-backed detail to show a routine screening recommendation safely.",
      "",
      "What this means",
      hasFamilyHistory
        ? "- A parent's lymphoma or other blood cancer history can be worth discussing with a clinician, especially with multiple cancers, unusually young diagnoses, or a known inherited mutation."
        : "- Screening choices depend on age, sex or organs relevant to screening, symptoms, inherited risk, smoking exposure, and prior test results.",
      "- I should not invent a screening interval when the available guideline path is unclear.",
      "",
      "Question to refine this",
      "What sex was assigned at birth, and do you have concerning symptoms, a known inherited cancer mutation, smoking history, or prior screening results?",
      "",
      "References",
      ...buildGeneralScreeningReferences(),
      "",
      "Safety note: OpenRx is clinical decision support, not a diagnosis, medical order, or insurance approval.",
    ].join("\n\n")
  }

  const followUp = buildFollowUpQuestion(recommendations)
  const hasUnmappedHematologicFamilyHistory = parsed.extracted.familyHistory.some((history) =>
    /lymphoma|hematologic|leukemia|blood cancer/i.test(history)
  )
  return [
    "Your guideline-backed screening plan",
    "",
    ...(hasUnmappedHematologicFamilyHistory
      ? [
          "Family history note",
          "- A parent's lymphoma or hematologic cancer history does not by itself add a routine solid-tumor screening test in OpenRx's encoded rules. Discuss unusual or multiple family cancers with a clinician.",
          "",
        ]
      : []),
    ...formatScreeningGroups(recommendations),
    "",
    ...(followUp ? ["Question to refine this", followUp, ""] : []),
    "References",
    ...buildReferenceList(recommendations),
    "",
    "Safety note: this is decision support, not a diagnosis, order, or coverage guarantee.",
  ].join("\n\n")
}

function matchPriorAuthDemoScenario(agentId: string, message: string): DemoScenario | null {
  if (agentId !== "prior-auth") return null
  const normalized = message.toLowerCase()
  if (normalized.includes("teclistamab") || normalized.includes("tecvayli")) {
    return DEMO_SCENARIOS.find((scenario) => scenario.id === "teclistamab-rrmm") || null
  }
  if (normalized.includes("semaglutide") || normalized.includes("ozempic")) {
    return DEMO_SCENARIOS.find((scenario) => scenario.id === "semaglutide-t2dm") || null
  }
  if (normalized.includes("car-t") || normalized.includes("cart") || normalized.includes("dlbcl")) {
    return DEMO_SCENARIOS.find((scenario) => scenario.id === "cart-dlbcl") || null
  }
  return null
}

export function buildDeterministicPriorAuthResponse(scenario: DemoScenario): string {
  const references = scenario.sources.map(
    (source, index) => `${index + 1}. [${source.organization}: ${source.label} (${source.version})](${source.url})`
  )
  return [
    `This synthetic ${scenario.specialty.toLowerCase()} denial can be prepared for appeal review, but OpenRx cannot confirm approval or submit to a payer from chat.`,
    "",
    "Why this may be appealable",
    `- Denial reason: ${scenario.denialReason}`,
    `- Requested next step: ${scenario.request}`,
    `- Evidence boundary: ${scenario.sourceBoundary}`,
    "",
    "What to assemble",
    ...scenario.documentChecklist.map((item) => `- ${item}`),
    "",
    "Next step",
    "- [Open the denial-to-appeal sandbox](/demo) to retrieve evidence metadata, generate a draft, and view a simulated FHIR PA trace.",
    "",
    "References",
    ...references,
    "",
    "Safety note: an authorized clinician must review patient-specific medical necessity, current guideline access, payer criteria, and the final packet before any real submission.",
  ].join("\n")
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
  return withModelApiBoundary("ai-engine-openai-chat", () =>
    openai.chat.completions.create(params, { timeout: 20000 })
  )
}

// ── Core Agent Engine ────────────────────────────────────
export async function runAgent(params: {
  agentId: string
  message: string
  screeningContext?: string
  sessionId?: string
  walletAddress?: string
  // Pre-fetched context can be passed in to avoid re-fetching during fan-out.
  _cachedPatientContext?: string
}): Promise<{ response: string; agentId: string; handoff?: string }> {
  const { agentId, message, screeningContext, sessionId, walletAddress } = params
  const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === agentId)

  if (!agent) {
    return { response: "Unknown agent.", agentId }
  }

  const sessionKey = sessionId || `${agentId}-default`
  const redFlag = detectRedFlagText(message)
  if (redFlag) {
    const response = emergencyResponse(redFlag)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("triage", "red_flag_triggered", redFlag.category, "portal")
    return { response, agentId: "triage" }
  }

  const demoPriorAuthScenario = matchPriorAuthDemoScenario(agentId, message)
  if (demoPriorAuthScenario) {
    const response = buildDeterministicPriorAuthResponse(demoPriorAuthScenario)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("prior-auth", "deterministic-pa-demo-response", demoPriorAuthScenario.id, "portal")
    return { response, agentId: "prior-auth" }
  }

  const screeningMessage = screeningContext?.trim() || message
  const isScreeningIntent = looksLikeScreeningQuestion(agentId, screeningMessage)
  const requestsCareNavigation = /\b(find|search|locate|near me|nearby|phone numbers?|who to call)\b/i.test(message)

  if (isScreeningIntent && !requestsCareNavigation) {
    const response = buildDeterministicScreeningResponse(screeningMessage)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("screening", "deterministic-screening-response", "Rules-based screening response generated.", "portal")
    return { response, agentId: "screening" }
  }

  const careSearchHistory = getConversation(sessionKey)
  if (looksLikeCareSearchQuestion(agentId, message) || continuesCareSearch(message, careSearchHistory)) {
    const history = careSearchHistory
    const response = await buildCareSearchChatResponse(message, history)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("scheduling", "npi-care-search-response", "Public directory search response generated.", "portal")
    return { response, agentId: "scheduling" }
  }

  if (isScreeningIntent) {
    const response = buildDeterministicScreeningResponse(screeningMessage)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("screening", "deterministic-screening-response", "Rules-based screening response generated.", "portal")
    return { response, agentId: "screening" }
  }

  const claude = getClaudeClient()

  // Keep the demo path useful even when the hosted model provider is unavailable.
  if (!claude && !process.env.OPENAI_API_KEY) {
    return { response: buildFallbackAgentResponse(agentId), agentId }
  }

  const patientContext = params._cachedPatientContext ?? await getPatientContext(walletAddress)

  // Build system prompt with patient context
  const systemPrompt = `${agent.systemPrompt}

${patientContext}

IMPORTANT RULES:
- You ARE ${agent.name}. Stay in character.
- Use the patient data above to give SPECIFIC answers (reference their actual meds, appointments, claims by name).
- Behave like a clinical evidence chat assistant: answer directly in this chat first. Do not tell the user to open another page just to see clinical guidance.
- Keep patient-facing answers short, plain, and skimmable. Prefer 3-6 bullets. Avoid long paragraphs. Use simple words.
- For clinical, medication, symptom, screening, prevention, billing, or prior-auth questions, use this visible structure when useful:
  Answer
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
        const completion = await withModelApiBoundary("ai-engine-claude-reasoning", () =>
          claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 16000,
            thinking: { type: "enabled", budget_tokens: 10000 },
            system: systemPrompt,
            messages: anthropicMessages,
          })
        )
        response = completion.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("") || "I couldn't process that. Could you try again?"
      } else {
        const completion = await withModelApiBoundary("ai-engine-claude-chat", () =>
          claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1200,
            system: systemPrompt,
            messages: anthropicMessages,
          })
        )
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
    logAction(agentId, "responded", "Answer generated.", "portal")

    return { response, agentId, handoff }
  } catch (error: unknown) {
    console.error("[agent-model]", {
      agentId,
      code: modelErrorCode(error),
      requestId: requestIdFromModelError(error),
    })
    return { response: CLEAN_MODEL_BUSY_MESSAGE, agentId }
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
      logAction("coordinator", "routed", `Handoff requested for ${targetAgent.name}.`)

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

// ── Streaming Agent ──────────────────────────────────────
// Yields text chunks as the model generates them so the UI can render
// progressively (Claude.ai-style). Falls back to one synchronous chunk
// when neither Anthropic nor OpenAI keys are configured (preserving the
// fallback experience).
export async function* runAgentStream(params: {
  agentId: string
  message: string
  screeningContext?: string
  sessionId?: string
  walletAddress?: string
}): AsyncGenerator<string, { agentId: string; finalText: string; handoff?: string }> {
  const { agentId, message, screeningContext, sessionId, walletAddress } = params
  const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === agentId)
  if (!agent) {
    return { agentId, finalText: "Unknown agent." }
  }

  const sessionKey = sessionId || `${agentId}-default`
  const redFlag = detectRedFlagText(message)
  if (redFlag) {
    const response = emergencyResponse(redFlag)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("triage", "red_flag_triggered", redFlag.category, "portal")
    yield response
    return { agentId: "triage", finalText: response }
  }

  const demoPriorAuthScenario = matchPriorAuthDemoScenario(agentId, message)
  if (demoPriorAuthScenario) {
    const response = buildDeterministicPriorAuthResponse(demoPriorAuthScenario)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("prior-auth", "deterministic-pa-demo-response", demoPriorAuthScenario.id, "portal")
    yield response
    return { agentId: "prior-auth", finalText: response }
  }

  const screeningMessage = screeningContext?.trim() || message
  const isScreeningIntent = looksLikeScreeningQuestion(agentId, screeningMessage)
  const requestsCareNavigation = /\b(find|search|locate|near me|nearby|phone numbers?|who to call)\b/i.test(message)

  if (isScreeningIntent && !requestsCareNavigation) {
    const response = buildDeterministicScreeningResponse(screeningMessage)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("screening", "deterministic-screening-response", "Rules-based screening response generated.", "portal")
    yield response
    return { agentId: "screening", finalText: response }
  }

  const careSearchHistory = getConversation(sessionKey)
  if (looksLikeCareSearchQuestion(agentId, message) || continuesCareSearch(message, careSearchHistory)) {
    const history = careSearchHistory
    const response = await buildCareSearchChatResponse(message, history)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("scheduling", "npi-care-search-response", "Public directory search response generated.", "portal")
    yield response
    return { agentId: "scheduling", finalText: response }
  }

  // Deterministic screening path: emit the response in one chunk.
  if (isScreeningIntent) {
    const response = buildDeterministicScreeningResponse(screeningMessage)
    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", response)
    logAction("screening", "deterministic-screening-response", "Rules-based screening response generated.", "portal")
    yield response
    return { agentId: "screening", finalText: response }
  }

  const claude = getClaudeClient()
  if (!claude && !process.env.OPENAI_API_KEY) {
    const fallback = buildFallbackAgentResponse(agentId)
    yield fallback
    return { agentId, finalText: fallback }
  }

  const patientContext = await getPatientContext(walletAddress)
  const systemPrompt = `${agent.systemPrompt}

${patientContext}

IMPORTANT RULES:
- You ARE ${agent.name}. Stay in character.
- Use the patient data above to give SPECIFIC answers (reference their actual meds, appointments, claims by name).
- Behave like a clinical evidence chat assistant: answer directly in this chat first. Do not tell the user to open another page just to see clinical guidance.
- Keep patient-facing answers short, plain, and skimmable. Prefer 3-6 bullets. Avoid long paragraphs. Use simple words.
- For clinical, medication, symptom, screening, prevention, billing, or prior-auth questions, use this visible structure when useful:
  Answer
  What to do now
  References
  Safety note
- Include 2-5 relevant, trustworthy inline Markdown links in References when guidelines or patient education sources are relevant. Prefer USPSTF, CDC, NIH/NCI, MedlinePlus, FDA, CMS, and major society guideline pages.
- Ask at most one concise follow-up question when a missing detail changes the answer. Otherwise provide the best cautious answer from available context.
- Keep actions optional. Only include [HANDOFF:agentId] when the user explicitly asks to find care, schedule, submit, pay, appeal, or otherwise take an operational action.
- Available agents to hand off to: ${(agent.canMessage as readonly string[]).join(", ")}
- Never make up patient-specific data, citations, orders, coverage, or diagnoses that are not supported by the patient context or cited source.`

  const conv = getConversation(sessionKey)
  let collected = ""

  try {
    if (claude) {
      const anthropicMessages: Anthropic.MessageParam[] = [
        ...conv.filter((m) => m.role !== "system").map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ]

      const stream = await withModelApiBoundary("ai-engine-claude-stream", async () =>
        claude.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          system: systemPrompt,
          messages: anthropicMessages,
        })
      )

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const chunk = event.delta.text
          collected += chunk
          yield chunk
        }
      }
    } else {
      const completion = await withModelApiBoundary("ai-engine-openai-stream", () =>
        openai.chat.completions.create(
          {
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              ...conv,
              { role: "user", content: message },
            ],
            max_tokens: 1000,
            temperature: 0.3,
            stream: true,
          },
          { timeout: 30000 }
        )
      )

      for await (const chunk of completion) {
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) {
          collected += delta
          yield delta
        }
      }
    }

    let handoff: string | undefined
    let finalText = collected
    const handoffMatch = finalText.match(/\[HANDOFF:(\w[\w-]*)\]/)
    if (handoffMatch) {
      handoff = handoffMatch[1]
      finalText = finalText.replace(/\[HANDOFF:\w[\w-]*\]/, "").trim()
    }

    addToConversation(sessionKey, "user", message)
    addToConversation(sessionKey, "assistant", finalText)
    logAction(agentId, "responded", "Answer generated.", "portal")

    return { agentId, finalText, handoff }
  } catch (error: unknown) {
    console.error("[agent-stream-model]", {
      agentId,
      code: modelErrorCode(error),
      requestId: requestIdFromModelError(error),
    })
    if (collected.length === 0) yield CLEAN_MODEL_BUSY_MESSAGE
    return { agentId, finalText: collected || CLEAN_MODEL_BUSY_MESSAGE }
  }
}
