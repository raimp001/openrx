import { NextResponse } from "next/server"
import { assessHealthScreening } from "@/lib/basehealth"
import { getLedgerSnapshot } from "@/lib/payments-ledger"
import { getDatabaseHealth } from "@/lib/database-health"
import {
  OPENRX_ADMIN_ID,
  listAdminNotifications,
  listNetworkApplications,
} from "@/lib/provider-applications"

export const dynamic = "force-dynamic"

type ReadinessStatus = "ready" | "attention"

function toStatus(ok: boolean): ReadinessStatus {
  return ok ? "ready" : "attention"
}

export async function GET() {
  const databaseHealth = await getDatabaseHealth()
  const applications = listNetworkApplications()
  const notifications = listAdminNotifications(OPENRX_ADMIN_ID)
  const ledger = await getLedgerSnapshot()
  const screening = assessHealthScreening()
  const adminEmailConfigured = !!(process.env.OPENRX_ADMIN_EMAILS || "").trim()
  const adminEmailDeliveryConfigured =
    !!(process.env.RESEND_API_KEY && process.env.OPENRX_EMAIL_FROM)
  const adminReviewSigningConfigured = !!(process.env.OPENRX_ADMIN_REVIEW_SECRET || "")

  const pendingApplications = applications.filter((item) => item.status === "pending").length
  const approvedApplications = applications.filter((item) => item.status === "approved").length
  const rejectedApplications = applications.filter((item) => item.status === "rejected").length
  const unreadNotifications = notifications.filter((item) => !item.isRead).length

  const checks = [
    {
      id: "nl-care-search",
      title: "Natural-language care search",
      description: "Provider/caregiver/lab/radiology search with NPI readiness gating.",
      status: toStatus(true),
      metric: "Enabled",
      href: "/providers",
    },
    {
      id: "network-onboarding",
      title: "Provider/caregiver onboarding",
      description: "Applicant intake with signed email approval/rejection links for admin review.",
      status: toStatus(adminEmailConfigured && adminEmailDeliveryConfigured && adminReviewSigningConfigured),
      metric: `${applications.length} applications`,
      href: "/join-network",
    },
    {
      id: "screening-routing",
      title: "Personalized screening routing",
      description: "Risk-based recommendations and nearby network routing from patient history.",
      status: toStatus(screening.recommendedScreenings.length > 0),
      metric: `${screening.recommendedScreenings.length} recommendations`,
      href: "/screening",
    },
    {
      id: "payments-ledger",
      title: "Payments compliance ledger",
      description: "Verification, receipts, attestations, refunds, and accounting trail.",
      status: toStatus(true),
      metric: `${ledger.summary.receiptCount} receipts`,
      href: "/compliance-ledger",
    },
    {
      id: "database-runtime",
      title: "Database runtime",
      description: "Live Postgres connectivity for patient records, durable ledger, and agent state.",
      status: toStatus(databaseHealth.reachable),
      metric: databaseHealth.status === "connected" ? "Connected" : databaseHealth.status === "missing" ? "Missing DATABASE_URL" : "Connection issue",
      href: "/wallet",
    },
  ]

  const readyCount = checks.filter((item) => item.status === "ready").length
  const readinessScore = Math.round((readyCount / checks.length) * 100)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    readinessScore,
    checks,
    operations: {
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      unreadNotifications,
      pendingVerification: ledger.summary.pendingVerificationCount,
      openRefunds: ledger.summary.openRefundCount,
      verifiedVolume: ledger.summary.verifiedVolume,
      refundedVolume: ledger.summary.refundedVolume,
    },
  })
}
