import { NextRequest, NextResponse } from "next/server"
import {
  canUseWalletScopedData,
  isEvmWalletAddress,
  requestWalletProofMatches,
  requireAuth,
} from "@/lib/api-auth"
import { getDatabaseHealth } from "@/lib/database-health"
import { prisma } from "@/lib/db"

interface WalletSessionRequest {
  walletAddress?: string
}

function normalizeWallet(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

function fallbackEmail(walletAddress: string): string {
  return `${walletAddress.replace(/^0x/, "")}@wallet.openrx.health`
}

function walletLabel(walletAddress: string): string {
  return `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
}

function hasOnboardingData(patientProfile?: {
  dateOfBirth: Date | null
  gender: string | null
  phone: string | null
  address: string | null
  insuranceProvider: string | null
} | null): boolean {
  if (!patientProfile) return false
  return Boolean(
    patientProfile.dateOfBirth ||
      patientProfile.gender ||
      patientProfile.phone ||
      patientProfile.address ||
      patientProfile.insuranceProvider
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as WalletSessionRequest
    const walletAddress = normalizeWallet(body.walletAddress)

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required." }, { status: 400 })
    }
    if (!isEvmWalletAddress(walletAddress)) {
      return NextResponse.json({ error: "walletAddress must be a valid EVM address." }, { status: 400 })
    }

    const walletProofMatches = await requestWalletProofMatches(request, walletAddress)
    const auth = await requireAuth(request, { allowPublic: walletProofMatches })
    if ("response" in auth) return auth.response
    if (!canUseWalletScopedData(auth.session, walletAddress) && !walletProofMatches) {
      return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
    }

    const databaseHealth = await getDatabaseHealth({ force: true })
    if (!databaseHealth.reachable) {
      return NextResponse.json(
        {
          error: databaseHealth.message,
          message:
            databaseHealth.status === "missing"
              ? "Set DATABASE_URL to activate live wallet recognition."
              : "OpenRx could not reach Postgres. Fix the database connection to activate live wallet recognition.",
        },
        { status: 503 }
      )
    }

    const existingUser = await prisma.user.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: "insensitive" } },
      include: { patientProfile: true },
    })

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            walletAddress,
            name: existingUser.name || walletLabel(walletAddress),
          },
          include: { patientProfile: true },
        })
      : await prisma.user.create({
          data: {
            walletAddress,
            email: fallbackEmail(walletAddress),
            name: walletLabel(walletAddress),
            role: "PATIENT",
          },
          include: { patientProfile: true },
        })

    const patientProfile = user.patientProfile || (await prisma.patientProfile.create({
      data: {
        userId: user.id,
        allergies: [],
      },
    }))

    return NextResponse.json({
      ok: true,
      isNewUser: !existingUser,
      userId: user.id,
      patientId: patientProfile.id,
      profile: {
        fullName: user.name || "",
        email: user.email.endsWith("@wallet.openrx.health") ? "" : user.email,
        role: user.role,
        onboardingComplete: hasOnboardingData(patientProfile),
      },
      message: existingUser ? "Wallet recognized. Loading your OpenRx profile." : "Wallet recognized. OpenRx profile created.",
    })
  } catch (error) {
    console.error("Failed to create wallet session:", error)
    return NextResponse.json({ error: "Failed to create wallet session." }, { status: 500 })
  }
}
