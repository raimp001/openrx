import { NextRequest, NextResponse } from "next/server"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { verifyCoinbaseWebhook } from "@/lib/commitments/coinbase-webhook"
import { getCommitmentFeatureFlags } from "@/lib/commitments/flags"
import { commitmentPilotService } from "@/lib/commitments/service"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable || !getCommitmentFeatureFlags().coinbaseOnrampPilot) {
    return unavailable ?? NextResponse.json({ error: { code: "disabled", message: "Coinbase funding is disabled." } }, { status: 404 })
  }
  try {
    const rawBody = await request.text()
    verifyCoinbaseWebhook({
      rawBody,
      signatureHeader: request.headers.get("x-hook0-signature") || "",
      secret: process.env.COINBASE_WEBHOOK_SECRET,
    })
    const parsed = JSON.parse(rawBody) as {
      id?: string
      event_type?: string
      eventType?: string
      data?: {
        status?: string
        partner_user_ref?: string
        partnerUserRef?: string
      }
    }
    const eventId = request.headers.get("x-event-id") || parsed.id || ""
    const eventType =
      request.headers.get("x-event-type") || parsed.event_type || parsed.eventType || "unknown"
    if (!eventId) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: "Coinbase event identifier is required." } },
        { status: 400 },
      )
    }
    const result = commitmentPilotService.recordCoinbaseWebhook({
      eventId,
      eventType,
      idempotencyKey: eventId,
      partnerUserRef: parsed.data?.partner_user_ref || parsed.data?.partnerUserRef,
      status: parsed.data?.status || "received",
    })
    return NextResponse.json({ received: true, duplicate: result.duplicate })
  } catch (error) {
    return commitmentApiError(error)
  }
}
