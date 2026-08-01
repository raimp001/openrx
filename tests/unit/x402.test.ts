import { describe, expect, it } from "vitest"
import {
  X402_VERSION,
  buildX402PaymentRequired,
  decodeXPaymentHeader,
  getX402Network,
} from "@/lib/x402"
import {
  getScreeningTotalWithTip,
  normalizeTipAmount,
} from "@/lib/screening-access"

const RECIPIENT = "0x09aeac8822F72AD49676c4DfA38519C98484730c"

describe("x402 payment requirements", () => {
  it("builds a spec-shaped payment-required body", () => {
    const body = buildX402PaymentRequired({
      resource: "https://openrx.health/api/screening/assess?analysisLevel=deep",
      fee: "0.50",
      recipientAddress: RECIPIENT,
    })
    expect(body.x402Version).toBe(X402_VERSION)
    expect(body.error).toBeTruthy()
    expect(body.accepts).toHaveLength(1)
    const requirement = body.accepts[0]
    expect(requirement.scheme).toBe("exact")
    expect(requirement.network).toBe(getX402Network())
    expect(requirement.payTo).toBe(RECIPIENT)
    expect(requirement.maxAmountRequired).toBe("500000") // 0.50 USDC, 6 decimals
    expect(requirement.resource).toContain("/api/screening/assess")
    expect(requirement.asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(requirement.mimeType).toBe("application/json")
  })

  it("uses the reason as the error when provided", () => {
    const body = buildX402PaymentRequired({
      resource: "https://openrx.health/api/screening/assess",
      fee: "1.00",
      recipientAddress: RECIPIENT,
      reason: "Screening payment is required before personalized recommendations.",
    })
    expect(body.error).toMatch(/payment is required/i)
    expect(body.accepts[0].maxAmountRequired).toBe("1000000")
  })
})

describe("x402 X-PAYMENT header decoding", () => {
  const TX = "0x" + "ab".repeat(32)

  it("decodes a base64 x402 payload with txHash and paymentId", () => {
    const header = Buffer.from(
      JSON.stringify({
        x402Version: 1,
        scheme: "exact",
        network: "base",
        payload: { txHash: TX, paymentId: "pay_123" },
      })
    ).toString("base64")
    const proof = decodeXPaymentHeader(header)
    expect(proof?.txHash).toBe(TX)
    expect(proof?.paymentId).toBe("pay_123")
    expect(proof?.scheme).toBe("exact")
    expect(proof?.network).toBe("base")
  })

  it("accepts a raw 0x transaction hash", () => {
    const proof = decodeXPaymentHeader(TX)
    expect(proof?.txHash).toBe(TX)
    expect(proof?.paymentId).toBeUndefined()
  })

  it("accepts a payload with only a paymentId", () => {
    const header = Buffer.from(
      JSON.stringify({ x402Version: 1, scheme: "exact", payload: { paymentId: "pay_9" } })
    ).toString("base64")
    const proof = decodeXPaymentHeader(header)
    expect(proof?.paymentId).toBe("pay_9")
    expect(proof?.txHash).toBeUndefined()
  })

  it("rejects garbage, empty, and proof-less payloads", () => {
    expect(decodeXPaymentHeader(null)).toBeNull()
    expect(decodeXPaymentHeader("")).toBeNull()
    expect(decodeXPaymentHeader("not-base64!!!")).toBeNull()
    expect(
      decodeXPaymentHeader(Buffer.from(JSON.stringify({ payload: {} })).toString("base64"))
    ).toBeNull()
    expect(decodeXPaymentHeader("0x1234")).toBeNull()
  })
})

describe("screening tips", () => {
  it("defaults to no tip for empty or invalid input", () => {
    expect(normalizeTipAmount(undefined)).toBe("0.00")
    expect(normalizeTipAmount("")).toBe("0.00")
    expect(normalizeTipAmount("abc")).toBe("0.00")
    expect(normalizeTipAmount("-5")).toBe("0.00")
    expect(normalizeTipAmount("0")).toBe("0.00")
  })

  it("normalizes valid tips", () => {
    expect(normalizeTipAmount("1")).toBe("1.00")
    expect(normalizeTipAmount("2.50")).toBe("2.50")
    expect(normalizeTipAmount("$5.00")).toBe("5.00")
  })

  it("caps tips at the maximum", () => {
    expect(normalizeTipAmount("100")).toBe("25.00")
  })

  it("adds the tip to the base fee", () => {
    expect(getScreeningTotalWithTip("1.00")).toBe("1.50")
    expect(getScreeningTotalWithTip("0.00")).toBe("0.50")
    expect(getScreeningTotalWithTip(undefined)).toBe("0.50")
  })
})
