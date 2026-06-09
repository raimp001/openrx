import { NextRequest, NextResponse } from "next/server"
import { matchClinicalTrials, type TrialMatchInput } from "@/lib/basehealth"

function numberParam(value: string | null): number | undefined {
  if (!value) return undefined
  const numeric = Number.parseInt(value, 10)
  return Number.isFinite(numeric) ? numeric : undefined
}

function toPayload(request: NextRequest): TrialMatchInput {
  const { searchParams } = new URL(request.url)
  const cityState = [searchParams.get("city"), searchParams.get("state")]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")
  const location =
    searchParams.get("location")?.trim() ||
    searchParams.get("zip")?.trim() ||
    cityState ||
    undefined

  return {
    patientId: searchParams.get("patientId") || undefined,
    condition: searchParams.get("condition") || undefined,
    location,
    zip: searchParams.get("zip") || undefined,
    age: numberParam(searchParams.get("age")),
    sex: searchParams.get("sex") || searchParams.get("gender") || undefined,
  }
}

function hasSearchInput(payload: TrialMatchInput): boolean {
  return Boolean(payload.condition?.trim() || payload.location?.trim() || payload.zip?.trim() || payload.patientId?.trim())
}

export async function GET(request: NextRequest) {
  const payload = toPayload(request)
  if (!hasSearchInput(payload)) {
    return NextResponse.json(
      { error: "Provide at least one search input: condition, location, or patientId." },
      { status: 400 }
    )
  }
  const matches = await matchClinicalTrials(payload)
  return NextResponse.json({
    matches,
    total: matches.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrialMatchInput
    if (!hasSearchInput(body)) {
      return NextResponse.json(
        { error: "Provide at least one search input: condition, location, or patientId." },
        { status: 400 }
      )
    }
    const matches = await matchClinicalTrials(body)
    return NextResponse.json({
      matches,
      total: matches.length,
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to match clinical trials." },
      { status: 400 }
    )
  }
}
