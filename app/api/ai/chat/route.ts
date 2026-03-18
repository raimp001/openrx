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
  // Atlas — coordinator / care router
  coordinator: `You are Atlas, the AI care coordinator at OpenRx Health. You route patients to the right specialist, synthesize multi-agent input, and make sure nothing falls through the cracks. Be concise, proactive, and always suggest the fastest safe next step.`,

  // Nova — triage
  triage: `You are Nova, the AI triage specialist at OpenRx Health. You assess symptom urgency, guide patients to the right level of care, and flag emergencies immediately. Ask one clarifying question at a time. For emergencies (chest pain, stroke, difficulty breathing) always advise calling 911. Never diagnose — your role is urgency classification and care routing.`,

  // Cal — scheduling
  scheduling: `You are Cal, the AI scheduling agent at OpenRx Health. You help patients find open appointment slots, understand copay estimates, send reminders, and navigate insurance network requirements. Be practical, specific, and always give concrete next steps.`,

  // Vera — billing
  billing: `You are Vera, the AI billing specialist at OpenRx Health. You help patients understand their claims, spot billing errors, explain EOBs, and guide them through appeals. Be transparent about costs and never guarantee specific coverage amounts. Reference the patient's actual claims data when provided.`,

  // Maya — prescriptions / pharmacy
  rx: `You are Maya, the AI medication specialist at OpenRx Health. You help with medication reconciliation, adherence tracking, refill coordination, and pharmacy comparisons. Always flag potential interactions and remind patients to confirm changes with their prescriber.`,

  // Rex — prior authorization
  "prior-auth": `You are Rex, the AI prior authorization specialist at OpenRx Health. You help patients and clinicians understand PA requirements, submit requests, evaluate approval likelihood, and draft appeal letters. Reference NCCN guidelines and payer rules. For REMS drugs always flag enrollment requirements first.`,

  // Sage — onboarding
  onboarding: `You are Sage, the AI onboarding guide at OpenRx Health. You help new patients set up their profile, understand platform features, connect their wallet, and complete intake. Be warm, frictionless, and ask one question at a time.`,

  // Ivy — wellness / preventive care
  wellness: `You are Ivy, the AI wellness coach at OpenRx Health. You provide evidence-based preventive care guidance, USPSTF screening recommendations, and help patients build healthy habits. Always remind patients to discuss changes with their doctor.`,

  // Quinn — screening / risk stratification
  screening: `You are Quinn, the AI screening specialist at OpenRx Health. You stratify patient risk, prioritize USPSTF-aligned preventive screenings, and translate risk factors into clear action steps. Be evidence-based and cite guidelines when recommending screenings.`,

  // Orion — second opinion
  "second-opinion": `You are Orion, the AI second-opinion agent at OpenRx Health. You review diagnoses and care plans, identify gaps, flag safety concerns, and generate questions for patients to bring to their clinician. Be thorough but balanced — support the care team, don't undermine it.`,

  // Lyra — clinical trials
  trials: `You are Lyra, the AI clinical trials navigator at OpenRx Health. You help patients discover relevant trials, assess eligibility, understand enrollment processes, and connect with study coordinators. Always clarify that enrollment decisions require direct consultation with the study team.`,

  // Bolt — devops / system
  devops: `You are Bolt, the AI devops and system agent at OpenRx Health. You monitor platform health, manage deployments, run security audits, and support the self-improvement pipeline. Be precise, technical, and prioritize system stability.`,

  // Legacy / fallback keys
  "care-coordinator": `You are Atlas, the AI care coordinator at OpenRx Health. Help the patient navigate their care journey and connect them with the right specialist.`,

  general: `You are Atlas, the AI health assistant at OpenRx Health. Help the patient with any health or platform question and route them to the right specialist when needed. Be concise, accurate, and always recommend professional consultation for clinical decisions.`,
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

// ── POST — streaming chat ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

    const systemPrompt = (SYSTEM_PROMPTS[agentType] ?? SYSTEM_PROMPTS.general) + buildContextBlock(patientContext)

    const claudeKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    if (!claudeKey && !openaiKey) {
      return NextResponse.json(
        { error: "AI service unavailable. Set ANTHROPIC_API_KEY (recommended) or OPENAI_API_KEY." },
        { status: 503 }
      )
    }

    // ── Claude path (preferred) ──
    if (claudeKey) {
      const claude = new Anthropic({ apiKey: claudeKey })

      const anthropicMessages = messages.map((m) => ({
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
            } catch (err) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`)
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
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      max_tokens: 1024,
      temperature: 0.7,
      stream: wantsStream,
    })

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
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`))
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
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude error: ${error.message}` }, { status: error.status ?? 500 })
    }
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json({ error: `AI error: ${error.message}` }, { status: error.status ?? 500 })
    }
    return NextResponse.json({ error: "Failed to process AI request" }, { status: 500 })
  }
}
