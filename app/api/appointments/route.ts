import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AppointmentStatus } from '@prisma/client'
import { resolveClinicSession } from '@/lib/clinic-auth'

const MAX_LIMIT = 100
const VALID_STATUSES: string[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']

// GET /api/appointments - List appointments with optional filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const session = await resolveClinicSession(request)
    if (session.authSource === 'default' && session.userId === 'anonymous') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const doctorId = searchParams.get('doctorId')
    const status = searchParams.get('status') as AppointmentStatus | null
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const rawLimit = parseInt(searchParams.get('limit') || '20')
    const limit = Math.min(Math.max(rawLimit || 20, 1), MAX_LIMIT)
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1)
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }

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
    const session = await resolveClinicSession(request)
    if (session.authSource === 'default' && session.userId === 'anonymous') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const b = body as Record<string, unknown>
    const patientId = typeof b.patientId === "string" ? b.patientId : ""
    const doctorId = typeof b.doctorId === "string" ? b.doctorId : ""
    const scheduledAt = b.scheduledAt
    const duration = typeof b.duration === "number" ? b.duration : 30
    const type = typeof b.type === "string" ? b.type : "consultation"
    const reason = typeof b.reason === "string" ? b.reason : undefined
    const notes = typeof b.notes === "string" ? b.notes : undefined
    const paymentAmount = typeof b.paymentAmount === "number" ? b.paymentAmount : undefined
    const transactionHash = typeof b.transactionHash === "string" ? b.transactionHash : undefined

    // Validate required fields
    if (!patientId || !doctorId || !scheduledAt) {
      return NextResponse.json(
        { error: 'patientId, doctorId, and scheduledAt are required' },
        { status: 400 }
      )
    }

    // Check for scheduling conflicts
    const scheduledDate = new Date(String(scheduledAt))
    const endTime = new Date(scheduledDate.getTime() + duration * 60 * 1000)

    const conflict = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [
          { scheduledAt: { lt: endTime } },
          {
            scheduledAt: {
              gte: new Date(scheduledDate.getTime() - (duration as number) * 60 * 1000),
            },
          },
        ],
      },
    })

    if (conflict) {
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/appointments - Update appointment status
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const session = await resolveClinicSession(request)
    if (session.authSource === 'default' && session.userId === 'anonymous') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const b2 = body as Record<string, unknown>
    const id = typeof b2.id === "string" ? b2.id : ""
    const status = typeof b2.status === "string" ? b2.status : undefined
    const notes = typeof b2.notes === "string" ? b2.notes : undefined
    const meetingUrl = typeof b2.meetingUrl === "string" ? b2.meetingUrl : undefined

    if (!id) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (status && VALID_STATUSES.includes(status)) updateData.status = status as AppointmentStatus
    if (notes) updateData.notes = notes
    if (meetingUrl) updateData.meetingUrl = meetingUrl

    const appointment = await prisma.appointment.update({
      where: { id: id as string },
      data: updateData,
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/appointments - Cancel appointment
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const session = await resolveClinicSession(request)
    if (session.authSource === 'default' && session.userId === 'anonymous') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
