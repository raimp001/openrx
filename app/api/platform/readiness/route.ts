import { NextResponse } from "next/server"
import { assessHealthScreening } from "@/lib/basehealth"
import { getLedgerSnapshot } from "@/lib/payments-ledger"
import { getDatabaseHealth } from "@/lib/database-health"
import {
  OPENRX_ADMIN_ID,
  listAdminNotifications,
  listNetworkApplications,
} from "@/lib/provider-applications"
import { listRecentCronRuns, listWorkerHeartbeats } from "@/lib/openclaw/runtime-persistence"
import { allowsUnsignedWalletHeader } from "@/lib/api-auth"
import { allowsCronRequestOverrides } from "@/lib/openclaw/cron-dispatch"

export const dynamic = "force-dynamic"

type ReadinessStatus = "ready" | "attention"
type WorkerHeartbeat = Awaited<ReturnType<typeof listWorkerHeartbeats>>[number]
type EmailDeliveryHealth = {
  ok: boolean
  metric: string
  description: string
}

const LIVE_SCHEDULER_WINDOW_MS = 15 * 60 * 1000
const RECENT_CRON_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000
const RESEND_DOMAIN_CHECK_TIMEOUT_MS = 3500

function toStatus(ok: boolean): ReadinessStatus {
  return ok ? "ready" : "attention"
}

function toEpoch(value: Date | string | null | undefined): number {
  if (!value) return 0
  return new Date(value).getTime()
}

function isRecentAwsWorker(worker: WorkerHeartbeat): boolean {
  return worker.workerType === "aws-scheduler" && Date.now() - toEpoch(worker.lastSeenAt) <= LIVE_SCHEDULER_WINDOW_MS
}

function getSenderDomain(value?: string | null): string {
  const from = (value || "").trim().toLowerCase()
  const addressMatch = from.match(/<[^@<>]+@([^>]+)>/) || from.match(/[^@\s<]+@([^>\s>]+)/)
  return (addressMatch?.[1] || "").replace(/[>,].*$/, "").trim()
}

function normalizeResendDomains(payload: unknown): Array<{ name?: string; status?: string; verification_status?: string }> {
  if (Array.isArray(payload)) return payload as Array<{ name?: string; status?: string; verification_status?: string }>
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: Array<{ name?: string; status?: string; verification_status?: string }> }).data
  }
  return []
}

async function getEmailDeliveryHealth(): Promise<EmailDeliveryHealth> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.OPENRX_EMAIL_FROM?.trim()
  const senderDomain = getSenderDomain(from)

  if (!from || !senderDomain) {
    return {
      ok: false,
      metric: "Missing sender",
      description: "Set OPENRX_EMAIL_FROM to a verified production sender.",
    }
  }

  if (senderDomain === "resend.dev") {
    return {
      ok: false,
      metric: "resend.dev sender",
      description: "Use a verified domain sender instead of the Resend sandbox domain.",
    }
  }

  if (!apiKey) {
    return {
      ok: false,
      metric: "Missing RESEND_API_KEY",
      description: "Set RESEND_API_KEY so admin approval and background digest emails can be delivered.",
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RESEND_DOMAIN_CHECK_TIMEOUT_MS)
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        metric: `Resend check ${response.status}`,
        description: `Resend could not verify ${senderDomain}; email delivery should be treated as blocked.`,
      }
    }

    const domains = normalizeResendDomains(await response.json())
    const domain = domains.find((item) => item.name?.toLowerCase() === senderDomain)
    const status = (domain?.status || domain?.verification_status || "").toLowerCase()
    const verified = status === "verified"

    return {
      ok: verified,
      metric: domain ? `${senderDomain} ${status || "unverified"}` : `${senderDomain} not found`,
      description: verified
        ? `Resend reports ${senderDomain} as verified.`
        : `Verify ${senderDomain} in Resend before relying on admin/researcher email delivery.`,
    }
  } catch {
    return {
      ok: false,
      metric: "Resend check failed",
      description: `Could not confirm Resend verification for ${senderDomain}.`,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  const databaseHealth = await getDatabaseHealth()
  const screening = assessHealthScreening()
  const [applications, notifications, ledger, workers, recentCronRuns, emailDelivery] = await Promise.all([
    listNetworkApplications(),
    listAdminNotifications(OPENRX_ADMIN_ID),
    getLedgerSnapshot(),
    listWorkerHeartbeats(10),
    listRecentCronRuns(10),
    getEmailDeliveryHealth(),
  ])
  const awsWorker = workers.find(isRecentAwsWorker)
  const adminEmailConfigured = !!(process.env.OPENRX_ADMIN_EMAILS || "").trim()
  const adminReviewSigningConfigured = !!(process.env.OPENRX_ADMIN_REVIEW_SECRET || "")
  const adminApiKeyConfigured = !!(process.env.OPENRX_ADMIN_API_KEY || "").trim()
  const agentNotifyTokenConfigured = !!(process.env.OPENRX_AGENT_NOTIFY_TOKEN || "").trim()
  const trustedRoleHeaderDisabled = (process.env.OPENRX_TRUST_ROLE_HEADER || "false").toLowerCase() !== "true"
  const unsignedWalletHeaderDisabled = !allowsUnsignedWalletHeader()
  const cronRequestOverridesDisabled = !allowsCronRequestOverrides({
    authSource: "admin_api_key",
    dryRun: false,
  })
  const applicationStoreConfigured = !!(process.env.OPENRX_APPLICATIONS_PATH || "").trim()
  const publicBaseUrlConfigured = !!(process.env.OPENRX_APP_BASE_URL || process.env.VERCEL_URL || "").trim()
  const liveModelConfigured = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)
  const recentCronCutoff = Date.now() - RECENT_CRON_HEALTH_WINDOW_MS
  const recentCronHealthRuns = recentCronRuns.filter((run) => toEpoch(run.createdAt) >= recentCronCutoff)
  const failedRecentCronRuns = recentCronHealthRuns.filter((run) => !run.ok).length
  const staleOverrideRecentCronRuns = recentCronHealthRuns.filter((run) =>
    run.jobId !== "screening-reminders" &&
    run.message.toLowerCase().includes("screening reminder workflow")
  ).length
  const cronHealthReady =
    recentCronHealthRuns.length === 0 ||
    (failedRecentCronRuns === 0 && staleOverrideRecentCronRuns === 0)

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
      status: toStatus(adminEmailConfigured && emailDelivery.ok && adminReviewSigningConfigured && publicBaseUrlConfigured),
      metric: `${applications.length} applications · ${emailDelivery.metric}`,
      href: "/join-network",
    },
    {
      id: "admin-security",
      title: "Admin and service auth",
      description: "Admin APIs require OPENRX_ADMIN_API_KEY, workers require OPENRX_AGENT_NOTIFY_TOKEN, trusted role headers stay disabled, unsigned wallet headers are not trusted, and live cron request overrides stay off.",
      status: toStatus(adminApiKeyConfigured && agentNotifyTokenConfigured && trustedRoleHeaderDisabled && unsignedWalletHeaderDisabled && cronRequestOverridesDisabled),
      metric: adminApiKeyConfigured && agentNotifyTokenConfigured && trustedRoleHeaderDisabled && unsignedWalletHeaderDisabled && cronRequestOverridesDisabled
        ? "Locked"
        : "Missing launch secret or unsafe header trust enabled",
      href: "/admin-review",
    },
    {
      id: "application-store",
      title: "Network application storage",
      description: "Provider and caregiver applications need durable storage so email review links continue to resolve after serverless restarts.",
      status: toStatus(applicationStoreConfigured),
      metric: applicationStoreConfigured ? "Durable path configured" : "Using ephemeral fallback",
      href: "/join-network",
    },
    {
      id: "email-delivery",
      title: "Production email delivery",
      description: emailDelivery.description,
      status: toStatus(emailDelivery.ok),
      metric: emailDelivery.metric,
      href: "/admin-review",
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
    {
      id: "ai-agent-response",
      title: "Atlas agent responses",
      description: "Chat and care-agent endpoints return a useful answer even when a model provider is rate-limited.",
      status: toStatus(true),
      metric: liveModelConfigured ? "Live model key configured" : "Safe fallback enabled",
      href: "/chat",
    },
    {
      id: "aws-worker-cutover",
      title: "AWS worker cutover",
      description: "Background reminders and OpenClaw jobs are driven by the EC2/systemd scheduler instead of Vercel cron.",
      status: toStatus(Boolean(awsWorker)),
      metric: awsWorker ? `${awsWorker.workerId} active` : "No recent AWS heartbeat",
      href: "/dashboard",
    },
    {
      id: "background-job-health",
      title: "Background job health",
      description: "Recent scheduled runs should complete without provider-blocked failures or stale screening prompt overrides on unrelated jobs.",
      status: toStatus(cronHealthReady),
      metric: recentCronHealthRuns.length === 0
        ? "No recent runs yet"
        : `${recentCronHealthRuns.length - failedRecentCronRuns}/${recentCronHealthRuns.length} recent ok${staleOverrideRecentCronRuns ? ` · ${staleOverrideRecentCronRuns} stale override` : ""}`,
      href: "/dashboard",
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
