import { requireAuth } from "@/lib/api-auth"
/**
 * AI Chat API — OpenRx
 *
 * Upgraded to Claude Sonnet 4.6 with Server-Sent Events streaming.
 * Falls back to OpenAI gpt-4o-mini if ANTHROPIC_API_KEY is not set.
 *
 * Endpoints:
 *   POST /api/ai/chat          — streaming chat response (text/event-stream)
 *   GET  /api/ai/chat          — session history
 */

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"

export const maxDuration = 60

// ── System prompts ────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  triage: `You are Rex, a compassionate and knowledgeable medical triage AI at OpenRx Health.
Your role:
1. Help patients understand their symptoms and assess urgency
2. Provide general health guidance (not medical advice)
3. Recommend appropriate next steps (ER, urgent care, schedule appointment, home care)
4. Always emphasize consulting a real doctor for diagnosis and treatment
5. Be empathetic, clear, and professional
6. Ask clarifying questions about symptoms, duration, severity, and medical history

CRITICAL: Always remind users you are an AI and cannot replace professional medical advice.
For emergencies (chest pain, difficulty breathing, stroke symptoms), always advise calling 911 immediately.`,

  "care-coordinator": `You are Rex, a helpful care coordinator AI at OpenRx Health.
Your role:
1. Help patients navigate their healthcare journey
2. Assist with appointment scheduling questions and preparation
3. Explain what to expect from different types of medical visits
4. Help understand prescriptions and medication instructions
5. Clarify insurance and billing questions at a general level
6. Connect patients with the right healthcare resources

Be friendly, organized, and proactive in anticipating patient needs.`,

  billing: `You are Rex, a knowledgeable healthcare billing assistant at OpenRx Health.
Your role:
1. Explain healthcare costs and payment options
2. Help understand insurance coverage concepts
3. Guide patients through payment and billing processes
4. Explain prior authorization status and next steps
5. Help with billing inquiries and payment history questions

Always be transparent about costs and never make commitments about specific coverage amounts.`,

  "prior-auth": `You are Rex, an AI prior authorization specialist at OpenRx Health.
You help clinicians and staff:
1. Understand prior authorization requirements by drug and payer
2. Submit FHIR Da Vinci PAS-compliant PA requests
3. Evaluate PA approval likelihood using clinical criteria
4. Generate appeal letters for denied authorizations with trial citations
5. Track PA status and escalate urgent cases

You have access to payer rules for: teclistamab, CAR-T therapies, gilteritinib, pembrolizumab,
dupilumab, adalimumab/biosimilars, and semaglutide. Always cite NCCN guidelines and key trials.
For REMS drugs: always flag the enrollment requirement before submission.`,

  wellness: `You are Rex, a supportive wellness coach AI at OpenRx Health.
Your role:
1. Provide evidence-based wellness tips and lifestyle recommendations
2. Help patients set and track health goals
3. Offer guidance on nutrition, exercise, sleep, and stress management
4. Help interpret health metrics and vital signs trends
5. Encourage preventive healthcare practices

Always remind users to consult their doctor before making significant lifestyle changes.`,

  general: `You are Rex, the AI health assistant at OpenRx Health — the most advanced prior authorization and care coordination platform in healthcare.

You help with:
- Prior authorization strategy, submissions, and appeals (your specialty)
- General health questions and platform navigation
- Understanding lab results, medications, and vitals
- Insurance and billing questions
- Clinical trial matching

OpenRx capabilities you can reference: FHIR R4 Da Vinci PAS submissions, real-time payer rules engine (LCD/NCD + NCCN), Hermes autonomous research agent, 12 specialized AI agents.

Always be helpful, accurate, and encourage professional consultation for clinical decisions.`,
}

// ── Streaming response builder ────────────────────────────────────────

function buildContextBlock(patientContext: Record<string, unknown> | null): string {
  if (!patientContext) return ""
  return `\n\nPatient Context (personalize responses with this):
- Name: ${String(patientContext.name ?? "Unknown")}
- Age: ${String(patientContext.age ?? "Unknown")}
- Allergies: ${Array.isArray(patientContext.allergies) ? patientContext.allergies.join(", ") || "None" : "None"}
- Medications: ${Array.isArray(patientContext.currentMedications) ? patientContext.currentMedications.join(", ") || "None" : "None"}
- Insurance: ${String(patientContext.insurance ?? "Unknown")}
- Recent vitals: ${patientContext.recentVitals ? JSON.stringify(patientContext.recentVitals) : "None"}`
}

function buildFallbackChatMessage(agentType: string, messages: Array<{ role: string; content: string }>): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content?.trim()
  const context = lastUserMessage
    ? `I’m looking at: “${lastUserMessage.slice(0, 140)}${lastUserMessage.length > 140 ? "..." : ""}”`
    : "I can help with the next step."

  if (agentType === "billing") {
    return `${context}\n\nFor billing, start with the claim number, date of service, payer, balance, and denial reason if present. OpenRx can then separate what needs appeal, payment review, or a call to the insurer.`
  }

  if (agentType === "prior-auth") {
    return `${context}\n\nFor prior authorization, confirm the drug or procedure, payer, diagnosis, urgency, and supporting notes. If this is a denial, prepare the appeal evidence before resubmitting.`
  }

  if (agentType === "triage") {
    return `${context}\n\nIf this involves chest pain, trouble breathing, stroke symptoms, severe allergic reaction, or sudden weakness, call 911 now. Otherwise, note onset, severity, associated symptoms, and whether same-day care is needed.`
  }

  return `${context}\n\nThe next useful step is to name the care goal and the blocker: appointment, medication, bill, screening, message, referral, or records. OpenRx can route from there and keep the work moving in the background.`
}

function fallbackResponse(params: {
  message: string
  sessionId?: string
  stream: boolean
}) {
  if (!params.stream) {
    return NextResponse.json({
      message: params.message,
      sessionId: params.sessionId,
      model: "openrx-safe-fallback",
      fallback: true,
    })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: params.message, type: "text_delta" })}\n\n`))
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "done", message: params.message, model: "openrx-safe-fallback", fallback: true })}\n\n`)
      )
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-AI-Model": "openrx-safe-fallback",
    },
  })
}

// ── POST — streaming chat ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
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

    const validRoles = new Set(["user", "assistant"])
    const sanitizedMessages = messages
      .filter((m) => validRoles.has(m.role) && typeof m.content === "string")
      .slice(-40)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }))

    if (sanitizedMessages.length === 0) {
      return NextResponse.json({ error: "At least one user message is required" }, { status: 400 })
    }

    const systemPrompt = (SYSTEM_PROMPTS[agentType] ?? SYSTEM_PROMPTS.general) + buildContextBlock(patientContext)

    const claudeKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const fallbackMessage = buildFallbackChatMessage(agentType, sanitizedMessages)

    if (!claudeKey && !openaiKey) {
      return fallbackResponse({ message: fallbackMessage, sessionId, stream: wantsStream })
    }

    // ── Claude path (preferred) ──
    if (claudeKey) {
      const claude = new Anthropic({ apiKey: claudeKey })

      const anthropicMessages = sanitizedMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))

      if (wantsStream) {
        // Server-Sent Events streaming
        const encoder = new TextEncoder()
        const readable = new ReadableStream({
          async start(controller) {
            try {
              const stream = claude.messages.stream({
                model: "claude-sonnet-4-6",
                max_tokens: 2048,
                system: systemPrompt,
                messages: anthropicMessages,
              })

              let fullText = ""

              stream.on("text", (delta) => {
                fullText += delta
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta, type: "text_delta" })}\n\n`)
                )
              })

              const finalMessage = await stream.finalMessage()
              const usage = finalMessage.usage

              // Send final event with usage
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: "done",
                  message: fullText,
                  usage: { input: usage.input_tokens, output: usage.output_tokens },
                  model: "claude-sonnet-4-6",
                })}\n\n`)
              )

              controller.close()
            } catch {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: fallbackMessage, type: "text_delta" })}\n\n`))
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done", message: fallbackMessage, model: "openrx-safe-fallback", fallback: true })}\n\n`)
              )
              controller.close()
            }
          },
        })

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-AI-Model": "claude-sonnet-4-6",
          },
        })
      }

      // Non-streaming Claude response
      const response = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages: anthropicMessages,
        })
        .catch(() => null)

      if (!response) {
        return fallbackResponse({ message: fallbackMessage, sessionId, stream: false })
      }

      const assistantMessage = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("") || "I apologize, I could not generate a response."

      return NextResponse.json({
        message: assistantMessage,
        sessionId,
        model: "claude-sonnet-4-6",
        usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      })
    }

    // ── OpenAI fallback ──
    const openai = new OpenAI({ apiKey: openaiKey! })

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...sanitizedMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: wantsStream,
      })
      .catch(() => null)

    if (!response) {
      return fallbackResponse({ message: fallbackMessage, sessionId, stream: wantsStream })
    }

    if (wantsStream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let fullText = ""
            const streamResponse = response as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
            for await (const chunk of streamResponse) {
              const delta = chunk.choices[0]?.delta?.content ?? ""
              if (delta) {
                fullText += delta
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta, type: "text_delta" })}\n\n`))
              }
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done", message: fullText, model: "gpt-4o-mini" })}\n\n`)
            )
            controller.close()
          } catch {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: fallbackMessage, type: "text_delta" })}\n\n`))
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done", message: fallbackMessage, model: "openrx-safe-fallback", fallback: true })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-AI-Model": "gpt-4o-mini (fallback)",
        },
      })
    }

    const completionResponse = response as OpenAI.Chat.Completions.ChatCompletion
    const assistantMessage = completionResponse.choices[0]?.message?.content ?? "No response"
    return NextResponse.json({ message: assistantMessage, sessionId, model: "gpt-4o-mini" })

  } catch (error) {
    console.error("[AI chat]", error)
    const status = (error instanceof Anthropic.APIError || error instanceof OpenAI.APIError)
      ? (error.status ?? 500)
      : 500
    const isRateLimit = status === 429
    const isOverloaded = status === 529
    const friendlyMessage = isRateLimit
      ? "Our AI assistant is handling a high volume of requests. Please wait a moment and try again."
      : isOverloaded
      ? "Our AI assistant is temporarily at capacity. Please try again in a few minutes."
      : "Something went wrong. Please try again, and if the issue continues, contact your care team."
    return NextResponse.json({ error: friendlyMessage }, { status })
  }
}
