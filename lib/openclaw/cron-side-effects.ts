import { NotificationType, UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  canSendEmail,
  getEmailAudienceMode,
  resolveAdminRecipients,
  sendEmail,
} from "@/lib/email-delivery"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import type { CronJobId } from "@/lib/openclaw/config"

type CronSideEffectJob = {
  id: CronJobId
  description: string
  agentId: string
  schedule: string
}

type CronSideEffectInput = {
  job: CronSideEffectJob
  sessionId: string
  triggeredAtIso: string
  agentResponse: string
}

export type CronSideEffectResult = {
  executed: boolean
  failed: boolean
  notificationsCreated: number
  emailsSent: number
  deployTriggered: boolean
  summaries: string[]
  warnings: string[]
}

function isMissingTableError(error: unknown): error is { code: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2021"
  )
}

function emptyResult(): CronSideEffectResult {
  return {
    executed: false,
    failed: false,
    notificationsCreated: 0,
    emailsSent: 0,
    deployTriggered: false,
    summaries: [],
    warnings: [],
  }
}

function looksLikeEmail(value?: string | null): value is string {
  return Boolean(value && value.includes("@"))
}

function formatWhen(value: Date): string {
  return value.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  })
}

async function ensureNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown>
  dedupeHours?: number
}) {
  const dedupeHours = params.dedupeHours ?? 24
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      createdAt: {
        gte: new Date(Date.now() - dedupeHours * 60 * 60 * 1000),
      },
    },
    select: { id: true },
  })

  if (existing) {
    return false
  }

  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata as never,
    },
  })

  return true
}

async function notifyAdmins(params: {
  title: string
  message: string
  metadata?: Record<string, unknown>
  emailSubject?: string
  emailText?: string
  dedupeHours?: number
}): Promise<{ notificationsCreated: number; emailsSent: number; warnings: string[] }> {
  const warnings: string[] = []
  const dedupeHours = params.dedupeHours ?? 12
  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  })

  let notificationsCreated = 0
  for (const admin of admins) {
    const created = await ensureNotification({
      userId: admin.id,
      type: NotificationType.GENERAL,
      title: params.title,
      message: params.message,
      metadata: params.metadata,
      dedupeHours,
    })
    if (created) notificationsCreated += 1
  }

  let emailsSent = 0
  const emailMode = getEmailAudienceMode()
  const recipients = resolveAdminRecipients()
  if (emailMode !== "off" && canSendEmail() && recipients.length > 0) {
    try {
      await sendEmail({
        to: recipients,
        subject: params.emailSubject || params.title,
        text: params.emailText || params.message,
      })
      emailsSent = recipients.length
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Failed to send admin email.")
    }
  } else if (emailMode !== "off" && recipients.length === 0) {
    warnings.push("OPENRX_ADMIN_EMAILS is not configured for admin email delivery.")
  }

  return { notificationsCreated, emailsSent, warnings }
}

async function maybeSendPatientEmail(params: {
  to?: string | null
  subject: string
  text: string
}) {
  const emailMode = getEmailAudienceMode()
  if (emailMode !== "all") return false
  if (!looksLikeEmail(params.to) || !canSendEmail()) return false
  await sendEmail({
    to: [params.to],
    subject: params.subject,
    text: params.text,
  })
  return true
}

async function executeAppointmentReminders(triggeredAt: Date) {
  const result = emptyResult()
  const nextDayStart = new Date(Date.UTC(
    triggeredAt.getUTCFullYear(),
    triggeredAt.getUTCMonth(),
    triggeredAt.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ))
  const nextDayEnd = new Date(nextDayStart.getTime() + 24 * 60 * 60 * 1000)

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: {
        gte: nextDayStart,
        lt: nextDayEnd,
      },
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
    },
    include: {
      patient: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      doctor: {
        include: {
          user: {
            select: { name: true },
          },
        },
      },
    },
    take: 50,
  })

  for (const appointment of appointments) {
    const patientUser = appointment.patient.user
    const doctorName = appointment.doctor.user.name || "your clinician"
    const message = `Reminder: your appointment with ${doctorName} is scheduled for ${formatWhen(appointment.scheduledAt)}.`
    const created = await ensureNotification({
      userId: patientUser.id,
      type: NotificationType.APPOINTMENT_REMINDER,
      title: "Appointment tomorrow",
      message,
      metadata: { appointmentId: appointment.id, jobId: "appointment-reminders" },
      dedupeHours: 36,
    })
    if (created) {
      result.notificationsCreated += 1
      result.executed = true
    }

    try {
      const emailed = await maybeSendPatientEmail({
        to: patientUser.email,
        subject: "OpenRx appointment reminder",
        text: `${message}\n\nIf you need to reschedule, open OpenRx and review your scheduling page.`,
      })
      if (emailed) {
        result.emailsSent += 1
        result.executed = true
      }
    } catch (error) {
      result.failed = true
      result.warnings.push(error instanceof Error ? error.message : "Failed to send appointment reminder email.")
    }
  }

  result.summaries.push(`Appointment reminders created for ${result.notificationsCreated} patient(s).`)
  return result
}

async function executeNoShowFollowup(triggeredAt: Date) {
  const result = emptyResult()
  const since = new Date(triggeredAt.getTime() - 72 * 60 * 60 * 1000)

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "NO_SHOW",
      scheduledAt: {
        gte: since,
        lte: triggeredAt,
      },
    },
    include: {
      patient: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      doctor: {
        include: {
          user: {
            select: { name: true },
          },
        },
      },
    },
    take: 50,
  })

  for (const appointment of appointments) {
    const patientUser = appointment.patient.user
    const doctorName = appointment.doctor.user.name || "your clinician"
    const message = `We noticed you missed your visit with ${doctorName} on ${formatWhen(appointment.scheduledAt)}. OpenRx can help you reschedule.`
    const created = await ensureNotification({
      userId: patientUser.id,
      type: NotificationType.APPOINTMENT_REMINDER,
      title: "Reschedule your missed visit",
      message,
      metadata: { appointmentId: appointment.id, jobId: "no-show-followup" },
      dedupeHours: 72,
    })
    if (created) {
      result.notificationsCreated += 1
      result.executed = true
    }
  }

  result.summaries.push(`No-show follow-up notifications created for ${result.notificationsCreated} patient(s).`)
  return result
}

async function executeRefillReminders(triggeredAt: Date) {
  const result = emptyResult()
  const cutoff = new Date(triggeredAt.getTime() + 7 * 24 * 60 * 60 * 1000)

  const prescriptions = await prisma.prescription.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        gte: triggeredAt,
        lte: cutoff,
      },
    },
    include: {
      patient: {
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      },
      medications: {
        select: { name: true },
      },
    },
    take: 50,
  })

  for (const prescription of prescriptions) {
    const patientUser = prescription.patient.user
    const medicationList =
      prescription.medications.map((item) => item.name).filter(Boolean).join(", ") || "your medication"
    const message = `${medicationList} may need a refill before ${formatWhen(prescription.expiresAt || cutoff)}. Review your prescription plan in OpenRx.`
    const created = await ensureNotification({
      userId: patientUser.id,
      type: NotificationType.PRESCRIPTION_READY,
      title: "Medication refill needed soon",
      message,
      metadata: { prescriptionId: prescription.id, jobId: "refill-reminders" },
      dedupeHours: 72,
    })
    if (created) {
      result.notificationsCreated += 1
      result.executed = true
    }
  }

  result.summaries.push(`Refill reminders created for ${result.notificationsCreated} prescription(s).`)
  return result
}

async function executeScreeningReminders(triggeredAt: Date) {
  const result = emptyResult()
  const cooldown = new Date(triggeredAt.getTime() - 30 * 24 * 60 * 60 * 1000)
  const patients = await prisma.patientProfile.findMany({
    where: {
      dateOfBirth: {
        not: null,
      },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    take: 100,
  })

  for (const profile of patients) {
    if (!profile.dateOfBirth) continue
    const age = Math.floor((triggeredAt.getTime() - profile.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    const needsReminder = age >= 45
    if (!needsReminder) continue

    const title = "Preventive screening review recommended"
    const message =
      age >= 50
        ? "You are in a screening window where colon, breast, prostate, lung, or other preventive studies may be due. Review your screening plan in OpenRx."
        : "Your age and history suggest it is worth reviewing preventive screening timing in OpenRx."

    const existing = await prisma.notification.findFirst({
      where: {
        userId: profile.userId,
        title,
        createdAt: {
          gte: cooldown,
        },
      },
      select: { id: true },
    })

    if (existing) continue

    await prisma.notification.create({
      data: {
        userId: profile.userId,
        type: NotificationType.GENERAL,
        title,
        message,
        metadata: {
          jobId: "screening-reminders",
          age,
        } as never,
      },
    })
    result.notificationsCreated += 1
    result.executed = true
  }

  result.summaries.push(`Preventive screening reminders created for ${result.notificationsCreated} patient(s).`)
  return result
}

async function executeAdminDigest(jobId: CronJobId, agentResponse: string) {
  const result = emptyResult()
  const titleMap: Record<CronJobId, string> = {
    "appointment-reminders": "Appointment reminder run complete",
    "adherence-check": "Medication adherence review ready",
    "claim-followup": "Claims follow-up summary ready",
    "pa-status-check": "Prior auth status summary ready",
    "no-show-followup": "No-show follow-up run complete",
    "refill-reminders": "Refill reminder run complete",
    "screening-reminders": "Screening reminder run complete",
    "daily-health-check": "Daily health check summary ready",
    "daily-deploy": "Deployment action summary ready",
    "security-audit": "Security audit summary ready",
  }

  const message = agentResponse.trim().slice(0, 4000)
  const digest = await notifyAdmins({
    title: titleMap[jobId],
    message,
    metadata: { jobId },
    emailSubject: `OpenRx ${titleMap[jobId]}`,
    emailText: message,
  })

  result.notificationsCreated += digest.notificationsCreated
  result.emailsSent += digest.emailsSent
  result.warnings.push(...digest.warnings)
  result.executed = digest.notificationsCreated > 0 || digest.emailsSent > 0
  result.summaries.push(`Admin digest created for ${jobId}.`)
  return result
}

async function executeDailyDeploy(agentResponse: string) {
  const result = emptyResult()
  const deployHookUrl = process.env.OPENRX_VERCEL_DEPLOY_HOOK_URL?.trim()
  if (!deployHookUrl) {
    result.failed = true
    result.warnings.push("OPENRX_VERCEL_DEPLOY_HOOK_URL is not configured.")
    return result
  }

  const response = await fetchWithTimeout(
    deployHookUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "openrx-daily-deploy",
        summary: agentResponse.slice(0, 4000),
      }),
      cache: "no-store",
    },
    15000
  )

  if (!response.ok) {
    const details = await response.text()
    result.failed = true
    result.warnings.push(`Deploy hook failed (${response.status}): ${details || "unknown error"}`)
    return result
  }

  result.deployTriggered = true
  result.executed = true
  result.summaries.push("Deployment hook triggered successfully.")

  const digest = await notifyAdmins({
    title: "OpenRx deployment triggered",
    message: "The daily deploy job triggered the configured deployment hook.",
    metadata: { jobId: "daily-deploy" },
    emailSubject: "OpenRx deployment triggered",
    emailText: `The daily deploy hook was triggered successfully.\n\nAgent summary:\n${agentResponse}`,
  })
  result.notificationsCreated += digest.notificationsCreated
  result.emailsSent += digest.emailsSent
  result.warnings.push(...digest.warnings)

  return result
}

export async function executeCronSideEffects(
  input: CronSideEffectInput
): Promise<CronSideEffectResult> {
  const triggeredAt = new Date(input.triggeredAtIso)
  try {
    switch (input.job.id) {
      case "appointment-reminders":
        return executeAppointmentReminders(triggeredAt)
      case "no-show-followup":
        return executeNoShowFollowup(triggeredAt)
      case "refill-reminders":
        return executeRefillReminders(triggeredAt)
      case "screening-reminders":
        return executeScreeningReminders(triggeredAt)
      case "daily-deploy":
        return executeDailyDeploy(input.agentResponse)
      case "adherence-check":
      case "claim-followup":
      case "pa-status-check":
      case "daily-health-check":
      case "security-audit":
        return executeAdminDigest(input.job.id, input.agentResponse)
      default:
        return emptyResult()
    }
  } catch (error) {
    const result = emptyResult()
    if (isMissingTableError(error)) {
      result.warnings.push("Core application tables are unavailable for this side-effect handler.")
      return result
    }
    result.failed = true
    result.warnings.push(error instanceof Error ? error.message : "Cron side effects failed.")
    return result
  }
}
