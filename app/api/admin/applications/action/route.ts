import { NextRequest, NextResponse } from "next/server"
import { verifyAdminReviewToken } from "@/lib/admin-review-token"
import { reviewNetworkApplication } from "@/lib/provider-applications"

export const dynamic = "force-dynamic"

function renderHtml(params: {
  title: string
  message: string
  tone: "success" | "error"
}): string {
  const color = params.tone === "success" ? "#047857" : "#b91c1c"
  const title = escapeHtml(params.title)
  const message = escapeHtml(params.message)
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f2; color: #111827; margin: 0; padding: 28px;">
    <div style="max-width: 620px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
      <h1 style="margin: 0 0 10px; font-size: 22px; color: ${color};">${title}</h1>
      <p style="margin: 0; font-size: 14px; line-height: 1.5;">${message}</p>
    </div>
  </body>
</html>
`.trim()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") || ""
  if (!token) {
    return new NextResponse(
      renderHtml({
        title: "Invalid review link",
        message: "This review link is missing a token.",
        tone: "error",
      }),
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
    )
  }

  try {
    const payload = verifyAdminReviewToken(token)
    const application = await reviewNetworkApplication({
      applicationId: payload.applicationId,
      decision: payload.decision,
      reviewer: "email-admin",
      notes: `Decision applied from signed email action link.`,
    })

    return new NextResponse(
      renderHtml({
        title: `Application ${application.status}`,
        message: `Application ${application.id} for ${application.fullName} is now marked as ${application.status}.`,
        tone: "success",
      }),
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review action failed."
    return new NextResponse(
      renderHtml({
        title: "Review action failed",
        message,
        tone: "error",
      }),
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
    )
  }
}
