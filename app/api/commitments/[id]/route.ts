import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import {
  commitmentApiError,
  commitmentFeatureUnavailable,
  requestClientIp,
} from "@/lib/commitments/api"
import { commitmentPilotService } from "@/lib/commitments/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: { id: string } }

export async function GET(request: NextRequest, context: RouteContext) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  try {
    return NextResponse.json({
      snapshot: commitmentPilotService.snapshot(context.params.id, auth.session.userId),
    })
  } catch (error) {
    return commitmentApiError(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    paymentMethod?: string
    country?: string
    subdivision?: string
    transactionHash?: string
  }
  try {
    switch (body.action) {
      case "verify_identity":
        return NextResponse.json({
          snapshot: await commitmentPilotService.verifyIdentity(
            context.params.id,
            auth.session.userId,
          ),
        })
      case "quote":
        return NextResponse.json({
          snapshot: await commitmentPilotService.quote(context.params.id, auth.session.userId, {
            paymentMethod: String(body.paymentMethod || "sandbox_balance"),
            country: String(body.country || "US"),
            subdivision: body.subdivision ? String(body.subdivision) : undefined,
            clientIp: requestClientIp(request),
          }),
        })
      case "prepare_deposit":
        return NextResponse.json({
          preparedDeposit: await commitmentPilotService.prepareDeposit(
            context.params.id,
            auth.session.userId,
          ),
        })
      case "start_onramp":
        return NextResponse.json({
          onramp: await commitmentPilotService.startOnramp(
            context.params.id,
            auth.session.userId,
            requestClientIp(request),
          ),
        })
      case "confirm_deposit": {
        const transactionHash = String(body.transactionHash || "")
        if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
          return NextResponse.json(
            { error: { code: "invalid_input", message: "A valid transaction reference is required." } },
            { status: 400 },
          )
        }
        return NextResponse.json({
          snapshot: await commitmentPilotService.confirmDeposit(
            context.params.id,
            auth.session.userId,
            transactionHash as `0x${string}`,
          ),
        })
      }
      case "fund":
        return NextResponse.json({
          snapshot: await commitmentPilotService.fund(context.params.id, auth.session.userId),
        })
      case "extend":
        return NextResponse.json({
          snapshot: commitmentPilotService.extend(context.params.id, auth.session.userId),
        })
      case "cancel":
        return NextResponse.json({
          snapshot: await commitmentPilotService.cancel(context.params.id, auth.session.userId),
        })
      case "withdraw_consent":
        return NextResponse.json({
          snapshot: await commitmentPilotService.cancel(
            context.params.id,
            auth.session.userId,
            "consent_withdrawn",
          ),
        })
      case "offramp":
        return NextResponse.json({
          offramp: await commitmentPilotService.createOfframp(
            context.params.id,
            auth.session.userId,
            requestClientIp(request),
          ),
        })
      default:
        return NextResponse.json(
          { error: { code: "invalid_input", message: "A supported action is required." } },
          { status: 400 },
        )
    }
  } catch (error) {
    return commitmentApiError(error)
  }
}
