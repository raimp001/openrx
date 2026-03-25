import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { getLiveSnapshotByWallet } from "@/lib/live-data.server"
import { createEmptyLiveSnapshot } from "@/lib/live-data-types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress") || undefined

  try {
    const snapshot = await getLiveSnapshotByWallet(walletAddress)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("Failed to load live patient snapshot:", error)
    return NextResponse.json(createEmptyLiveSnapshot(walletAddress || null))
  }
}
