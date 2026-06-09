export type NotificationRecipientType = "patient" | "provider"

export type NotificationChannel = "in_app" | "email" | "sms"

export type PhiSafeNotificationEventType =
  | "referral_requested"
  | "referral_accepted"
  | "referral_declined"
  | "referral_expired"
  | "info_requested"
  | "screening_due"
  | "provider_verified"

export interface PhiSafeNotificationRecord {
  id: string
  recipientType: NotificationRecipientType
  recipientId: string
  eventType: PhiSafeNotificationEventType
  entityId: string
  deepLink: string
  channelsSent: NotificationChannel[]
  createdAt: string
  readAt?: string
}

export interface OutboundNotificationMessage {
  channel: Exclude<NotificationChannel, "in_app">
  subject: string
  body: string
  deepLink: string
}

export interface NotificationAuditRow {
  eventType: string
  actor: string
  createdAt: string
  metadata: {
    notificationEventType: PhiSafeNotificationEventType
    recipientType: NotificationRecipientType
    recipientId: string
    channelsSent: NotificationChannel[]
    entityId: string
  }
}

export interface PlannedNotification {
  notification: PhiSafeNotificationRecord
  outboundMessages: OutboundNotificationMessage[]
  auditRows: NotificationAuditRow[]
  duplicate: boolean
}

const OUTBOUND_SUBJECT = "OpenRx update"
const OUTBOUND_BODY = "You have a new update in OpenRx. Sign in to view it."

function nowIso(now: Date = new Date()): string {
  return now.toISOString()
}

function notificationKey(input: {
  eventType: PhiSafeNotificationEventType
  entityId: string
  recipientId: string
}): string {
  return `${input.eventType}:${input.entityId}:${input.recipientId}`
}

export function buildPhiSafeOutboundMessage(params: {
  channel: Exclude<NotificationChannel, "in_app">
  deepLink: string
}): OutboundNotificationMessage {
  return {
    channel: params.channel,
    subject: OUTBOUND_SUBJECT,
    body: `${OUTBOUND_BODY}\n\n${params.deepLink}`,
    deepLink: params.deepLink,
  }
}

export function containsPhiValue(text: string, phiValues: unknown[]): boolean {
  const normalized = text.toLowerCase()
  return phiValues
    .flatMap((value) => {
      if (value === undefined || value === null) return []
      if (Array.isArray(value)) return value
      if (typeof value === "object") return Object.values(value as Record<string, unknown>)
      return [value]
    })
    .map((value) => String(value).trim())
    .filter((value) => value.length >= 3)
    .some((value) => normalized.includes(value.toLowerCase()))
}

export function assertOutboundNotificationPhiFree(
  message: OutboundNotificationMessage,
  phiValues: unknown[]
) {
  const combined = `${message.subject}\n${message.body}`
  if (containsPhiValue(combined, phiValues)) {
    throw new Error("Outbound notification contains PHI and must be replaced with a neutral pointer.")
  }
}

export function planPhiSafeNotification(params: {
  id: string
  recipientType: NotificationRecipientType
  recipientId: string
  eventType: PhiSafeNotificationEventType
  entityId: string
  deepLink: string
  requestedChannels: NotificationChannel[]
  existingNotifications?: PhiSafeNotificationRecord[]
  phiValues?: unknown[]
  now?: Date
}): PlannedNotification {
  const existing = (params.existingNotifications || []).find(
    (item) =>
      notificationKey(item) ===
      notificationKey({
        eventType: params.eventType,
        entityId: params.entityId,
        recipientId: params.recipientId,
      })
  )
  if (existing) {
    return {
      notification: existing,
      outboundMessages: [],
      auditRows: [],
      duplicate: true,
    }
  }

  const uniqueChannels = Array.from(new Set(params.requestedChannels))
  const outboundMessages = uniqueChannels
    .filter((channel): channel is Exclude<NotificationChannel, "in_app"> => channel === "email" || channel === "sms")
    .map((channel) => buildPhiSafeOutboundMessage({ channel, deepLink: params.deepLink }))

  outboundMessages.forEach((message) => {
    assertOutboundNotificationPhiFree(message, params.phiValues || [])
  })

  const notification: PhiSafeNotificationRecord = {
    id: params.id,
    recipientType: params.recipientType,
    recipientId: params.recipientId,
    eventType: params.eventType,
    entityId: params.entityId,
    deepLink: params.deepLink,
    channelsSent: uniqueChannels,
    createdAt: nowIso(params.now),
  }

  const auditRows: NotificationAuditRow[] = uniqueChannels.map((channel) => ({
    eventType: "notification.sent",
    actor: "system",
    createdAt: notification.createdAt,
    metadata: {
      notificationEventType: params.eventType,
      recipientType: params.recipientType,
      recipientId: params.recipientId,
      channelsSent: [channel],
      entityId: params.entityId,
    },
  }))

  return {
    notification,
    outboundMessages,
    auditRows,
    duplicate: false,
  }
}

export function referralNotificationEventForStatus(status: string): PhiSafeNotificationEventType | null {
  switch (status) {
    case "requested":
      return "referral_requested"
    case "accepted":
      return "referral_accepted"
    case "declined":
      return "referral_declined"
    case "expired":
      return "referral_expired"
    case "info_requested":
      return "info_requested"
    default:
      return null
  }
}
