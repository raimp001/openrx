import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { commitmentPilotService } from "@/lib/commitments/service"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  if (!["admin", "service"].includes(auth.session.role)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Commitment worker access is required." } },
      { status: 403 },
    )
  }
  try {
    return NextResponse.json({
      result: await commitmentPilotService.runDeadlineWorker(auth.session.userId),
    })
  } catch (error) {
    return commitmentApiError(error)
  }
}
