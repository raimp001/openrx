import { expect, test } from "@playwright/test"
import {
  assertOutboundNotificationPhiFree,
  containsPhiValue,
  planPhiSafeNotification,
  referralNotificationEventForStatus,
} from "@/lib/phi-safe-notifications"

const NOW = new Date("2026-06-09T12:00:00.000Z")

test("email and SMS bodies never contain values from the PHI field set", () => {
  const planned = planPhiSafeNotification({
    id: "notif_1",
    recipientType: "patient",
    recipientId: "patient_1",
    eventType: "referral_requested",
    entityId: "ref_1",
    deepLink: "/referrals/ref_1",
    requestedChannels: ["in_app", "email", "sms"],
    phiValues: [
      "Avery Patient",
      "OpenRx Gastroenterology",
      "Colorectal cancer screening",
      "family history of colon cancer",
    ],
    now: NOW,
  })

  expect(planned.outboundMessages).toHaveLength(2)
  planned.outboundMessages.forEach((message) => {
    expect(message.subject).toBe("OpenRx update")
    expect(message.body).toContain("Sign in to view")
    expect(containsPhiValue(`${message.subject}\n${message.body}`, [
      "Avery Patient",
      "OpenRx Gastroenterology",
      "Colorectal cancer screening",
    ])).toBe(false)
    expect(() => assertOutboundNotificationPhiFree(message, ["Colorectal cancer screening"])).not.toThrow()
  })
})

test("triggering the same event twice sends exactly one outbound notification set", () => {
  const first = planPhiSafeNotification({
    id: "notif_1",
    recipientType: "provider",
    recipientId: "provider_1",
    eventType: "info_requested",
    entityId: "ref_1",
    deepLink: "/provider/referrals/ref_1",
    requestedChannels: ["in_app", "email"],
    now: NOW,
  })
  const second = planPhiSafeNotification({
    id: "notif_2",
    recipientType: "provider",
    recipientId: "provider_1",
    eventType: "info_requested",
    entityId: "ref_1",
    deepLink: "/provider/referrals/ref_1",
    requestedChannels: ["in_app", "email"],
    existingNotifications: [first.notification],
    now: NOW,
  })

  expect(first.duplicate).toBe(false)
  expect(first.outboundMessages).toHaveLength(1)
  expect(second.duplicate).toBe(true)
  expect(second.outboundMessages).toHaveLength(0)
  expect(second.auditRows).toHaveLength(0)
})

test("referral state changes map to the correct PHI-safe notification event", () => {
  expect(referralNotificationEventForStatus("requested")).toBe("referral_requested")
  expect(referralNotificationEventForStatus("accepted")).toBe("referral_accepted")
  expect(referralNotificationEventForStatus("declined")).toBe("referral_declined")
  expect(referralNotificationEventForStatus("expired")).toBe("referral_expired")
  expect(referralNotificationEventForStatus("info_requested")).toBe("info_requested")
  expect(referralNotificationEventForStatus("scheduled")).toBeNull()
})
