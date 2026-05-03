import {
  canUseWalletScopedData,
  isDemoWalletAddress,
  requestWalletMatches,
  requireAuth,
} from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import {
  createScreeningPaymentIntent,
  getScreeningFeeUsd,
  getScreeningRecipientWallet,
} from "@/lib/screening-access"

function isWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { walletAddress?: string }
    const walletAddress = (body.walletAddress || "").trim()

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required." }, { status: 400 })
    }
    if (!isWalletAddress(walletAddress)) {
      return NextResponse.json({ error: "walletAddress must be a valid EVM address." }, { status: 400 })
    }

    const auth = await requireAuth(request, {
      allowPublic: isDemoWalletAddress(walletAddress) || requestWalletMatches(request, walletAddress),
    })
    if ("response" in auth) return auth.response
    if (
      !canUseWalletScopedData(auth.session, walletAddress) &&
      !requestWalletMatches(request, walletAddress)
    ) {
      return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
    }

    const payment = await createScreeningPaymentIntent(walletAddress)
    return NextResponse.json({
      payment,
      fee: getScreeningFeeUsd(),
      currency: "USDC",
      recipientAddress: getScreeningRecipientWallet(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create screening payment intent."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
