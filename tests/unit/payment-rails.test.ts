import { describe, expect, it } from "vitest"
import { generateKeyPairSync, verify as nodeVerify } from "node:crypto"
import { buildCdpJwt } from "@/lib/basebuilder/cdp-jwt.server"
import {
  buildOnrampSessionBody,
  buildRobinhoodUsdcUrl,
  getPaymentRails,
  isOnrampSessionConfigured,
  normalizeFundingAmount,
  onrampFundingSummary,
} from "@/lib/basebuilder/onramp"

describe("payment rails registry", () => {
  it("exposes coinbase onramp, robinhood, and base pay rails", () => {
    const ids = getPaymentRails().map((rail) => rail.id)
    expect(ids).toEqual(["coinbase_onramp", "robinhood", "base_pay"])
  })

  it("marks robinhood as a non-hosted rail and coinbase/base pay as hosted", () => {
    const rails = getPaymentRails()
    expect(rails.find((r) => r.id === "robinhood")?.hostedFlow).toBe(false)
    expect(rails.find((r) => r.id === "coinbase_onramp")?.hostedFlow).toBe(true)
    expect(rails.find((r) => r.id === "base_pay")?.hostedFlow).toBe(true)
  })
})

describe("buildRobinhoodUsdcUrl", () => {
  it("links to the Robinhood USDC asset page", () => {
    expect(buildRobinhoodUsdcUrl()).toBe("https://robinhood.com/crypto/usdc")
  })
})

describe("normalizeFundingAmount", () => {
  it("rounds up so the purchase covers the payment", () => {
    expect(normalizeFundingAmount("0.50")).toBe(1)
    expect(normalizeFundingAmount("10.25")).toBe(11)
  })

  it("strips currency symbols and rejects non-positive amounts", () => {
    expect(normalizeFundingAmount("$25.00")).toBe(25)
    expect(normalizeFundingAmount("0")).toBe(0)
    expect(normalizeFundingAmount("abc")).toBe(0)
  })
})

describe("buildOnrampSessionBody", () => {
  it("targets the base blockchain with USDC by default", () => {
    const body = buildOnrampSessionBody({ walletAddress: "0x1234567890abcdef1234567890abcdef12345678" })
    expect(body).toEqual({
      addresses: [{ address: "0x1234567890abcdef1234567890abcdef12345678", blockchains: ["base"] }],
      assets: ["USDC"],
    })
  })

  it("honors an explicit asset override", () => {
    const body = buildOnrampSessionBody({ walletAddress: "0xabc", asset: "ETH" })
    expect(body.assets).toEqual(["ETH"])
  })
})

describe("isOnrampSessionConfigured", () => {
  it("is false when CDP credentials are absent", () => {
    expect(isOnrampSessionConfigured()).toBe(false)
  })
})

describe("onrampFundingSummary", () => {
  it("includes amount, network label, token, and recipient", () => {
    const summary = onrampFundingSummary({
      amount: "0.50",
      recipientAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      network: "base",
    })
    expect(summary).toContain("0.50 USDC")
    expect(summary).toContain("Base")
    expect(summary).toContain("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
  })
})

describe("buildCdpJwt", () => {
  it("produces a verifiable EdDSA JWT with the CDP claims", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519")
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()

    const jwt = buildCdpJwt(
      { keyName: "organizations/org/apiKeys/key-1", privateKeyPem: pem },
      { method: "POST", host: "api.developer.coinbase.com", path: "/onramp/v1/token", nowSeconds: 1_700_000_000 }
    )

    const [headerB64, payloadB64, signatureB64] = jwt.split(".")
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString())
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString())

    expect(header.alg).toBe("EdDSA")
    expect(header.kid).toBe("organizations/org/apiKeys/key-1")
    expect(header.typ).toBe("JWT")
    expect(header.nonce).toMatch(/^[0-9a-f]{32}$/)

    expect(payload.iss).toBe("cdp")
    expect(payload.sub).toBe("organizations/org/apiKeys/key-1")
    expect(payload.nbf).toBe(1_700_000_000)
    expect(payload.exp).toBe(1_700_000_120)
    expect(payload.uris).toEqual(["POST api.developer.coinbase.com/onramp/v1/token"])

    const ok = nodeVerify(
      null,
      Buffer.from(`${headerB64}.${payloadB64}`),
      publicKey,
      Buffer.from(signatureB64, "base64url")
    )
    expect(ok).toBe(true)
  })
})
