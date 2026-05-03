import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const DEFAULT_SLOT_DURATION = 30
const DEFAULT_DAY_START_HOUR = 8
const DEFAULT_DAY_END_HOUR = 17

interface AvailableSlot {
  start: string
  end: string
  doctorId: string
  doctorName: string
  specialty: string
  duration: number
}

function generateTimeSlots(date: Date, startHour: number, endHour: number, durationMinutes: number): Date[] {
  const slots: Date[] = []
  const slotStart = new Date(date)
  slotStart.setHours(startHour, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(endHour, 0, 0, 0)

  while (slotStart.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
    slots.push(new Date(slotStart))
    slotStart.setMinutes(slotStart.getMinutes() + durationMinutes)
  }

  return slots
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response

  const { searchParams } = new URL(request.url)
  const doctorId = searchParams.get("doctorId")
  const dateStr = searchParams.get("date")
  const specialty = searchParams.get("specialty")
  const durationParam = parseInt(searchParams.get("duration") || String(DEFAULT_SLOT_DURATION))
  const duration = Math.min(Math.max(durationParam || DEFAULT_SLOT_DURATION, 15), 120)

  if (!dateStr) {
    return NextResponse.json({ error: "date query parameter is required (YYYY-MM-DD)" }, { status: 400 })
  }

  const targetDate = new Date(dateStr + "T00:00:00")
  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 })
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (targetDate < today) {
    return NextResponse.json({ error: "Cannot check availability for past dates" }, { status: 400 })
  }

  try {
    const doctorWhere: Record<string, unknown> = { isVerified: true }
    if (doctorId) doctorWhere.id = doctorId
    if (specialty) doctorWhere.specialty = { contains: specialty, mode: "insensitive" }

    const doctors = await prisma.doctorProfile.findMany({
      where: doctorWhere,
      include: { user: { select: { name: true } } },
      take: 20,
    })

    if (doctors.length === 0) {
      return NextResponse.json({ slots: [], message: "No matching doctors found" })
    }

    const dayStart = new Date(targetDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(targetDate)
    dayEnd.setHours(23, 59, 59, 999)

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: { in: doctors.map((d) => d.id) },
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { doctorId: true, scheduledAt: true, duration: true },
    })

    const bookedByDoctor = new Map<string, { start: number; end: number }[]>()
    for (const apt of existingAppointments) {
      const startMs = apt.scheduledAt.getTime()
      const endMs = startMs + apt.duration * 60_000
      const existing = bookedByDoctor.get(apt.doctorId) || []
      existing.push({ start: startMs, end: endMs })
      bookedByDoctor.set(apt.doctorId, existing)
    }

    const availableSlots: AvailableSlot[] = []

    for (const doctor of doctors) {
      let startHour = DEFAULT_DAY_START_HOUR
      let endHour = DEFAULT_DAY_END_HOUR

      if (doctor.availableSlots && typeof doctor.availableSlots === "object") {
        const slots = doctor.availableSlots as Record<string, unknown>
        if (typeof slots.startHour === "number") startHour = slots.startHour
        if (typeof slots.endHour === "number") endHour = slots.endHour
      }

      const possibleSlots = generateTimeSlots(targetDate, startHour, endHour, duration)
      const booked = bookedByDoctor.get(doctor.id) || []

      for (const slotStart of possibleSlots) {
        if (slotStart.getTime() < now.getTime()) continue

        const slotEnd = new Date(slotStart.getTime() + duration * 60_000)
        const hasConflict = booked.some(
          (b) => slotStart.getTime() < b.end && slotEnd.getTime() > b.start
        )

        if (!hasConflict) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            doctorId: doctor.id,
            doctorName: doctor.user.name || "Dr. Unknown",
            specialty: doctor.specialty,
            duration,
          })
        }
      }
    }

    availableSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return NextResponse.json({
      date: dateStr,
      slots: availableSlots,
      totalAvailable: availableSlots.length,
    })
  } catch (error) {
    console.error("Error fetching availability:", error)
    return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 })
  }
}
