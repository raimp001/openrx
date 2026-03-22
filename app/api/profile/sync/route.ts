import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getDatabaseHealth } from "@/lib/database-health"
import type { WalletProfile } from "@/lib/wallet-identity"

interface SyncProfileRequest {
  walletAddress?: string
  profile?: WalletProfile
}

function normalizeWallet(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

function normalizeEmail(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

function fallbackEmail(walletAddress: string): string {
  return `${walletAddress.replace(/^0x/, "")}@wallet.openrx.health`
}

function parseOptionalDate(value?: string | null): Date | undefined {
  const trimmed = (value || "").trim()
  if (!trimmed) return undefined

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

function uniqueStrings(values: string[] = []): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

function formatEmergencyContact(profile: WalletProfile): string | undefined {
  const name = profile.emergencyContactName.trim()
  const phone = profile.emergencyContactPhone.trim()
  if (!name && !phone) return undefined
  if (!name) return phone
  if (!phone) return name
  return `${name} (${phone})`
}

function serializeConditionStatus(status?: string): string | undefined {
  const trimmed = (status || "").trim()
  return trimmed ? `Status: ${trimmed}` : undefined
}

export async function POST(request: NextRequest) {
  const databaseHealth = await getDatabaseHealth({ force: true })
  if (!databaseHealth.reachable) {
    return NextResponse.json(
      {
        error: databaseHealth.message,
        message:
          databaseHealth.status === "missing"
            ? "Set DATABASE_URL to activate live patient records."
            : "OpenRx could not reach Postgres. Fix the database connection to activate live patient records.",
      },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json()) as SyncProfileRequest
    const profile = body.profile
    const walletAddress = normalizeWallet(body.walletAddress || profile?.walletAddress)

    if (!walletAddress || !profile) {
      return NextResponse.json({ error: "walletAddress and profile are required." }, { status: 400 })
    }

    const desiredEmail = normalizeEmail(profile.email)
    const desiredName = profile.fullName.trim() || `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    const safeEmail = desiredEmail || fallbackEmail(walletAddress)

    const [existingByWallet, existingByEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { walletAddress },
        include: { patientProfile: true },
      }),
      desiredEmail
        ? prisma.user.findUnique({
            where: { email: desiredEmail },
            include: { patientProfile: true },
          })
        : Promise.resolve(null),
    ])

    if (existingByWallet && existingByEmail && existingByWallet.id !== existingByEmail.id) {
      return NextResponse.json(
        {
          error: "This wallet and email are linked to different users. Resolve the account conflict before syncing.",
        },
        { status: 409 }
      )
    }

    const targetUser = existingByWallet || existingByEmail

    const user = targetUser
      ? await prisma.user.update({
          where: { id: targetUser.id },
          data: {
            walletAddress,
            name: desiredName,
            email: desiredEmail ? desiredEmail : targetUser.email || safeEmail,
          },
          include: { patientProfile: true },
        })
      : await prisma.user.create({
          data: {
            walletAddress,
            email: safeEmail,
            name: desiredName,
            role: "PATIENT",
          },
          include: { patientProfile: true },
        })

    const patientProfile = user.patientProfile
      ? await prisma.patientProfile.update({
          where: { userId: user.id },
          data: {
            dateOfBirth: parseOptionalDate(profile.dateOfBirth),
            gender: profile.gender.trim() || undefined,
            phone: profile.phone.trim() || undefined,
            address: profile.address.trim() || undefined,
            emergencyContact: formatEmergencyContact(profile),
            allergies: uniqueStrings(profile.allergies),
            insuranceId: profile.insuranceId.trim() || undefined,
            insuranceProvider: profile.insuranceProvider.trim() || undefined,
          },
        })
      : await prisma.patientProfile.create({
          data: {
            userId: user.id,
            dateOfBirth: parseOptionalDate(profile.dateOfBirth),
            gender: profile.gender.trim() || undefined,
            phone: profile.phone.trim() || undefined,
            address: profile.address.trim() || undefined,
            emergencyContact: formatEmergencyContact(profile),
            allergies: uniqueStrings(profile.allergies),
            insuranceId: profile.insuranceId.trim() || undefined,
            insuranceProvider: profile.insuranceProvider.trim() || undefined,
          },
        })

    const incomingHistory = profile.medicalHistory
      .map((item) => ({
        condition: item.condition.trim(),
        diagnosed: parseOptionalDate(item.diagnosed) || new Date(),
        description: serializeConditionStatus(item.status),
      }))
      .filter((item) => item.condition)

    const existingRecords = await prisma.medicalRecord.findMany({
      where: {
        patientId: patientProfile.id,
        OR: [{ recordType: "condition" }, { recordType: "diagnosis" }],
      },
    })

    const existingByTitle = new Map(existingRecords.map((record) => [record.title.trim().toLowerCase(), record]))

    for (const entry of incomingHistory) {
      const existing = existingByTitle.get(entry.condition.toLowerCase())

      if (existing) {
        await prisma.medicalRecord.update({
          where: { id: existing.id },
          data: {
            description: entry.description || existing.description,
            recordDate: entry.diagnosed,
            metadata: {
              source: "wallet_sync",
              syncedAt: new Date().toISOString(),
            },
          },
        })
        continue
      }

      await prisma.medicalRecord.create({
        data: {
          patientId: patientProfile.id,
          title: entry.condition,
          description: entry.description,
          recordType: "condition",
          recordDate: entry.diagnosed,
          attachments: [],
          metadata: {
            source: "wallet_sync",
            syncedAt: new Date().toISOString(),
          },
        },
      })
    }

    return NextResponse.json({
      ok: true,
      userId: user.id,
      patientId: patientProfile.id,
      message: "Live records synced. Refreshing your care workspace.",
    })
  } catch (error) {
    console.error("Failed to sync wallet profile to database:", error)
    return NextResponse.json({ error: "Failed to sync wallet profile to database." }, { status: 500 })
  }
}
