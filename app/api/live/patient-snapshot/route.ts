import { canUseWalletScopedData, isDemoWalletAddress, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { getLiveSnapshotByWallet } from "@/lib/live-data.server"
import { createEmptyLiveSnapshot } from "@/lib/live-data-types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress") || undefined
  const auth = await requireAuth(request, {
    allowPublic: !walletAddress || isDemoWalletAddress(walletAddress),
  })
  if ("response" in auth) return auth.response

  const effectiveWalletAddress = canUseWalletScopedData(auth.session, walletAddress)
    ? walletAddress
    : undefined

  try {
    const snapshot = await getLiveSnapshotByWallet(effectiveWalletAddress)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("Failed to load live patient snapshot:", error)
    return NextResponse.json(createEmptyLiveSnapshot(effectiveWalletAddress || null))
  }
}
