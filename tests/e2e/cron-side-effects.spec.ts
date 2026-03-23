import { test, expect } from "@playwright/test"
import { AppointmentStatus, NotificationType, PrismaClient, UserRole } from "@prisma/client"
import { executeCronSideEffects } from "@/lib/openclaw/cron-side-effects"

const prisma = new PrismaClient()

async function hasCoreTables() {
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
  if (!(await hasCoreTables())) {
    test.skip(true, "Local database schema is missing core Prisma tables.")
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const originalEmailMode = process.env.OPENRX_CRON_EMAIL_MODE
  process.env.OPENRX_CRON_EMAIL_MODE = "off"

  const patientUser = await prisma.user.create({
    data: {
      email: `patient-${suffix}@example.com`,
      name: "Reminder Patient",
      role: UserRole.PATIENT,
    },
  })

  const doctorUser = await prisma.user.create({
    data: {
      email: `doctor-${suffix}@example.com`,
      name: "Reminder Doctor",
      role: UserRole.DOCTOR,
    },
  })

  try {
    const patient = await prisma.patientProfile.create({
      data: {
        userId: patientUser.id,
      },
    })

    const doctor = await prisma.doctorProfile.create({
      data: {
        userId: doctorUser.id,
        specialty: "Internal Medicine",
        licenseNumber: `LIC-${suffix}`,
      },
    })

    const appointment = await prisma.appointment.create({
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

    const notifications = await prisma.notification.findMany({
      where: {
        userId: patientUser.id,
        type: NotificationType.APPOINTMENT_REMINDER,
      },
    })

    expect(notifications.length).toBeGreaterThan(0)
    expect(notifications[0]?.title).toContain("Appointment")

    await prisma.appointment.delete({ where: { id: appointment.id } })
    await prisma.doctorProfile.delete({ where: { id: doctor.id } })
    await prisma.patientProfile.delete({ where: { id: patient.id } })
  } finally {
    await prisma.notification.deleteMany({
      where: {
        userId: {
          in: [patientUser.id, doctorUser.id],
        },
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [patientUser.id, doctorUser.id],
        },
      },
    })
    process.env.OPENRX_CRON_EMAIL_MODE = originalEmailMode
  }
})
