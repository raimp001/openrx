import {
  createAdminReviewToken,
  type AdminReviewDecision,
} from "@/lib/admin-review-token"
import type { NetworkApplication } from "@/lib/provider-applications"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

function resolveAdminRecipients(): string[] {
  const configured = process.env.OPENRX_ADMIN_EMAILS || ""
  const recipients = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  if (recipients.length > 0) return recipients
  if (process.env.NODE_ENV === "production") {
    throw new Error("OPENRX_ADMIN_EMAILS is required in production.")
  }
  return []
}

function resolveBaseUrl(origin?: string): string {
  if (origin) return origin
  if (process.env.OPENRX_APP_BASE_URL) return process.env.OPENRX_APP_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NODE_ENV === "production") {
    throw new Error("OPENRX_APP_BASE_URL is required in production when origin is unavailable.")
  }
  return "http://localhost:3000"
}

function buildActionUrl(params: {
  decision: AdminReviewDecision
  applicationId: string
  baseUrl: string
}): string {
  const token = createAdminReviewToken({
    applicationId: params.applicationId,
    decision: params.decision,
  })
  const url = new URL("/api/admin/applications/action", params.baseUrl)
  url.searchParams.set("token", token)
  return url.toString()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildMessage(params: {
  application: NetworkApplication
  approveUrl: string
  rejectUrl: string
}) {
  const { application, approveUrl, rejectUrl } = params
  const subject = `OpenRx application review: ${application.fullName} (${application.role})`
  const applicant = {
    role: escapeHtml(application.role),
    fullName: escapeHtml(application.fullName),
    email: escapeHtml(application.email),
    phone: escapeHtml(application.phone),
    npi: escapeHtml(application.npi || "N/A"),
    licenseNumber: escapeHtml(application.licenseNumber || "N/A"),
    licenseState: escapeHtml(application.licenseState || "N/A"),
    licensedStates: escapeHtml((application.licensedStates || []).join(", ") || "N/A"),
    orderingCertifyingStatus: escapeHtml(application.orderingCertifyingStatus || "N/A"),
    malpracticeCoverage: escapeHtml(application.malpracticeCoverage || "N/A"),
    specialtyOrRole: escapeHtml(application.specialtyOrRole),
    city: escapeHtml(application.city),
    state: escapeHtml(application.state),
    zip: escapeHtml(application.zip),
    servicesSummary: escapeHtml(application.servicesSummary),
    id: escapeHtml(application.id),
    approveUrl: escapeHtml(approveUrl),
    rejectUrl: escapeHtml(rejectUrl),
  }
  const text = [
    `A new ${application.role} application requires review.`,
    "",
    `Applicant: ${application.fullName}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    `NPI: ${application.npi || "N/A"}`,
    `License: ${application.licenseNumber || "N/A"}`,
    `Primary license state: ${application.licenseState || "N/A"}`,
    `All licensed states: ${(application.licensedStates || []).join(", ") || "N/A"}`,
    `Ordering/certifying status: ${application.orderingCertifyingStatus || "N/A"}`,
    `Professional liability coverage: ${application.malpracticeCoverage || "N/A"}`,
    `Attestations: state licensure=${application.stateLicensureAttestation ? "yes" : "no"}, ordering scope=${application.orderingScopeAttestation ? "yes" : "no"}, human review=${application.noAutoPrescriptionAttestation ? "yes" : "no"}, liability coverage=${application.malpracticeAttestation ? "yes" : "no"}`,
    `Specialty/Role: ${application.specialtyOrRole}`,
    `Location: ${application.city}, ${application.state} ${application.zip}`,
    `Summary: ${application.servicesSummary}`,
    "",
    `Application ID: ${application.id}`,
    "",
    `Approve: ${approveUrl}`,
    `Reject: ${rejectUrl}`,
  ].join("\n")

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #1f2937;">
  <h2 style="margin: 0 0 12px;">OpenRx application review required</h2>
  <p style="margin: 0 0 16px;">A new <strong>${applicant.role}</strong> application has been submitted.</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
    <tr><td><strong>Applicant</strong></td><td>${applicant.fullName}</td></tr>
    <tr><td><strong>Email</strong></td><td>${applicant.email}</td></tr>
    <tr><td><strong>Phone</strong></td><td>${applicant.phone}</td></tr>
    <tr><td><strong>NPI</strong></td><td>${applicant.npi}</td></tr>
    <tr><td><strong>License</strong></td><td>${applicant.licenseNumber}</td></tr>
    <tr><td><strong>Primary license state</strong></td><td>${applicant.licenseState}</td></tr>
    <tr><td><strong>All licensed states</strong></td><td>${applicant.licensedStates}</td></tr>
    <tr><td><strong>Ordering / certifying</strong></td><td>${applicant.orderingCertifyingStatus}</td></tr>
    <tr><td><strong>Liability coverage</strong></td><td>${applicant.malpracticeCoverage}</td></tr>
    <tr><td><strong>Attestations</strong></td><td>State licensure: ${application.stateLicensureAttestation ? "yes" : "no"} · Ordering scope: ${application.orderingScopeAttestation ? "yes" : "no"} · Human review: ${application.noAutoPrescriptionAttestation ? "yes" : "no"} · Liability: ${application.malpracticeAttestation ? "yes" : "no"}</td></tr>
    <tr><td><strong>Specialty / Role</strong></td><td>${applicant.specialtyOrRole}</td></tr>
    <tr><td><strong>Location</strong></td><td>${applicant.city}, ${applicant.state} ${applicant.zip}</td></tr>
    <tr><td><strong>Summary</strong></td><td>${applicant.servicesSummary}</td></tr>
    <tr><td><strong>Application ID</strong></td><td><code>${applicant.id}</code></td></tr>
  </table>
  <div style="margin-top: 20px;">
    <a href="${applicant.approveUrl}" style="display:inline-block; padding:10px 14px; background:#047857; color:#fff; text-decoration:none; border-radius:8px; margin-right:8px;">Approve</a>
    <a href="${applicant.rejectUrl}" style="display:inline-block; padding:10px 14px; background:#b91c1c; color:#fff; text-decoration:none; border-radius:8px;">Reject</a>
  </div>
</div>
`.trim()

  return { subject, text, html }
}

async function sendWithResend(params: {
  recipients: string[]
  subject: string
  text: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.OPENRX_EMAIL_FROM
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and OPENRX_EMAIL_FROM are required for email delivery.")
  }

  const response = await fetchWithTimeout(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.recipients,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
      cache: "no-store",
    },
    12000
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Resend delivery failed (${response.status}): ${details || "unknown error"}`)
  }
}

export async function sendAdminApplicationEmail(params: {
  application: NetworkApplication
  origin?: string
}) {
  const recipients = resolveAdminRecipients()
  if (recipients.length === 0) {
    if (process.env.NODE_ENV !== "production") return
    throw new Error("No admin recipients configured.")
  }

  const baseUrl = resolveBaseUrl(params.origin)
  const approveUrl = buildActionUrl({
    decision: "approved",
    applicationId: params.application.id,
    baseUrl,
  })
  const rejectUrl = buildActionUrl({
    decision: "rejected",
    applicationId: params.application.id,
    baseUrl,
  })

  const message = buildMessage({
    application: params.application,
    approveUrl,
    rejectUrl,
  })

  await sendWithResend({
    recipients,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })
}
