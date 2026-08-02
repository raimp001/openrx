import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { commitmentPilotService } from "@/lib/commitments/service"
import type { CompletionEventInput } from "@/lib/commitments/types"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  if (!["admin", "provider", "service"].includes(auth.session.role)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Trusted provider access is required." } },
      { status: 403 },
    )
  }
  const body = (await request.json().catch(() => ({}))) as Partial<CompletionEventInput>
  try {
    const snapshot = await commitmentPilotService.complete({
      eventId: String(body.eventId || ""),
      commitmentId: String(body.commitmentId || ""),
      providerId: String(body.providerId || ""),
      occurredAt: String(body.occurredAt || ""),
      nonce: String(body.nonce || ""),
      idempotencyKey: String(body.idempotencyKey || ""),
      signature: String(body.signature || ""),
    })
    return NextResponse.json({ snapshot })
  } catch (error) {
    return commitmentApiError(error)
  }
}
