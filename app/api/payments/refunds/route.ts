import { NextRequest, NextResponse } from "next/server"
import {
  finalizeRefund,
  getLedgerSnapshot,
  requestRefund,
  updateRefundApproval,
} from "@/lib/payments-ledger"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress") || undefined
  const paymentId = searchParams.get("paymentId") || undefined

  const snapshot = await getLedgerSnapshot({ walletAddress })
  const refunds = paymentId
    ? snapshot.refunds.filter((refund) => refund.paymentId === paymentId)
    : snapshot.refunds

  return NextResponse.json({ refunds })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      paymentId?: string
      amount?: string
      reason?: string
      requestedBy?: string
    }

    if (!body.paymentId || !body.amount || !body.reason || !body.requestedBy) {
      return NextResponse.json(
        { error: "paymentId, amount, reason, and requestedBy are required." },
        { status: 400 }
      )
    }

    const refund = await requestRefund({
      paymentId: body.paymentId,
      amount: body.amount,
      reason: body.reason,
      requestedBy: body.requestedBy,
    })
    return NextResponse.json({ refund }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to request refund."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: "approve" | "finalize"
      refundId?: string
      approvedBy?: string
      status?: "sent" | "failed"
      txHash?: string
    }

    if (!body.refundId || !body.action) {
      return NextResponse.json(
        { error: "refundId and action are required." },
        { status: 400 }
      )
    }

    if (body.action === "approve") {
      if (!body.approvedBy) {
        return NextResponse.json(
          { error: "approvedBy is required for approve action." },
          { status: 400 }
        )
      }
      const refund = await updateRefundApproval(body.refundId, body.approvedBy)
      return NextResponse.json({ refund })
    }

    if (!body.approvedBy || !body.status) {
      return NextResponse.json(
        { error: "approvedBy and status are required for finalize action." },
        { status: 400 }
      )
    }

    const result = await finalizeRefund({
      refundId: body.refundId,
      status: body.status,
      txHash: body.txHash,
      approvedBy: body.approvedBy,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update refund."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
