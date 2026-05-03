import { NextRequest, NextResponse } from "next/server"
import { parseScreeningIntakeNarrative } from "@/lib/screening-intake"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { narrative?: string }
    const narrative = (body.narrative || "").trim()
    if (!narrative) {
      return NextResponse.json({ error: "narrative is required." }, { status: 400 })
    }
    if (narrative.length > 2000) {
      return NextResponse.json({ error: "Narrative is too long. Keep it under 2000 characters." }, { status: 400 })
    }

    const intake = parseScreeningIntakeNarrative(narrative)
    return NextResponse.json(intake)
  } catch {
    return NextResponse.json({ error: "Failed to parse screening intake narrative." }, { status: 400 })
  }
}
