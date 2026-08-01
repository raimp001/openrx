import { getBaseBuilderNetwork } from "@/lib/basebuilder/config"
import { getBaseUsdcAddress, parseUsdcAmount } from "@/lib/basebuilder/usdc"

/**
 * Minimal x402 (Coinbase agent-payments) protocol support.
 *
 * When a paid resource is requested without payment, the server answers
 * HTTP 402 with an x402-shaped body so AI agents (and humans via wallets)
 * can discover the price, asset, and recipient programmatically. Agents pay
 * USDC on Base, then retry with an `X-PAYMENT` header carrying the proof.
 *
 * Spec: https://github.com/coinbase/x402
 */

export const X402_VERSION = 1
export const X402_PAYMENT_HEADER = "x-payment"

export interface X402PaymentRequirement {
  scheme: "exact"
  network: "base" | "base-sepolia"
  maxAmountRequired: string
  resource: string
  description: string
  mimeType: string
  payTo: string
  maxTimeoutSeconds: number
  asset: string
  extra: {
    name: string
    version: string
  }
}

export interface X402PaymentRequiredBody {
  x402Version: number
  error: string
  accepts: X402PaymentRequirement[]
}

export function getX402Network(): "base" | "base-sepolia" {
  return getBaseBuilderNetwork() === "base-sepolia" ? "base-sepolia" : "base"
}

export function buildX402PaymentRequired(input: {
  resource: string
  fee: string
  recipientAddress: string
  description?: string
  reason?: string
}): X402PaymentRequiredBody {
  const network = getX402Network()
  return {
    x402Version: X402_VERSION,
    error: input.reason || "Payment is required to access this resource.",
    accepts: [
      {
        scheme: "exact",
        network,
        maxAmountRequired: parseUsdcAmount(input.fee).toString(),
        resource: input.resource,
        description:
          input.description || "OpenRx advanced screening review, paid in USDC on Base.",
        mimeType: "application/json",
        payTo: input.recipientAddress,
        maxTimeoutSeconds: 300,
        asset: getBaseUsdcAddress(network),
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
  }
}

export interface X402PaymentProof {
  /** Onchain transaction hash proving the USDC transfer. */
  txHash?: string
  /** OpenRx payment-intent id the proof should settle against. */
  paymentId?: string
  scheme?: string
  network?: string
}

/**
 * Decode an X-PAYMENT header. Accepts:
 *  - base64-encoded JSON per the x402 spec
 *    ({ x402Version, scheme, network, payload: { txHash | transaction | paymentId } })
 *  - a raw 0x transaction hash (convenience for simple clients)
 */
export function decodeXPaymentHeader(raw: string | null): X402PaymentProof | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return { txHash: trimmed }
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(trimmed, "base64").toString("utf8")
    ) as {
      scheme?: string
      network?: string
      payload?: {
        txHash?: string
        transaction?: string
        paymentId?: string
        id?: string
      }
    }
    const payload = decoded?.payload
    if (!payload || typeof payload !== "object") return null
    const txHash = [payload.txHash, payload.transaction].find(
      (value) => typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value)
    )
    const paymentId = [payload.paymentId, payload.id].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    )
    if (!txHash && !paymentId) return null
    return {
      txHash,
      paymentId: paymentId?.trim(),
      scheme: decoded.scheme,
      network: decoded.network,
    }
  } catch {
    return null
  }
}
