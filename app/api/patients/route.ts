import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveClinicSession } from '@/lib/clinic-auth'

const MAX_LIMIT = 100
const MAX_SEARCH_LENGTH = 200

// GET /api/patients - Get patient profile(s)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const session = await resolveClinicSession(request)
    if (session.authSource === 'default' && session.userId === 'anonymous') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const patientId = searchParams.get('patientId')
    const search = searchParams.get('search')
    const rawLimit = parseInt(searchParams.get('limit') || '20')
    const limit = Math.min(Math.max(rawLimit || 20, 1), MAX_LIMIT)
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1)
    const skip = (page - 1) * limit

    if (search && search.length > MAX_SEARCH_LENGTH) {
      return NextResponse.json({ error: `Search query too long. Maximum ${MAX_SEARCH_LENGTH} characters.` }, { status: 400 })
    }

    // Get single patient by userId
    if (userId) {
      const patient = await prisma.patientProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, walletAddress: true },
          },
          appointments: {
            orderBy: { scheduledAt: 'desc' },
            take: 5,
            include: {
              doctor: {
                include: { user: { select: { name: true } } },
              },
            },
          },
          prescriptions: {
            where: { status: 'ACTIVE' },
            include: { medications: true },
          },
          vitalSigns: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
      })

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }

      return NextResponse.json(patient)
    }

    // Get single patient by patientId
    if (patientId) {
      const patient = await prisma.patientProfile.findUnique({
        where: { id: patientId },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          appointments: {
            orderBy: { scheduledAt: 'desc' },
            take: 10,
          },
          prescriptions: {
            include: { medications: true },
          },
          medicalRecords: {
            orderBy: { recordDate: 'desc' },
          },
          labResults: {
            orderBy: { testDate: 'desc' },
            take: 10,
          },
          vitalSigns: {
            orderBy: { recordedAt: 'desc' },
            take: 10,
          },
        },
      })

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }

      return NextResponse.json(patient)
    }

    // List all patients with optional search
    const where = search
      ? {
          user: {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}

    const [patients, total] = await Promise.all([
      prisma.patientProfile.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          vitalSigns: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
        skip,
        take: limit,
      }),
      prisma.patientProfile.count({ where }),
    ])

    return NextResponse.json({
      patients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
      { status: 500 }
    )
  }
}

// POST /api/patients - Create patient profile
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const body = await request.json()
    const {
      userId,
      dateOfBirth,
      gender,
      phone,
      address,
      emergencyContact,
      bloodType,
      allergies,
      insuranceId,
      insuranceProvider,
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Check if profile already exists
    const existing = await prisma.patientProfile.findUnique({
      where: { userId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Patient profile already exists for this user' },
        { status: 409 }
      )
    }

    const patient = await prisma.patientProfile.create({
      data: {
        userId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        phone,
        address,
        emergencyContact,
        bloodType,
        allergies: allergies || [],
        insuranceId,
        insuranceProvider,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('Error creating patient profile:', error)
    return NextResponse.json(
      { error: 'Failed to create patient profile' },
      { status: 500 }
    )
  }
}

// PATCH /api/patients - Update patient profile
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const body = await request.json()
    const {
      patientId,
      userId,
      dateOfBirth,
      gender,
      phone,
      address,
      emergencyContact,
      bloodType,
      allergies,
      insuranceId,
      insuranceProvider,
    } = body

    if (!patientId && !userId) {
      return NextResponse.json(
        { error: 'patientId or userId is required' },
        { status: 400 }
      )
    }

    const where = patientId ? { id: patientId } : { userId }

    const patient = await prisma.patientProfile.update({
      where,
      data: {
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender !== undefined && { gender }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(emergencyContact !== undefined && { emergencyContact }),
        ...(bloodType !== undefined && { bloodType }),
        ...(allergies !== undefined && { allergies }),
        ...(insuranceId !== undefined && { insuranceId }),
        ...(insuranceProvider !== undefined && { insuranceProvider }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(patient)
  } catch (error) {
    console.error('Error updating patient profile:', error)
    return NextResponse.json(
      { error: 'Failed to update patient profile' },
      { status: 500 }
    )
  }
}
