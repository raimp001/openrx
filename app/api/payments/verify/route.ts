import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { verifyAndRecordPayment } from "@/lib/payments-ledger"

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const body = (await request.json()) as {
      paymentId?: string
      intentId?: string
      txHash?: string
      walletAddress?: string
      expectedAmount?: string
      expectedRecipient?: string
      testnet?: boolean
    }

    if (!body.txHash || !body.walletAddress) {
      return NextResponse.json(
        { error: "txHash and walletAddress are required." },
        { status: 400 }
      )
    }

    const result = await verifyAndRecordPayment({
      paymentId: body.paymentId,
      intentId: body.intentId,
      txHash: body.txHash,
      walletAddress: body.walletAddress,
      expectedAmount: body.expectedAmount,
      expectedRecipient: body.expectedRecipient,
      testnet: body.testnet,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
