import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { getCommitmentPilotState } from "@/lib/commitments/store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  if (auth.session.role !== "provider") {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Trusted provider access is required." } },
      { status: 403 },
    )
  }

  try {
    const state = getCommitmentPilotState()
    const commitments = Array.from(state.commitments.values())
      .filter(
        (commitment) =>
          commitment.expectedCompletionProviderId === auth.session.userId &&
          commitment.fundingStatus === "confirmed",
      )
      .map((commitment) => ({
        id: commitment.id,
        screeningLabel: commitment.screeningLabel,
        guidelineSource: commitment.guidelineSource,
        guidelineVersion: commitment.guidelineVersion,
        status: commitment.status,
        currentDeadline: commitment.currentDeadline,
        conditionVerifiedAt: commitment.conditionVerifiedAt,
        refundStatus: commitment.refundStatus,
      }))

    return NextResponse.json({
      commitments,
      providerId: auth.session.userId,
      sandbox: true,
      disclosure: "No patient identity or screening result is shown in this sandbox workspace.",
    })
  } catch (error) {
    return commitmentApiError(error)
  }
}
