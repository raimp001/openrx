import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { createAttestation, getLedgerSnapshot } from "@/lib/payments-ledger"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress") || undefined
  const subjectType = searchParams.get("subjectType") || undefined
  const subjectId = searchParams.get("subjectId") || undefined
  const walletProofMatches = walletAddress ? await requestWalletProofMatches(request, walletAddress) : false
  const auth = await requireAuth(request, { allowPublic: walletProofMatches }); if ("response" in auth) return auth.response;
  if (walletAddress && !canUseWalletScopedData(auth.session, walletAddress) && !walletProofMatches) {
    return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
  }

  const snapshot = await getLedgerSnapshot({ walletAddress })
  let attestations = snapshot.attestations
  if (subjectType) attestations = attestations.filter((item) => item.subjectType === subjectType)
  if (subjectId) attestations = attestations.filter((item) => item.subjectId === subjectId)

  return NextResponse.json({ attestations })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      schema?: string
      subjectType?: "payment" | "receipt" | "refund" | "ledger"
      subjectId?: string
      attestor?: string
      payload?: Record<string, unknown>
      chainTxHash?: string
    }

    if (!body.schema || !body.subjectType || !body.subjectId || !body.attestor || !body.payload) {
      return NextResponse.json(
        { error: "schema, subjectType, subjectId, attestor, and payload are required." },
        { status: 400 }
      )
    }
    const walletProofMatches = await requestWalletProofMatches(request, body.attestor)
    const auth = await requireAuth(request, { allowPublic: walletProofMatches }); if ("response" in auth) return auth.response;
    if (!canUseWalletScopedData(auth.session, body.attestor) && !walletProofMatches) {
      return NextResponse.json({ error: "Wallet access denied." }, { status: 403 })
    }

    const attestation = await createAttestation({
      schema: body.schema,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      attestor: body.attestor,
      payload: body.payload,
      chainTxHash: body.chainTxHash,
    })
    return NextResponse.json({ attestation }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create attestation."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
