import { NextRequest, NextResponse } from "next/server"
import { CommitmentPilotError } from "@/lib/commitments/errors"
import { isCommitmentFeatureEnabled } from "@/lib/commitments/flags"

export function commitmentFeatureUnavailable(): NextResponse | null {
  if (isCommitmentFeatureEnabled("SCREENING_COMMITMENT_PILOT")) return null
  return NextResponse.json(
    { error: { code: "disabled", message: "Screening commitments are not available." } },
    { status: 404 },
  )
}

export function commitmentApiError(error: unknown): NextResponse {
  if (error instanceof CommitmentPilotError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    )
  }
  if (error instanceof Error && error.message === "Screening commitment pilot is disabled.") {
    return NextResponse.json(
      { error: { code: "disabled", message: "Screening commitments are not available." } },
      { status: 404 },
    )
  }
  return NextResponse.json(
    { error: { code: "internal_error", message: "The commitment request could not be completed." } },
    { status: 500 },
  )
}

export function requestClientIp(request: NextRequest): string {
  const runtimeIp = (request as NextRequest & { ip?: string }).ip?.trim()
  if (runtimeIp) return runtimeIp
  if (process.env.NODE_ENV !== "production") return "127.0.0.1"
  throw new CommitmentPilotError(
    "verification_failed",
    "A trusted client network address is required for funding.",
    400,
  )
}
