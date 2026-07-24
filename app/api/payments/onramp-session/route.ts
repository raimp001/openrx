import { NextRequest, NextResponse } from "next/server"
import { isEvmWalletAddress, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { buildCdpJwt, getCdpApiConfig } from "@/lib/basebuilder/cdp-jwt.server"
import { buildOnrampSessionBody, isOnrampSessionConfigured } from "@/lib/basebuilder/onramp"

const CDP_ONRAMP_TOKEN_HOST = "api.developer.coinbase.com"
const CDP_ONRAMP_TOKEN_PATH = "/onramp/v1/token"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      walletAddress?: string
      asset?: string
    }

    if (!body.walletAddress || !isEvmWalletAddress(body.walletAddress)) {
      return NextResponse.json(
        { error: "walletAddress must be a valid EVM address." },
        { status: 400 }
      )
    }

    const walletProofMatches = await requestWalletProofMatches(request, body.walletAddress)
    const auth = await requireAuth(request, { allowPublic: walletProofMatches })
    if ("response" in auth) return auth.response

    if (!isOnrampSessionConfigured()) {
      return NextResponse.json(
        {
          error: "Coinbase Onramp is not configured on this deployment.",
          fallback: true,
        },
        { status: 503 }
      )
    }

    const cdp = getCdpApiConfig()
    if (!cdp) {
      return NextResponse.json(
        { error: "Coinbase Onramp credentials are unavailable.", fallback: true },
        { status: 503 }
      )
    }

    const jwt = buildCdpJwt(cdp, {
      method: "POST",
      host: CDP_ONRAMP_TOKEN_HOST,
      path: CDP_ONRAMP_TOKEN_PATH,
    })

    const sessionBody = buildOnrampSessionBody({
      walletAddress: body.walletAddress,
      asset: body.asset || "USDC",
    })

    const upstream = await fetch(`https://${CDP_ONRAMP_TOKEN_HOST}${CDP_ONRAMP_TOKEN_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionBody),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      return NextResponse.json(
        { error: `Coinbase session-token request failed (${upstream.status}).`, detail: detail.slice(0, 300), fallback: true },
        { status: 502 }
      )
    }

    const data = (await upstream.json()) as { token?: string; channel_id?: string }
    if (!data.token) {
      return NextResponse.json(
        { error: "Coinbase did not return a session token.", fallback: true },
        { status: 502 }
      )
    }

    return NextResponse.json({ sessionToken: data.token })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create onramp session."
    return NextResponse.json({ error: message, fallback: true }, { status: 500 })
  }
}
