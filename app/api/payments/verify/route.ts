import {
  canUseWalletScopedData,
  isDemoWalletAddress,
  isEvmWalletAddress,
  requestWalletProofMatches,
  requireAuth,
} from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { verifyAndRecordPayment } from "@/lib/payments-ledger"

export async function POST(request: NextRequest) {
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
    if (!isEvmWalletAddress(body.walletAddress)) {
      return NextResponse.json({ error: "walletAddress must be a valid EVM address." }, { status: 400 })
    }

    const walletProofMatches = await requestWalletProofMatches(request, body.walletAddress)
    const auth = await requireAuth(request, {
      allowPublic: isDemoWalletAddress(body.walletAddress) || walletProofMatches,
    })
    if ("response" in auth) return auth.response
    if (
      !canUseWalletScopedData(auth.session, body.walletAddress) &&
      !walletProofMatches
    ) {
      return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
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
