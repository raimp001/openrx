import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { commitmentPilotService } from "@/lib/commitments/service"

export const runtime = "nodejs"
type RouteContext = { params: { id: string } }

export async function POST(request: NextRequest, context: RouteContext) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  const body = (await request.json().catch(() => ({}))) as {
    intendedVerifier?: string
    ttlMinutes?: number
  }
  try {
    const result = await commitmentPilotService.createCredentialShare(
      context.params.id,
      auth.session.userId,
      String(body.intendedVerifier || ""),
      Number(body.ttlMinutes || 30),
    )
    return NextResponse.json({
      share: result.share,
      url: `/commitments/verify/${encodeURIComponent(result.token)}`,
    })
  } catch (error) {
    return commitmentApiError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  const body = (await request.json().catch(() => ({}))) as { shareId?: string }
  try {
    return NextResponse.json({
      snapshot: commitmentPilotService.revokeShare(
        context.params.id,
        auth.session.userId,
        String(body.shareId || ""),
      ),
    })
  } catch (error) {
    return commitmentApiError(error)
  }
}
