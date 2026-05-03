import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { getLedgerSnapshot } from "@/lib/payments-ledger"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress") || undefined
  const paymentId = searchParams.get("paymentId") || undefined
  const refundId = searchParams.get("refundId") || undefined
  const walletProofMatches = walletAddress ? await requestWalletProofMatches(request, walletAddress) : false
  const auth = await requireAuth(request, { allowPublic: walletProofMatches }); if ("response" in auth) return auth.response;
  if (walletAddress && !canUseWalletScopedData(auth.session, walletAddress) && !walletProofMatches) {
    return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
  }

  const snapshot = await getLedgerSnapshot({ walletAddress })
  let receipts = snapshot.receipts
  if (paymentId) receipts = receipts.filter((receipt) => receipt.paymentId === paymentId)
  if (refundId) receipts = receipts.filter((receipt) => receipt.refundId === refundId)

  return NextResponse.json({ receipts })
}
