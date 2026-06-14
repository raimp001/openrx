import { test, expect } from "@playwright/test"
import { AppointmentStatus, NotificationType, PrismaClient, UserRole } from "@prisma/client"
import { executeCronSideEffects } from "@/lib/openclaw/cron-side-effects"

const prisma = process.env.DATABASE_URL ? new PrismaClient() : null

async function hasCoreTables() {
  if (!prisma) return false
  try {
    await prisma.user.findFirst({ select: { id: true } })
    return true
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2021"
    ) {
      return false
    }
    throw error
  }
}

test("appointment reminder side effects create patient notifications", async () => {
  if (!process.env.DATABASE_URL) {
    test.skip(true, "DATABASE_URL is not configured for local cron side-effect tests.")
  }

  if (!(await hasCoreTables())) {
    test.skip(true, "Local database schema is missing core Prisma tables.")
  }

  if (!prisma) {
    test.skip(true, "Prisma client is unavailable without DATABASE_URL.")
    return
  }

  const db = prisma
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const originalEmailMode = process.env.OPENRX_CRON_EMAIL_MODE
  process.env.OPENRX_CRON_EMAIL_MODE = "off"

  const patientUser = await db.user.create({
    data: {
      email: `patient-${suffix}@example.com`,
      name: "Reminder Patient",
      role: UserRole.PATIENT,
    },
  })

  const doctorUser = await db.user.create({
    data: {
      email: `doctor-${suffix}@example.com`,
      name: "Reminder Doctor",
      role: UserRole.DOCTOR,
    },
  })

  try {
    const patient = await db.patientProfile.create({
      data: {
        userId: patientUser.id,
      },
    })

    const doctor = await db.doctorProfile.create({
      data: {
        userId: doctorUser.id,
        specialty: "Internal Medicine",
        licenseNumber: `LIC-${suffix}`,
      },
    })

    const appointment = await db.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt: new Date("2026-03-24T17:00:00Z"),
        status: AppointmentStatus.CONFIRMED,
      },
    })

    const result = await executeCronSideEffects({
      job: {
        id: "appointment-reminders",
        description: "Send appointment reminders for tomorrow's schedule",
        agentId: "scheduling",
        schedule: "0 8 * * *",
      },
      sessionId: `test-${suffix}`,
      triggeredAtIso: "2026-03-23T08:00:00Z",
      agentResponse: "Reminder run ready",
    })

    expect(result.failed).toBe(false)
    expect(result.notificationsCreated).toBeGreaterThan(0)

    const notifications = await db.notification.findMany({
      where: {
        userId: patientUser.id,
        type: NotificationType.APPOINTMENT_REMINDER,
      },
    })

    expect(notifications.length).toBeGreaterThan(0)
    expect(notifications[0]?.title).toContain("Appointment")

    await db.appointment.delete({ where: { id: appointment.id } })
    await db.doctorProfile.delete({ where: { id: doctor.id } })
    await db.patientProfile.delete({ where: { id: patient.id } })
  } finally {
    await db.notification.deleteMany({
      where: {
        userId: {
          in: [patientUser.id, doctorUser.id],
        },
      },
    })
    await db.user.deleteMany({
      where: {
        id: {
          in: [patientUser.id, doctorUser.id],
        },
      },
    })
    process.env.OPENRX_CRON_EMAIL_MODE = originalEmailMode
  }
})
