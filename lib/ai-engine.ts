import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { OPENCLAW_CONFIG } from "./openclaw/config"
import { getLiveSnapshotByWallet } from "./live-data.server"

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

// ── Patient Context Builder ──────────────────────────────
async function getPatientContext(walletAddress?: string): Promise<string> {
  const snapshot = await getLiveSnapshotByWallet(walletAddress)
  if (!snapshot.patient) {
    return "CURRENT PATIENT DATA: No live patient profile found. Ask the user to connect a wallet and complete onboarding."
  }

  const patient = snapshot.patient
  const activeMedications = snapshot.prescriptions.filter((prescription) => prescription.status === "active")
  const upcomingAppointments = snapshot.appointments
    .filter((appointment) => new Date(appointment.scheduled_at).getTime() > Date.now())
    .slice(0, 5)
  const unreadCount = snapshot.messages.filter((message) => !message.read).length
  const pcp = snapshot.physicians.find((physician) => physician.id === patient.primary_physician_id)

  return `
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
}

// ── Core Agent Engine ────────────────────────────────────
export async function runAgent(params: {
  agentId: string
  message: string
  sessionId?: string
  walletAddress?: string
}): Promise<{ response: string; agentId: string; handoff?: string }> {
  const { agentId, message, sessionId, walletAddress } = params
  const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === agentId)

  if (!agent) {
    return { response: "Unknown agent.", agentId }
  }

  const claude = getClaudeClient()

  // Fail closed when no live model key is configured.
  if (!claude && !process.env.OPENAI_API_KEY) {
    return { response: "AI service is unavailable. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.", agentId }
  }

  const sessionKey = sessionId || `${agentId}-default`
  const patientContext = await getPatientContext(walletAddress)

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
    const message = error instanceof Error ? error.message : String(error)
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined
    console.error(`Agent ${agentId} error:`, message || error)

    if (status === 401) {
      return { response: "AI service authentication failed. Verify OPENAI_API_KEY.", agentId }
    }

    return { response: "AI service is temporarily unavailable. Please retry shortly.", agentId }
  }
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
