import { describe, expect, it } from "vitest"
import {
  buildSelfTestReport,
  DEFAULT_SELF_TEST_TX_HASH,
  evaluatePaymentRailsConfig,
  isTxHash,
  summarizeSelfTest,
} from "@/lib/payments-self-test"
import { BASE_SEPOLIA_USDC_ADDRESS, BASE_USDC_ADDRESS } from "@/lib/basebuilder/usdc"
import { PLATFORM_WALLET } from "@/lib/platform-wallets"

function checkById(checks: { id: string }[], id: string) {
  const found = checks.find((check) => check.id === id)
  expect(found, `expected check ${id}`).toBeTruthy()
  return found as (typeof checks)[number] & { status: string; detail: string; fixHint?: string }
}

describe("evaluatePaymentRailsConfig", () => {
  it("defaults to base mainnet when the network env is unset", () => {
    const { network } = evaluatePaymentRailsConfig({})
    expect(network).toBe("base")
  })

  it("resolves base-sepolia case-insensitively", () => {
    const { network } = evaluatePaymentRailsConfig({ NEXT_PUBLIC_BASEBUILDER_NETWORK: " Base-Sepolia " })
    expect(network).toBe("base-sepolia")
  })

  it("treats unknown network values as base mainnet", () => {
    const { network } = evaluatePaymentRailsConfig({ NEXT_PUBLIC_BASEBUILDER_NETWORK: "mainnet" })
    expect(network).toBe("base")
  })

  it("uses the built-in USDC default for the resolved network when no override is set", () => {
    expect(evaluatePaymentRailsConfig({}).usdcTokenAddress).toBe(BASE_USDC_ADDRESS)
    expect(
      evaluatePaymentRailsConfig({ NEXT_PUBLIC_BASEBUILDER_NETWORK: "base-sepolia" }).usdcTokenAddress
    ).toBe(BASE_SEPOLIA_USDC_ADDRESS)
  })

  it("prefers a valid OPENRX_BASE_USDC_TOKEN override", () => {
    const token = "0x1111111111111111111111111111111111111111"
    const { usdcTokenAddress, checks } = evaluatePaymentRailsConfig({ OPENRX_BASE_USDC_TOKEN: token })
    expect(usdcTokenAddress).toBe(token)
    expect(checkById(checks, "config.usdcToken").status).toBe("ok")
  })

  it("fails the token check when the override is not an EVM address", () => {
    const { checks } = evaluatePaymentRailsConfig({ OPENRX_BASE_USDC_TOKEN: "not-an-address" })
    const check = checkById(checks, "config.usdcToken")
    expect(check.status).toBe("fail")
    expect(check.fixHint).toBeTruthy()
  })

  it("reports only presence (never the value) of the OnchainKit key", () => {
    const secret = "cdp-secret-key-value"
    const { checks } = evaluatePaymentRailsConfig({ NEXT_PUBLIC_ONCHAINKIT_API_KEY: secret })
    const check = checkById(checks, "config.onchainkitKey")
    expect(check.status).toBe("ok")
    expect(JSON.stringify(check)).not.toContain(secret)
  })

  it("warns when the OnchainKit key is missing", () => {
    const { checks } = evaluatePaymentRailsConfig({})
    expect(checkById(checks, "config.onchainkitKey").status).toBe("warn")
  })

  it("treats paymaster as optional (warn when absent, ok when present)", () => {
    expect(checkById(evaluatePaymentRailsConfig({}).checks, "config.paymaster").status).toBe("warn")
    expect(
      checkById(evaluatePaymentRailsConfig({ NEXT_PUBLIC_CDP_PAYMASTER_URL: "https://paymaster.example" }).checks, "config.paymaster")
        .status
    ).toBe("ok")
  })

  it("accepts a configured treasury wallet", () => {
    const { checks } = evaluatePaymentRailsConfig({
      OPENRX_TREASURY_WALLET: "0x2222222222222222222222222222222222222222",
    })
    expect(checkById(checks, "config.treasury").status).toBe("ok")
  })

  it("warns when only the developer wallet is configured", () => {
    const { checks } = evaluatePaymentRailsConfig({
      NEXT_PUBLIC_DEVELOPER_WALLET: "0x3333333333333333333333333333333333333333",
    })
    const check = checkById(checks, "config.treasury")
    expect(check.status).toBe("warn")
    expect(check.detail).toContain("NEXT_PUBLIC_DEVELOPER_WALLET")
  })

  it("warns and names the platform default when no treasury wallet is configured", () => {
    const { checks } = evaluatePaymentRailsConfig({})
    const check = checkById(checks, "config.treasury")
    expect(check.status).toBe("warn")
    expect(check.detail).toContain(PLATFORM_WALLET)
  })
})

describe("summarizeSelfTest", () => {
  it("fails if any check fails", () => {
    expect(
      summarizeSelfTest([
        { id: "a", label: "a", status: "ok", detail: "" },
        { id: "b", label: "b", status: "fail", detail: "" },
      ])
    ).toBe("fail")
  })

  it("warns when there are warnings but no failures", () => {
    expect(
      summarizeSelfTest([
        { id: "a", label: "a", status: "ok", detail: "" },
        { id: "b", label: "b", status: "warn", detail: "" },
      ])
    ).toBe("warn")
  })

  it("is ok only when every check is ok", () => {
    expect(summarizeSelfTest([{ id: "a", label: "a", status: "ok", detail: "" }])).toBe("ok")
    expect(summarizeSelfTest([])).toBe("ok")
  })
})

describe("buildSelfTestReport", () => {
  it("includes network, timestamp, explorer root, and overall status", () => {
    process.env.NEXT_PUBLIC_BASEBUILDER_NETWORK = "base-sepolia"
    try {
      const report = buildSelfTestReport({
        network: "base-sepolia",
        checks: [{ id: "a", label: "a", status: "warn", detail: "" }],
        generatedAt: new Date("2025-01-02T03:04:05.000Z"),
      })
      expect(report.status).toBe("warn")
      expect(report.network).toBe("base-sepolia")
      expect(report.generatedAt).toBe("2025-01-02T03:04:05.000Z")
      expect(report.explorerRoot).toBe("https://sepolia.basescan.org")
      expect(report.checks).toHaveLength(1)
    } finally {
      delete process.env.NEXT_PUBLIC_BASEBUILDER_NETWORK
    }
  })
})

describe("self-test tx hash defaults", () => {
  it("ships a documented mainnet default hash in valid format", () => {
    expect(isTxHash(DEFAULT_SELF_TEST_TX_HASH)).toBe(true)
  })

  it("validates hash shape", () => {
    expect(isTxHash("0x" + "a".repeat(64))).toBe(true)
    expect(isTxHash("0x123")).toBe(false)
    expect(isTxHash("")).toBe(false)
    expect(isTxHash(undefined)).toBe(false)
  })
})
