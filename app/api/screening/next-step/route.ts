import { NextRequest, NextResponse } from "next/server"
import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import {
  createScreeningNextStepRequest,
  internalUserIdFromWallet,
  isScreeningNextStep,
  listScreeningNextStepRequests,
} from "@/lib/screening/next-step-store"

export const dynamic = "force-dynamic"

function normalizeWallet(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const walletAddress = normalizeWallet(searchParams.get("walletAddress"))
  const walletProofMatches = walletAddress ? await requestWalletProofMatches(request, walletAddress) : false
  const auth = await requireAuth(request, { allowPublic: walletProofMatches })
  if ("response" in auth) return auth.response

  if (!walletAddress) {
    return NextResponse.json({ requests: [], total: 0 })
  }
  if (!canUseWalletScopedData(auth.session, walletAddress) && !walletProofMatches) {
    return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
  }

  const requests = listScreeningNextStepRequests(internalUserIdFromWallet(walletAddress))
  return NextResponse.json({ requests, total: requests.length })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      walletAddress?: string
      patientId?: string
      recommendationId?: string
      screeningName?: string
      requestedAction?: string
      patientNote?: string
      locationZip?: string
      clinicianSummary?: string
      demoMode?: boolean
    }
    const walletAddress = normalizeWallet(body.walletAddress)

    if (!body.recommendationId || !body.screeningName || !body.requestedAction) {
      return NextResponse.json(
        { error: "recommendationId, screeningName, and requestedAction are required." },
        { status: 400 }
      )
    }
    if (!isScreeningNextStep(body.requestedAction)) {
      return NextResponse.json({ error: "requestedAction is not supported." }, { status: 400 })
    }

    if (body.demoMode && !walletAddress) {
      const requestRecord = createScreeningNextStepRequest({
        recommendationId: body.recommendationId,
        screeningName: body.screeningName,
        requestedAction: body.requestedAction,
        patientNote: body.patientNote,
        locationZip: body.locationZip,
        clinicianSummary: body.clinicianSummary,
        demoMode: true,
        source: "demo",
      })
      return NextResponse.json({
        request: requestRecord,
        demo: true,
        message: "Demo request prepared. Connect a wallet to save and track this next step.",
      }, { status: 202 })
    }

    const walletProofMatches = walletAddress ? await requestWalletProofMatches(request, walletAddress) : false
    const auth = await requireAuth(request, { allowPublic: walletProofMatches })
    if ("response" in auth) return auth.response
    if (!walletAddress) {
      return NextResponse.json({ error: "Connect a wallet or use demoMode to prepare a demo request." }, { status: 400 })
    }
    if (!canUseWalletScopedData(auth.session, walletAddress) && !walletProofMatches) {
      return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
    }

    const requestRecord = createScreeningNextStepRequest({
      walletAddress,
      patientId: body.patientId,
      recommendationId: body.recommendationId,
      screeningName: body.screeningName,
      requestedAction: body.requestedAction,
      patientNote: body.patientNote,
      locationZip: body.locationZip,
      clinicianSummary: body.clinicianSummary,
      source: canUseWalletScopedData(auth.session, walletAddress) && auth.session.authSource === "admin_api_key" ? "admin" : "wallet",
    })

    return NextResponse.json({ request: requestRecord }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create screening next-step request." }, { status: 400 })
  }
}
