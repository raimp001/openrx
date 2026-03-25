import { requireAuth } from "@/lib/api-auth"
/**
 * PA Appeal Workflow API
 * POST /api/pa/appeal        — generate appeal letter + strategy using Claude
 * GET  /api/pa/appeal        — list appeal templates / evidence library
 */

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const maxDuration = 60

interface AppealRequest {
  // PA details
  paId?: string
  referenceNumber?: string
  patientName: string
  patientDob?: string
  memberId?: string
  payer: string
  insurancePlan?: string

  // Clinical
  procedureCode: string
  procedureName: string
  icdCodes: string[]
  denialReason: string
  denialCode?: string

  // Provider
  physicianName?: string
  physicianNpi?: string
  facilityName?: string

  // Additional context
  clinicalNotes?: string
  priorTherapies?: string[]
  ecogScore?: number

  // Options
  appealType?: "standard" | "expedited" | "external"
  includeP2PRequest?: boolean
}

const APPEAL_SYSTEM_PROMPT = `You are Rex, OpenRx's AI prior authorization appeal specialist.

You generate physician-ready, evidence-based PA denial appeal letters that win.

Your output is always:
1. A formal appeal letter (letterhead-ready, physician signature block)
2. Clinical evidence summary with trial citations (NCCN, FDA approval, key Phase 3 data)
3. Step-by-step appeal submission instructions for this specific payer
4. If requested: peer-to-peer review request language

Style:
- Clinical, professional, direct — no filler
- Cite specific trial names, ORR/OS/PFS data, NCCN category
- Reference CMS regulations when applicable (42 CFR, ACA requirements)
- For BCMA/CAR-T/checkpoint inhibitors: cite MajesTEC-1, ZUMA-1, KEYNOTE series as appropriate
- Always include the appeal deadline reminder (typically 30-180 days from denial)

Output format:
Use clear section headers: ## APPEAL LETTER, ## CLINICAL EVIDENCE, ## SUBMISSION INSTRUCTIONS, ## PEER-TO-PEER REQUEST (if applicable).`

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if ("response" in auth) return auth.response;
  try {
    const body = await req.json() as AppealRequest

    const {
      patientName, memberId, payer, procedureCode, procedureName,
      icdCodes, denialReason, denialCode, physicianName, clinicalNotes,
      priorTherapies = [], ecogScore, appealType = "standard",
      includeP2PRequest = true, referenceNumber, insurancePlan, patientDob,
      physicianNpi, facilityName,
    } = body

    if (!patientName || !payer || !procedureCode || !denialReason) {
      return NextResponse.json(
        { error: "patientName, payer, procedureCode, and denialReason are required" },
        { status: 400 }
      )
    }

    const now = new Date()
    const appealDeadline = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

    const userPrompt = `Generate a complete PA appeal package for:

PATIENT: ${patientName}${patientDob ? ` | DOB: ${patientDob}` : ""}${memberId ? ` | Member ID: ${memberId}` : ""}
PAYER: ${payer}${insurancePlan ? ` (${insurancePlan})` : ""}
REFERENCE: ${referenceNumber ?? "Not provided"}
PHYSICIAN: ${physicianName ?? "Treating Physician"}${physicianNpi ? ` | NPI: ${physicianNpi}` : ""}${facilityName ? ` | ${facilityName}` : ""}

DRUG/PROCEDURE: ${procedureName} (${procedureCode})
DIAGNOSIS CODES: ${icdCodes.join(", ")}
PRIOR THERAPIES: ${priorTherapies.length > 0 ? priorTherapies.join(", ") : "As documented in chart"}
${ecogScore !== undefined ? `ECOG STATUS: ${ecogScore}` : ""}
${clinicalNotes ? `CLINICAL NOTES: ${clinicalNotes}` : ""}

DENIAL REASON: ${denialReason}${denialCode ? ` (Code: ${denialCode})` : ""}
APPEAL TYPE: ${appealType.toUpperCase()}
INCLUDE P2P REQUEST: ${includeP2PRequest ? "YES" : "NO"}
APPEAL DEADLINE: ${appealDeadline}

PRIOR THERAPIES DOCUMENTED: ${priorTherapies.length > 0 ? priorTherapies.join(", ") : "See chart"}

Generate the complete appeal package now. Be specific, cite trial data, and make this letter win.`

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fallback: return template-based appeal without AI
      return NextResponse.json({
        success: true,
        appealContent: buildTemplateAppeal(body),
        sections: {},
        model: "template",
        metadata: { appealDeadline, appealType, generatedAt: now.toISOString() },
        warning: "Set ANTHROPIC_API_KEY for AI-generated appeals with Claude Opus 4.6",
      })
    }

    const claude = new Anthropic({ apiKey })

    // Use streaming + collect for appeal generation (Opus for highest quality)
    const stream = claude.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: APPEAL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    const finalMessage = await stream.finalMessage()

    const appealContent = finalMessage.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    // Parse sections from the generated letter
    const sections: Record<string, string> = {}
    const sectionRegex = /## ([A-Z][A-Z\s/]+)\n([\s\S]*?)(?=\n## |$)/g
    let sectionMatch: RegExpExecArray | null
    while ((sectionMatch = sectionRegex.exec(appealContent)) !== null) {
      sections[sectionMatch[1].trim()] = sectionMatch[2].trim()
    }

    return NextResponse.json({
      success: true,
      appealContent,
      sections,
      model: "claude-opus-4-6",
      tokens: {
        input: finalMessage.usage.input_tokens,
        output: finalMessage.usage.output_tokens,
      },
      metadata: {
        patientName,
        payer,
        procedureCode,
        procedureName,
        referenceNumber,
        denialReason,
        appealType,
        appealDeadline,
        generatedAt: now.toISOString(),
      },
    })

  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude error: ${err.message}` }, { status: err.status ?? 500 })
    }
    return NextResponse.json({ error: "Appeal generation failed", details: String(err) }, { status: 500 })
  }
}

// Template fallback when no API key
function buildTemplateAppeal(req: AppealRequest): string {
  const references: string[] = []
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  return `## APPEAL LETTER

${today}

Appeals Department
${req.payer}

RE: Prior Authorization Appeal — ${req.patientName}
Member ID: ${req.memberId ?? "See enclosed"}
Reference Number: ${req.referenceNumber ?? "Pending"}
Drug/Service: ${req.procedureName} (${req.procedureCode})
Diagnosis: ${req.icdCodes.join(", ")}

Dear Medical Director,

I am writing to formally appeal the denial of prior authorization for ${req.procedureName} for my patient, ${req.patientName}. The service was denied with the reason: "${req.denialReason}."

This patient meets established clinical criteria for ${req.procedureName} as defined by the NCCN Guidelines and FDA-approved prescribing information. The requested treatment is medically necessary and represents the standard of care for this patient's condition.

${req.clinicalNotes ? `Clinical Background:\n${req.clinicalNotes}\n` : ""}

Based on the clinical evidence and applicable guidelines, I respectfully request that this denial be reversed and prior authorization be granted.

Sincerely,

${req.physicianName ?? "Treating Physician"}
${req.physicianNpi ? `NPI: ${req.physicianNpi}` : ""}

## CLINICAL EVIDENCE

${references.length > 0 ? references.join("\n") : "See NCCN Guidelines and prescribing information."}

## SUBMISSION INSTRUCTIONS

1. Submit this letter to ${req.payer}'s appeals department within 60 days of denial date
2. Include: denial letter, clinical notes, lab results supporting medical necessity
3. Request expedited review if patient's condition is urgent
4. Retain all submission confirmation numbers

## PEER-TO-PEER REQUEST

Request a peer-to-peer review with the ${req.payer} medical director.
Reference authorization number: ${req.referenceNumber ?? "As provided in denial letter"}
Physician availability: Please contact our office to schedule.`
}

// GET — appeal evidence library (static reference data, no auth needed)
export async function GET() {
  return NextResponse.json({
    appealTimelines: {
      Aetna: { standard: 60, expedited: 72 },
      UnitedHealthcare: { standard: 60, expedited: 72 },
      Cigna: { standard: 60, expedited: 72 },
      Humana: { standard: 60, expedited: 72 },
      Medicare: { standard: 60, expedited: 72, externalReview: 90 },
    },
    p2pTips: [
      "Request MD-to-MD review — peer-to-peer reversals run 50–70% on oncology denials",
      "Have the treating physician (not office staff) on the call",
      "Prepare: trial name, OS/PFS data, ECOG score, prior therapy dates",
      "Ask for the medical director's name and credential before the call",
      "Follow up in writing within 24 hours with key points discussed",
    ],
  })
}
