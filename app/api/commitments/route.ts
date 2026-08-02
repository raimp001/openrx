import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { commitmentPilotService } from "@/lib/commitments/service"
import type { CreateCommitmentInput } from "@/lib/commitments/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  try {
    return NextResponse.json({ commitments: commitmentPilotService.list(auth.session.userId) })
  } catch (error) {
    return commitmentApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  const body = (await request.json().catch(() => ({}))) as Partial<CreateCommitmentInput>
  try {
    const snapshot = await commitmentPilotService.create({
      patientId: auth.session.userId,
      recommendationId: String(body.recommendationId || ""),
      screeningLabel: String(body.screeningLabel || ""),
      guidelineSource: String(body.guidelineSource || ""),
      guidelineVersion: String(body.guidelineVersion || ""),
      engineVersion: String(body.engineVersion || ""),
      sourceUrl: String(body.sourceUrl || ""),
      recommendationIssuedAt: String(body.recommendationIssuedAt || ""),
      eligibilityToken: String(body.eligibilityToken || ""),
      expectedCompletionProviderId: body.expectedCompletionProviderId
        ? String(body.expectedCompletionProviderId)
        : undefined,
      consentVersion: String(body.consentVersion || ""),
      termsAccepted: body.termsAccepted === true,
      existingWalletAddress: body.existingWalletAddress
        ? String(body.existingWalletAddress)
        : undefined,
      cohort: body.cohort === "reminders_only" ? "reminders_only" : "commitment_offer",
    })
    return NextResponse.json({ snapshot }, { status: 201 })
  } catch (error) {
    return commitmentApiError(error)
  }
}
