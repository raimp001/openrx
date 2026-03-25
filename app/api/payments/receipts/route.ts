import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { getLedgerSnapshot } from "@/lib/payments-ledger"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress") || undefined
  const paymentId = searchParams.get("paymentId") || undefined
  const refundId = searchParams.get("refundId") || undefined

  const snapshot = await getLedgerSnapshot({ walletAddress })
  let receipts = snapshot.receipts
  if (paymentId) receipts = receipts.filter((receipt) => receipt.paymentId === paymentId)
  if (refundId) receipts = receipts.filter((receipt) => receipt.refundId === refundId)

  return NextResponse.json({ receipts })
}
