import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { getDatabaseHealth } from "@/lib/database-health"
import {
  getPrivyTreasuryConfigState,
  getTreasurySnapshot,
  submitTreasuryTransfer,
} from "@/lib/privy-treasury"

export const dynamic = "force-dynamic"

function isAdmin(requester: Awaited<ReturnType<typeof resolveClinicSession>>): boolean {
  return requester.role === "admin"
}

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Treasury access requires admin authorization." }, { status: 401 })
  }

  try {
    const [database, treasury] = await Promise.all([
      getDatabaseHealth({ force: true }),
      getTreasurySnapshot(),
    ])

    return NextResponse.json({
      ok: true,
      database,
      treasury,
      config: getPrivyTreasuryConfigState(),
      requestedBy: {
        userId: session.userId,
        role: session.role,
        authSource: session.authSource,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load treasury status." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Treasury actions require admin authorization." }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      asset?: "ETH" | "USDC"
      amount?: string
      toAddress?: string
      reason?: string
      kind?: "transfer" | "refund"
    }

    if (!body.asset || !body.amount || !body.toAddress || !body.reason) {
      return NextResponse.json(
        { error: "asset, amount, toAddress, and reason are required." },
        { status: 400 }
      )
    }

    const result = await submitTreasuryTransfer({
      asset: body.asset,
      amount: body.amount,
      toAddress: body.toAddress,
      reason: body.reason,
      kind: body.kind,
      initiatedBy: session.userId,
    })

    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit treasury transfer.",
        actionId: typeof error === "object" && error && "actionId" in error ? (error as { actionId?: string }).actionId : undefined,
      },
      { status: 400 }
    )
  }
}
