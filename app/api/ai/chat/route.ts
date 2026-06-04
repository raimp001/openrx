import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"

export const maxDuration = 60

const CLEAN_BUSY_MESSAGE = "We're busy right now. Please try again in a moment."

const SYSTEM_PROMPTS: Record<string, string> = {
  triage: "You are Nova, a compassionate medical triage assistant at OpenRx Health. Give general education, assess urgency, and advise emergency care for emergency symptoms. Do not diagnose.",
  "care-coordinator": "You are Atlas, a helpful care coordinator at OpenRx Health. Help patients navigate appointments, referrals, records, and next steps.",
  billing: "You are Vera, a healthcare billing assistant at OpenRx Health. Explain billing and insurance concepts without promising coverage.",
  "prior-auth": "You are Rex, an OpenRx prior authorization specialist. Help organize payer requirements, evidence, and appeal next steps.",
  wellness: "You are Ivy, a wellness assistant at OpenRx Health. Give general preventive-care and lifestyle education and remind users to confirm changes with a clinician.",
  general: "You are Atlas, the OpenRx Health assistant. Be helpful, concise, and encourage professional clinical judgment for medical decisions.",
}

function buildContextBlock(patientContext: Record<string, unknown> | null): string {
  if (!patientContext) return ""
  return `\n\nPatient Context:\n- Name: ${String(patientContext.name ?? "Unknown")}\n- Age: ${String(patientContext.age ?? "Unknown")}\n- Allergies: ${Array.isArray(patientContext.allergies) ? patientContext.allergies.join(", ") || "None" : "None"}\n- Medications: ${Array.isArray(patientContext.currentMedications) ? patientContext.currentMedications.join(", ") || "None" : "None"}\n- Insurance: ${String(patientContext.insurance ?? "Unknown")}`
}

function oneShotStream(message: string, model: string): Response {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: message, type: "text_delta" })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", message, model })}\n\n`))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-AI-Model": model,
    },
  })
}

function statusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown }
  const status = Number(candidate.status ?? candidate.statusCode ?? candidate.code)
  return Number.isFinite(status) ? status : undefined
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms + Math.floor(Math.random() * 250)))
}

async function withModelRetry<T>(operation: string, call: () => Promise<T>): Promise<T> {
  const delays = [500, 1000, 2000]
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await call()
    } catch (error) {
      lastError = error
      const status = statusFromError(error)
      const retryable = status === 429 || status === 503
      console.warn("[model-api-boundary]", {
        operation,
        attempt,
        code: status ? `upstream_${status}` : "upstream_model_error",
        retryable,
        exhausted: attempt === 3 || !retryable,
      })
      if (!retryable || attempt === 3) break
      await sleep(delays[attempt - 1] || 2000)
    }
  }

  throw lastError
}

function textFromClaudeResponse(response: Anthropic.Message): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("") || "I couldn't generate a response."
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response

  try {
    const body = await request.json() as {
      messages: Array<{ role: string; content: string }>
      agentType?: string
      sessionId?: string
      patientContext?: Record<string, unknown> | null
      stream?: boolean
    }

    const {
      messages,
      agentType = "general",
      sessionId,
      patientContext = null,
      stream: wantsStream = true,
    } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 })
    }

    const sanitizedMessages = messages
      .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
      .slice(-40)
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content.slice(0, 12000) }))

    if (sanitizedMessages.length === 0) {
      return NextResponse.json({ error: "At least one user message is required" }, { status: 400 })
    }

    const lastUserMessage = [...sanitizedMessages].reverse().find((message) => message.role === "user")?.content || ""
    const deterministicResponse = deterministicClinicalResponse(lastUserMessage)
    if (deterministicResponse) {
      if (wantsStream) return oneShotStream(deterministicResponse, "openrx-rules-engine")
      return NextResponse.json({
        message: deterministicResponse,
        sessionId,
        model: "openrx-rules-engine",
        deterministic: true,
      })
    }

    const systemPrompt = (SYSTEM_PROMPTS[agentType] ?? SYSTEM_PROMPTS.general) + buildContextBlock(patientContext)
    const claudeKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    if (!claudeKey && !openaiKey) {
      if (wantsStream) return oneShotStream(CLEAN_BUSY_MESSAGE, "openrx-clean-error")
      return NextResponse.json({ error: CLEAN_BUSY_MESSAGE }, { status: 503 })
    }

    if (claudeKey) {
      const claude = new Anthropic({ apiKey: claudeKey })
      const response = await withModelRetry("ai-chat-claude", () =>
        claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages: sanitizedMessages,
        })
      )
      const assistantMessage = textFromClaudeResponse(response)
      if (wantsStream) return oneShotStream(assistantMessage, "claude-sonnet-4-6")
      return NextResponse.json({
        message: assistantMessage,
        sessionId,
        model: "claude-sonnet-4-6",
        usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      })
    }

    const openai = new OpenAI({ apiKey: openaiKey! })
    const response = await withModelRetry("ai-chat-openai", () =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...sanitizedMessages,
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
      })
    )
    const assistantMessage = response.choices[0]?.message?.content ?? "No response"
    if (wantsStream) return oneShotStream(assistantMessage, "gpt-4o-mini")
    return NextResponse.json({ message: assistantMessage, sessionId, model: "gpt-4o-mini" })
  } catch (error) {
    const status = statusFromError(error)
    console.error("[AI chat]", { code: status ? `upstream_${status}` : "upstream_model_error" })
    return NextResponse.json({ error: CLEAN_BUSY_MESSAGE }, { status: 503 })
  }
}
