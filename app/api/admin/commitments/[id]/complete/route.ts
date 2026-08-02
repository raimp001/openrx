import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { getCommitmentPilotNetwork } from "@/lib/commitments/flags"
import {
  MOCK_COMPLETION_PROVIDER_ID,
  signMockCompletionEvent,
} from "@/lib/commitments/mock-adapters"
import { createOpaqueId } from "@/lib/commitments/privacy"
import { commitmentPilotService } from "@/lib/commitments/service"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  if (!["admin", "provider"].includes(auth.session.role)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Trusted provider access is required." } },
      { status: 403 },
    )
  }
  if (getCommitmentPilotNetwork() !== "local-mock") {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Manual completion is limited to the local sandbox." } },
      { status: 403 },
    )
  }
  try {
    const commitment = commitmentPilotService.snapshot(params.id).commitment
    if (
      auth.session.role === "provider" &&
      commitment.expectedCompletionProviderId !== auth.session.userId
    ) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "This commitment is assigned to another provider." } },
        { status: 403 },
      )
    }
    const eventId = createOpaqueId("manual-completion")
    const event = signMockCompletionEvent({
      eventId,
      commitmentId: params.id,
      providerId: MOCK_COMPLETION_PROVIDER_ID,
      occurredAt: new Date().toISOString(),
      nonce: createOpaqueId("nonce"),
      idempotencyKey: eventId,
    })
    return NextResponse.json({ snapshot: await commitmentPilotService.complete(event) })
  } catch (error) {
    return commitmentApiError(error)
  }
}
