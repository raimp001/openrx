import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { commitmentPilotService } from "@/lib/commitments/service"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  const body = (await request.json().catch(() => ({}))) as { action?: string }
  try {
    if (body.action === "exception_refund") {
      if (auth.session.role !== "admin") {
        return NextResponse.json(
          { error: { code: "forbidden", message: "Commitment administrator access is required." } },
          { status: 403 },
        )
      }
      return NextResponse.json({
        snapshot: await commitmentPilotService.exceptionRefund(params.id, auth.session.userId),
      })
    }
    if (body.action === "retry_refund") {
      if (!["admin", "support"].includes(auth.session.role)) {
        return NextResponse.json(
          { error: { code: "forbidden", message: "Commitment support access is required." } },
          { status: 403 },
        )
      }
      return NextResponse.json({
        snapshot: await commitmentPilotService.retryRefund(params.id, auth.session.userId),
      })
    }
    return NextResponse.json(
      { error: { code: "invalid_input", message: "A supported administrator action is required." } },
      { status: 400 },
    )
  } catch (error) {
    return commitmentApiError(error)
  }
}
