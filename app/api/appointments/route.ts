import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AppointmentStatus } from '@prisma/client'

// GET /api/appointments - List appointments with optional filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const doctorId = searchParams.get('doctorId')
    const status = searchParams.get('status') as AppointmentStatus | null
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId
    if (status) where.status = status
    if (from || to) {
      where.scheduledAt = {}
      if (from) (where.scheduledAt as Record<string, unknown>).gte = new Date(from)
      if (to) (where.scheduledAt as Record<string, unknown>).lte = new Date(to)
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          doctor: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          prescriptions: true,
          payment: true,
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ])

    return NextResponse.json({
      appointments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

// POST /api/appointments - Create a new appointment
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const body = await request.json()
    const {
      patientId,
      doctorId,
      scheduledAt,
      duration = 30,
      type = 'consultation',
      reason,
      notes,
      paymentAmount,
      transactionHash,
    } = body

    // Validate required fields
    if (!patientId || !doctorId || !scheduledAt) {
      return NextResponse.json(
        { error: 'patientId, doctorId, and scheduledAt are required' },
        { status: 400 }
      )
    }

    // Check for scheduling conflicts
    const scheduledDate = new Date(scheduledAt)
    const endTime = new Date(scheduledDate.getTime() + duration * 60 * 1000)

    // Fetch candidates whose start time could possibly overlap with the new slot.
    // We check a generous window (4 hours before the new slot start) since we can't
    // compute end times in SQL. True overlap is verified in-app below.
    const candidates = await prisma.appointment.findMany({
      where: {
        doctorId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: {
          lt: endTime,
          gte: new Date(scheduledDate.getTime() - 240 * 60 * 1000),
        },
      },
      select: { scheduledAt: true, duration: true },
    })

    const hasConflict = candidates.some((appt) => {
      const existingStart = new Date(appt.scheduledAt).getTime()
      const existingEnd = existingStart + (appt.duration || 30) * 60 * 1000
      return existingStart < endTime.getTime() && existingEnd > scheduledDate.getTime()
    })

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Doctor has a conflicting appointment at this time' },
        { status: 409 }
      )
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        scheduledAt: scheduledDate,
        duration,
        type,
        reason,
        notes,
        paymentAmount,
        transactionHash,
        status: transactionHash ? 'CONFIRMED' : 'PENDING',
      },
      include: {
        patient: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        doctor: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    // Create notification for doctor
    await prisma.notification.create({
      data: {
        userId: appointment.doctor.userId,
        type: 'APPOINTMENT_REMINDER',
        title: 'New Appointment Booked',
        message: `New appointment scheduled for ${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString()}`,
        metadata: { appointmentId: appointment.id },
      },
    })

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    )
  }
}

// PATCH /api/appointments - Update appointment status
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const body = await request.json()
    const { id, status, notes, meetingUrl } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    }

    if (status) {
      const existing = await prisma.appointment.findUnique({ where: { id }, select: { status: true } })
      if (!existing) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }
      const allowed = validTransitions[existing.status] || []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${status}` },
          { status: 422 }
        )
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes && { notes }),
        ...(meetingUrl && { meetingUrl }),
      },
      include: {
        patient: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        doctor: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    // Notify patient of status change
    if (status) {
      await prisma.notification.create({
        data: {
          userId: appointment.patient.userId,
          type: 'APPOINTMENT_REMINDER',
          title: `Appointment ${status.charAt(0) + status.slice(1).toLowerCase()}`,
          message: `Your appointment on ${appointment.scheduledAt.toLocaleDateString()} has been ${status.toLowerCase()}`,
          metadata: { appointmentId: appointment.id },
        },
      })
    }

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    )
  }
}

// DELETE /api/appointments - Cancel appointment
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({ message: 'Appointment cancelled', appointment })
  } catch (error) {
    console.error('Error cancelling appointment:', error)
    return NextResponse.json(
      { error: 'Failed to cancel appointment' },
      { status: 500 }
    )
  }
}
