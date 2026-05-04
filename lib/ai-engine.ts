import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { OPENCLAW_CONFIG } from "./openclaw/config"
import { getLiveSnapshotByWallet } from "./live-data.server"
import { parseScreeningIntakeNarrative } from "./screening-intake"
import { nextStepLabel, recommendScreenings, screeningIntakeFromLegacy } from "./screening/recommend"
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

function buildFallbackAgentResponse(agentId: string, message: string): string {
  const trimmedMessage = message.trim()
  const contextLine = trimmedMessage ? `I’m looking at: “${trimmedMessage.slice(0, 140)}${trimmedMessage.length > 140 ? "..." : ""}”` : "I can help with the next step."

  switch (agentId) {
    case "rx":
      return `${contextLine}\n\nFor medications, the safest next move is to confirm the medication name, dose, remaining supply, preferred pharmacy, and prescriber. If this is urgent or you are out of medication, call the pharmacy or prescribing office now while OpenRx queues the refill workflow.`
    case "scheduling":
      return `${contextLine}\n\nFor scheduling, pick the visit type, preferred time window, location preference, and insurance plan. OpenRx can then turn that into a booking request and surface any prep instructions or copay questions.`
    case "billing":
      return `${contextLine}\n\nFor billing, gather the claim number, date of service, insurer, amount owed, and any denial reason. OpenRx can help separate patient balance, insurance balance, and appeal next steps.`
    case "prior-auth":
      return `${contextLine}\n\nFor prior authorization, the next step is to confirm the drug or procedure, payer, diagnosis, urgency, and supporting clinical notes. If there is a denial, OpenRx should prepare the appeal evidence before resubmission.`
    case "screening":
      return `${contextLine}\n\nFor screening, start with age, sex at birth if relevant, family history, symptoms, smoking history, and prior screening dates. OpenRx should prioritize the highest-impact prevention step first.`
    case "trials":
      return `${contextLine}\n\nFor trials, confirm the condition, stage or mutation if known, travel radius, current treatment, and recent labs. OpenRx can then rank studies as possible leads, not final eligibility decisions.`
    case "triage":
      return `${contextLine}\n\nIf symptoms include chest pain, trouble breathing, stroke symptoms, severe allergic reaction, or sudden weakness, call 911 now. Otherwise, note onset, severity, associated symptoms, medications, and whether same-day care is needed.`
    case "second-opinion":
      return `${contextLine}\n\nFor a second opinion, collect the diagnosis, current plan, key test results, medications, and the specific decision you are unsure about. OpenRx should turn that into clinician-ready questions.`
    case "onboarding":
      return `${contextLine}\n\nFor setup, start with identity, contact details, insurance, primary care, pharmacy, medications, and care preferences. OpenRx should ask one question at a time and keep the setup moving.`
    default:
      return `${contextLine}\n\nOpenRx can route this to the right care workflow. Start with the concrete goal, any deadlines, and the blocker: appointment, medication, bill, screening, message, or referral.`
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

function looksLikeScreeningQuestion(agentId: string, message: string): boolean {
  if (agentId === "screening") return true
  const lowered = message.toLowerCase()
  if (/\b(?:hx|fhx|fam hx)\b/.test(lowered)) return true
  return SCREENING_QUERY_TERMS.some((term) => lowered.includes(term))
}

function conciseStatus(status: ScreeningRecommendation["status"]): string {
  return status.replace(/_/g, " ")
}

function formatScreeningRecommendation(rec: ScreeningRecommendation, index: number): string {
  const nextStep = rec.nextSteps[0] ? nextStepLabel(rec.nextSteps[0]) : rec.recommendedNextStep
  const review = rec.requiresClinicianReview ? " Clinician review is needed before using this as a routine screening interval." : ""

  return [
    `${index}. ${rec.screeningName}`,
    `Status: ${conciseStatus(rec.status)} (${rec.riskCategory.replace(/_/g, " ")}).`,
    `Why: ${rec.patientFriendlyExplanation}${review}`,
    `Next: ${nextStep}. ${rec.recommendedNextStep}`,
    `Source: ${rec.sourceSystem}${rec.sourceVersion ? ` ${rec.sourceVersion}` : ""}.`,
  ].join("\n")
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
      "I can help with screening, but I need one more line of context to do it safely.",
      parsed.clarificationQuestion || "Share your age, sex used for screening intervals, symptoms, family history, smoking history, and prior screening dates if known.",
      "",
      "OpenRx can organize the next step, but it does not replace a clinician or guarantee that a test is ordered or covered.",
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

  const actionable = engineResult.recommendations
    .filter((rec) => rec.status !== "not_due")
    .slice(0, 4)
  const recommendations = actionable.length ? actionable : engineResult.recommendations.slice(0, 3)

  if (recommendations.length === 0) {
    return [
      `Based on what you shared (${summarizeParsedScreeningInput(message)}), I do not have enough source-backed detail to show a screening recommendation safely.`,
      "Next: request care navigation or add prior screening dates, symptoms, family history diagnosis ages, and smoking pack-years if relevant.",
      "OpenRx can organize the next step, but it does not replace a clinician.",
    ].join("\n")
  }

  const summary = summarizeParsedScreeningInput(message)
  return [
    `Based on what you shared: ${summary}.`,
    "",
    ...recommendations.map((rec, index) => formatScreeningRecommendation(rec, index + 1)),
    "",
    "What OpenRx should do next: start a navigation request, prepare a clinician summary, and confirm prior screening dates/family diagnosis age before treating this as routine screening.",
    "Safety note: this is guideline-based education and care navigation support, not a diagnosis, medical order, or insurance approval guarantee.",
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

async function getPatientContext(walletAddress?: string): Promise<string> {
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
- Be concise — most responses should be 2-4 sentences unless the user asks for detail.
- If you need to hand off to another agent, end your message with [HANDOFF:agentId] (e.g., [HANDOFF:scheduling]).
- Available agents to hand off to: ${(agent.canMessage as readonly string[]).join(", ")}
- Never make up data that isn't in the patient context above.`

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
          max_tokens: 600,
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
        max_tokens: 500,
        temperature: 0.7,
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
    if (looksLikeScreeningQuestion(agentId, message)) {
      const deterministic = buildDeterministicScreeningResponse(message)
      return { response: deterministic, agentId: "screening" }
    }
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

  const results = await Promise.all(
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
  return results
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
