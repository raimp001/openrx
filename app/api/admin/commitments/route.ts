import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { getCommitmentPilotState } from "@/lib/commitments/store"
import { commitmentPilotService } from "@/lib/commitments/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable) return unavailable
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response
  if (!["admin", "support", "compliance"].includes(auth.session.role)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Pilot operations access is required." } },
      { status: 403 },
    )
  }
  try {
    const state = getCommitmentPilotState()
    const canViewAudit = ["admin", "compliance"].includes(auth.session.role)
    const canViewClinicalLabel = ["admin", "compliance"].includes(auth.session.role)
    const commitments = Array.from(state.commitments.values()).map((commitment) => {
      const credential = commitment.credentialId
        ? state.credentials.get(commitment.credentialId)
        : undefined
      return {
        commitment: {
          id: commitment.id,
          screeningLabel: canViewClinicalLabel
            ? commitment.screeningLabel
            : "Preventive screening commitment",
          status: commitment.status,
          fundingStatus: commitment.fundingStatus,
          currentDeadline: commitment.currentDeadline,
          conditionVerifiedAt: commitment.conditionVerifiedAt,
          refundStatus: commitment.refundStatus,
        },
        credential: credential ? { status: credential.status } : undefined,
        audit: canViewAudit
          ? state.audit
              .filter((event) => event.commitmentId === commitment.id)
              .map((event) => ({
                id: event.id,
                eventType: event.eventType,
                occurredAt: event.occurredAt,
              }))
          : [],
      }
    })
    return NextResponse.json({
      commitments,
      unmatchedWebhooks: 0,
      auditCount: state.audit.length,
      analytics: commitmentPilotService.getPilotAnalytics(),
      permissions: {
        canConfirmCompletion: auth.session.role === "admin",
        canRetryRefund: ["admin", "support"].includes(auth.session.role),
        canIssueExceptionRefund: auth.session.role === "admin",
        canViewAudit,
      },
      sandbox: true,
    })
  } catch (error) {
    return commitmentApiError(error)
  }
}
