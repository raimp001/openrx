import { canUseWalletScopedData, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { getLedgerSnapshot } from "@/lib/payments-ledger"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress") || undefined
  if (walletAddress && !canUseWalletScopedData(auth.session, walletAddress)) {
    return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
  }
  const snapshot = await getLedgerSnapshot({ walletAddress })
  return NextResponse.json(snapshot)
}
