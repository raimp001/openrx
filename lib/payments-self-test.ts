import { getBaseBuilderExplorerRootUrl, type BaseBuilderNetwork } from "@/lib/basebuilder/config"
import { BASE_SEPOLIA_USDC_ADDRESS, BASE_USDC_ADDRESS } from "@/lib/basebuilder/usdc"
import { PLATFORM_WALLET } from "@/lib/platform-wallets"

export type SelfTestStatus = "ok" | "warn" | "fail"

export interface SelfTestCheck {
  id: string
  label: string
  status: SelfTestStatus
  detail: string
  fixHint?: string
}

export interface PaymentRailsSelfTestReport {
  status: SelfTestStatus
  network: BaseBuilderNetwork
  generatedAt: string
  explorerRoot: string
  checks: SelfTestCheck[]
}

/**
 * Well-known Base mainnet USDC transfer used as the default verification
 * probe: https://basescan.org/tx/0x64660d85ac98ba054ea076e6b053d458e8ad9228b0bf369bbfa6013d4746d6d0
 * (successful tx emitting a USDC Transfer event of 411.406218 USDC).
 * Override per-run with the ?txhash= query param.
 */
export const DEFAULT_SELF_TEST_TX_HASH =
  "0x64660d85ac98ba054ea076e6b053d458e8ad9228b0bf369bbfa6013d4746d6d0"

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/

export function isTxHash(value?: string | null): boolean {
  return TX_HASH_PATTERN.test((value || "").trim())
}

type Env = Record<string, string | undefined>

function present(value: string | undefined): boolean {
  return !!value && value.trim().length > 0
}

function resolveNetwork(env: Env): BaseBuilderNetwork {
  const raw = (env.NEXT_PUBLIC_BASEBUILDER_NETWORK || "").trim().toLowerCase()
  return raw === "base-sepolia" ? "base-sepolia" : "base"
}

/**
 * Pure configuration evaluation for the payment rails self-test. Reports only
 * presence/absence of secrets — never their values. Used by the API route and
 * unit-tested directly.
 */
export function evaluatePaymentRailsConfig(env: Env): {
  network: BaseBuilderNetwork
  usdcTokenAddress: string
  checks: SelfTestCheck[]
} {
  const checks: SelfTestCheck[] = []
  const network = resolveNetwork(env)

  checks.push({
    id: "config.network",
    label: "Base network resolution",
    status: "ok",
    detail: present(env.NEXT_PUBLIC_BASEBUILDER_NETWORK)
      ? `NEXT_PUBLIC_BASEBUILDER_NETWORK=${network}.`
      : `NEXT_PUBLIC_BASEBUILDER_NETWORK unset; defaulting to ${network} (base mainnet).`,
    ...(present(env.NEXT_PUBLIC_BASEBUILDER_NETWORK)
      ? {}
      : { fixHint: "Set NEXT_PUBLIC_BASEBUILDER_NETWORK=base or base-sepolia explicitly." }),
  })

  const configuredToken = (
    env.OPENRX_BASE_USDC_TOKEN ||
    env.NEXT_PUBLIC_BASE_USDC_TOKEN ||
    env.NEXT_PUBLIC_BASE_USDC_ADDRESS ||
    ""
  ).trim()
  const fallbackToken = network === "base-sepolia" ? BASE_SEPOLIA_USDC_ADDRESS : BASE_USDC_ADDRESS
  const usdcTokenAddress = EVM_ADDRESS_PATTERN.test(configuredToken) ? configuredToken : fallbackToken
  if (EVM_ADDRESS_PATTERN.test(configuredToken)) {
    checks.push({
      id: "config.usdcToken",
      label: "USDC token address",
      status: "ok",
      detail: `USDC token override configured (${usdcTokenAddress}).`,
    })
  } else {
    checks.push({
      id: "config.usdcToken",
      label: "USDC token address",
      status: configuredToken ? "fail" : "ok",
      detail: configuredToken
        ? "Configured USDC token override is not a valid EVM address."
        : `No USDC token override; using built-in ${network} default (${fallbackToken}).`,
      ...(configuredToken
        ? { fixHint: "Fix OPENRX_BASE_USDC_TOKEN / NEXT_PUBLIC_BASE_USDC_TOKEN to a 0x… address." }
        : {}),
    })
  }

  checks.push({
    id: "config.onchainkitKey",
    label: "OnchainKit / CDP API key",
    status: present(env.NEXT_PUBLIC_ONCHAINKIT_API_KEY) ? "ok" : "warn",
    detail: present(env.NEXT_PUBLIC_ONCHAINKIT_API_KEY)
      ? "NEXT_PUBLIC_ONCHAINKIT_API_KEY is present."
      : "NEXT_PUBLIC_ONCHAINKIT_API_KEY is not set; client-side OnchainKit/CDP widgets will be degraded.",
    ...(present(env.NEXT_PUBLIC_ONCHAINKIT_API_KEY)
      ? {}
      : { fixHint: "Create a key at https://portal.cdp.coinbase.com/ and set NEXT_PUBLIC_ONCHAINKIT_API_KEY." }),
  })

  checks.push({
    id: "config.paymaster",
    label: "CDP paymaster (optional)",
    status: present(env.NEXT_PUBLIC_CDP_PAYMASTER_URL) ? "ok" : "warn",
    detail: present(env.NEXT_PUBLIC_CDP_PAYMASTER_URL)
      ? "NEXT_PUBLIC_CDP_PAYMASTER_URL is present; sponsored transactions enabled."
      : "NEXT_PUBLIC_CDP_PAYMASTER_URL is not set; gas sponsorship is disabled (optional).",
  })

  const treasuryWallet = (env.OPENRX_TREASURY_WALLET || "").trim()
  const developerWallet = (env.NEXT_PUBLIC_DEVELOPER_WALLET || "").trim()
  if (EVM_ADDRESS_PATTERN.test(treasuryWallet)) {
    checks.push({
      id: "config.treasury",
      label: "Treasury addresses",
      status: "ok",
      detail: `OPENRX_TREASURY_WALLET configured (${treasuryWallet}).`,
    })
  } else if (EVM_ADDRESS_PATTERN.test(developerWallet)) {
    checks.push({
      id: "config.treasury",
      label: "Treasury addresses",
      status: "warn",
      detail: "OPENRX_TREASURY_WALLET unset; payments fall back to NEXT_PUBLIC_DEVELOPER_WALLET.",
      fixHint: "Set OPENRX_TREASURY_WALLET to the server-side treasury wallet.",
    })
  } else {
    checks.push({
      id: "config.treasury",
      label: "Treasury addresses",
      status: "warn",
      detail: `No treasury wallet configured; built-in platform default (${PLATFORM_WALLET}) will be used.`,
      fixHint: "Set OPENRX_TREASURY_WALLET (and NEXT_PUBLIC_DEVELOPER_WALLET) to real wallets before going live.",
    })
  }

  return { network, usdcTokenAddress, checks }
}

export function summarizeSelfTest(checks: SelfTestCheck[]): SelfTestStatus {
  if (checks.some((check) => check.status === "fail")) return "fail"
  if (checks.some((check) => check.status === "warn")) return "warn"
  return "ok"
}

export function buildSelfTestReport(params: {
  network: BaseBuilderNetwork
  checks: SelfTestCheck[]
  generatedAt?: Date
}): PaymentRailsSelfTestReport {
  return {
    status: summarizeSelfTest(params.checks),
    network: params.network,
    generatedAt: (params.generatedAt || new Date()).toISOString(),
    explorerRoot: getBaseBuilderExplorerRootUrl(),
    checks: params.checks,
  }
}
