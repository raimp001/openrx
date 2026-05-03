import {
  canUseWalletScopedData,
  isDemoWalletAddress,
  isEvmWalletAddress,
  requestWalletProofMatches,
  requireAuth,
} from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { createPaymentIntent, type PaymentCategory } from "@/lib/payments-ledger"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      walletAddress?: string
      amount?: string
      category?: PaymentCategory
      description?: string
      recipientAddress?: string
      metadata?: Record<string, unknown>
    }

    if (!body.walletAddress || !body.amount) {
      return NextResponse.json(
        { error: "walletAddress and amount are required." },
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

    const payment = await createPaymentIntent({
      walletAddress: body.walletAddress,
      amount: body.amount,
      category: body.category,
      description: body.description,
      recipientAddress: body.recipientAddress,
      metadata: body.metadata,
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment intent."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
