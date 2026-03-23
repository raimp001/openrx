import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

export type EmailAudienceMode = "off" | "admins" | "all"

export function getEmailAudienceMode(): EmailAudienceMode {
  const raw = (process.env.OPENRX_CRON_EMAIL_MODE || "admins").trim().toLowerCase()
  if (raw === "off" || raw === "admins" || raw === "all") return raw
  return "admins"
}

export function resolveAdminRecipients(): string[] {
  return (process.env.OPENRX_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.OPENRX_EMAIL_FROM?.trim())
}

export async function sendEmail(params: {
  to: string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.OPENRX_EMAIL_FROM?.trim()
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and OPENRX_EMAIL_FROM are required for email delivery.")
  }

  const recipients = params.to.map((item) => item.trim()).filter(Boolean)
  if (recipients.length === 0) {
    throw new Error("At least one email recipient is required.")
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
        to: recipients,
        subject: params.subject,
        text: params.text,
        html: params.html || params.text.replace(/\n/g, "<br />"),
        reply_to: params.replyTo || undefined,
      }),
      cache: "no-store",
    },
    12000
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Resend delivery failed (${response.status}): ${details || "unknown error"}`)
  }

  return response.json().catch(() => null)
}
