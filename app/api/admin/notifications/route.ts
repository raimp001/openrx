import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import {
  OPENRX_ADMIN_ID,
  listAdminNotifications,
  markAdminNotificationRead,
} from "@/lib/provider-applications"

function isAuthorizedAdminRequest(request: NextRequest): boolean {
  const required = process.env.OPENRX_ADMIN_API_KEY
  if (!required) return false
  const received = request.headers.get("x-admin-api-key") || ""
  if (received.length !== required.length) return false
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(required))
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get("adminId") || OPENRX_ADMIN_ID
  const notifications = await listAdminNotifications(adminId)
  const unreadCount = notifications.filter((item) => !item.isRead).length
  return NextResponse.json({
    notifications,
    unreadCount,
  })
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 })
  }
  try {
    const body = (await request.json()) as {
      notificationId?: string
    }
    if (!body.notificationId) {
      return NextResponse.json(
        { error: "notificationId is required." },
        { status: 400 }
      )
    }
    const notification = await markAdminNotificationRead(body.notificationId)
    return NextResponse.json({ notification })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notification."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
