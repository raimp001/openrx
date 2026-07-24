import { getBaseBuilderNetwork, type BaseBuilderNetwork } from "@/lib/basebuilder/config"
import { getBaseUsdcAddress } from "@/lib/basebuilder/usdc"

export type PaymentRailId = "coinbase_onramp" | "robinhood" | "base_pay"

export interface PaymentRail {
  id: PaymentRailId
  label: string
  description: string
  /** True when the rail can open a hosted funding flow directly from OpenRx. */
  hostedFlow: boolean
}

/**
 * Payment rails that can fund the patient's Base USDC balance.
 * - coinbase_onramp: Coinbase-hosted fiat→USDC flow (card / bank / Coinbase
 *   balance), opened with a server-issued session token.
 * - robinhood: external purchase + withdrawal path for users who custody with
 *   Robinhood; no hosted URL API exists, so OpenRx deep-links to the USDC
 *   asset page and supplies the receive address out-of-band.
 * - base_pay: native Base Pay wallet flow for users who already hold USDC.
 */
export function getPaymentRails(): PaymentRail[] {
  return [
    {
      id: "coinbase_onramp",
      label: "Coinbase Onramp",
      description: "Buy USDC with a card, bank account, or Coinbase balance. Funds arrive directly in the connected payment address on Base.",
      hostedFlow: true,
    },
    {
      id: "robinhood",
      label: "Robinhood",
      description: "Buy USDC in Robinhood, then withdraw on the Base network to the connected payment address.",
      hostedFlow: false,
    },
    {
      id: "base_pay",
      label: "Base Pay",
      description: "Pay directly with USDC already held in a Base-compatible wallet.",
      hostedFlow: true,
    },
  ]
}

export function isOnrampSessionConfigured(): boolean {
  return Boolean(
    (process.env.CDP_API_KEY_NAME || process.env.CDP_API_KEY_ID || "").trim() &&
      (process.env.CDP_API_KEY_SECRET || process.env.CDP_API_SECRET || "").trim()
  )
}

export function buildRobinhoodUsdcUrl(): string {
  return "https://robinhood.com/crypto/usdc"
}

export function normalizeFundingAmount(raw: string): number {
  const numeric = Number(raw.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  // Onramp presets accept whole fiat amounts; round up so the purchase
  // always covers the payment being funded.
  return Math.max(1, Math.ceil(numeric))
}

export interface OnrampSessionRequest {
  walletAddress: string
  network?: BaseBuilderNetwork
  asset?: string
}

export function buildOnrampSessionBody(input: OnrampSessionRequest): {
  addresses: Array<{ address: string; blockchains: string[] }>
  assets: string[]
} {
  return {
    addresses: [
      {
        address: input.walletAddress.trim(),
        blockchains: ["base"],
      },
    ],
    assets: [input.asset || "USDC"],
  }
}

export function onrampFundingSummary(input: {
  amount: string
  recipientAddress: string
  network?: BaseBuilderNetwork
}): string {
  const network = input.network || getBaseBuilderNetwork()
  const usdc = getBaseUsdcAddress(network)
  return `Fund ${input.amount} USDC on ${network === "base-sepolia" ? "Base Sepolia" : "Base"} (token ${usdc}) to ${input.recipientAddress}`
}
