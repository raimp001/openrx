import { requireAuth } from "@/lib/api-auth"
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
