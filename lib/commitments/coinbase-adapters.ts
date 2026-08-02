import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  isAddress,
  type Hex,
} from "viem"
import { baseSepolia } from "viem/chains"
import type {
  CommitmentAdapters,
  PaymentRailAdapter,
  WalletProviderAdapter,
} from "@/lib/commitments/adapters"
import { getCdpApiConfig, buildCdpJwt } from "@/lib/basebuilder/cdp-jwt.server"
import { CommitmentPilotError } from "@/lib/commitments/errors"
import { encryptCommitmentValue } from "@/lib/commitments/encryption"
import {
  assertCommitmentSandbox,
  getCommitmentFeatureFlags,
  getCommitmentPilotNetwork,
} from "@/lib/commitments/flags"
import { createMockCommitmentAdapters } from "@/lib/commitments/mock-adapters"
import { createOpaqueId } from "@/lib/commitments/privacy"

const CDP_HOST = "api.developer.coinbase.com"
const TOKEN_PATH = "/onramp/v1/token"
const QUOTE_PATH = "/onramp/v1/buy/quote"
const OPTIONS_PATH = "/onramp/v1/buy/options"

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

const escrowAbi = [
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitmentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "verifyCondition",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitmentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitmentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "expire",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitmentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "exceptionRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitmentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Deposited",
    anonymous: false,
    inputs: [
      { name: "commitmentId", type: "bytes32", indexed: true },
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
    ],
  },
] as const

type CoinbaseMoney = { currency?: string; value?: string }
type CoinbaseQuoteResponse = {
  coinbase_fee?: CoinbaseMoney
  network_fee?: CoinbaseMoney
  payment_subtotal?: CoinbaseMoney
  payment_total?: CoinbaseMoney
  purchase_amount?: CoinbaseMoney
  quote_id?: string
}

function requireAddress(name: string, value?: string): `0x${string}` {
  if (!value || !isAddress(value)) {
    throw new CommitmentPilotError(
      "external_service_unavailable",
      `${name} is not configured for the Base Sepolia sandbox.`,
      503,
    )
  }
  return value
}

function amountToMinor(value?: string): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  return Math.round(number * 100)
}

function amountToUsdcUnits(amountMinor: number): bigint {
  return BigInt(amountMinor) * BigInt(10_000)
}

export function buildBaseSepoliaDepositCalls(input: {
  token: `0x${string}`
  escrow: `0x${string}`
  opaqueCommitmentId: Hex
  amountMinor: number
}) {
  const amount = amountToUsdcUnits(input.amountMinor)
  return [
    {
      to: input.token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [input.escrow, amount],
      }),
      value: "0" as const,
      purpose: "approve_exact_usdc" as const,
    },
    {
      to: input.escrow,
      data: encodeFunctionData({
        abi: escrowAbi,
        functionName: "fund",
        args: [input.opaqueCommitmentId],
      }),
      value: "0" as const,
      purpose: "fund_conditional_deposit" as const,
    },
  ]
}

function cdpAuth(method: string, path: string): string {
  const config = getCdpApiConfig()
  if (!config) {
    throw new CommitmentPilotError(
      "external_service_unavailable",
      "Coinbase sandbox credentials are not configured.",
      503,
    )
  }
  return buildCdpJwt(config, { method, host: CDP_HOST, path })
}

async function cdpFetch<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://${CDP_HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cdpAuth(method, path)}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  if (!response.ok) {
    throw new CommitmentPilotError(
      "external_service_unavailable",
      `Coinbase sandbox request failed with status ${response.status}.`,
      502,
    )
  }
  return response.json() as Promise<T>
}

function getBaseSepoliaClient() {
  const rpcUrl = process.env.COINBASE_CDP_BASE_SEPOLIA_RPC_URL?.trim()
  if (!rpcUrl) {
    throw new CommitmentPilotError(
      "external_service_unavailable",
      "Base Sepolia RPC is not configured.",
      503,
    )
  }
  return createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
}

const coinbaseWalletAdapter: WalletProviderAdapter = {
  id: "existing_openrx",
  async createOrLinkWallet(input) {
    assertCommitmentSandbox()
    const address = requireAddress("Patient wallet", input.existingWalletAddress)
    return {
      id: createOpaqueId("wallet"),
      patientId: input.patientId,
      provider: "existing_openrx",
      providerReference: createOpaqueId("openrx-wallet"),
      encryptedWalletAddress: encryptCommitmentValue(address, `wallet:${input.patientId}`),
      publicAddress: address,
      dedicated: false,
      recoverySupported: true,
      createdAt: new Date().toISOString(),
    }
  },
  async recoverWallet() {
    return { recovered: false }
  },
}

const coinbasePaymentAdapter: PaymentRailAdapter = {
  id: "coinbase_cdp",
  async quoteFunding(input) {
    assertCommitmentSandbox()
    const optionsQuery = new URLSearchParams({ country: input.country, networks: "base" })
    if (input.subdivision) optionsQuery.set("subdivision", input.subdivision)
    const optionsPath = `${OPTIONS_PATH}?${optionsQuery.toString()}`
    const options = await cdpFetch<{
      purchase_currencies?: Array<{
        symbol?: string
        networks?: Array<{ name?: string; chain_id?: number }>
      }>
    }>("GET", optionsPath)
    const baseUsdcAvailable = options.purchase_currencies?.some(
      (currency) =>
        currency.symbol === "USDC" &&
        currency.networks?.some((network) => network.name === "base"),
    )
    if (!baseUsdcAvailable) {
      throw new CommitmentPilotError(
        "external_service_unavailable",
        "USDC funding on Base is not available for this location.",
        422,
      )
    }
    const fiatAmountMinor = Math.max(
      input.commitment.depositAmountMinor,
      Number(process.env.COMMITMENT_ONRAMP_FIAT_AMOUNT_MINOR || 2_500),
    )
    const quote = await cdpFetch<CoinbaseQuoteResponse>("POST", QUOTE_PATH, {
      country: input.country,
      subdivision: input.subdivision,
      paymentAmount: (fiatAmountMinor / 100).toFixed(2),
      paymentCurrency: "USD",
      paymentMethod: input.paymentMethod,
      purchaseCurrency: "USDC",
      purchaseNetwork: "base",
      destinationAddress: input.wallet.publicAddress,
      clientIp: input.clientIp,
    })
    const purchaseAmountMinor = amountToMinor(quote.purchase_amount?.value)
    return {
      id: createOpaqueId("quote"),
      commitmentId: input.commitment.id,
      provider: "coinbase_onramp",
      paymentMethod: input.paymentMethod,
      paymentSubtotalMinor: amountToMinor(quote.payment_subtotal?.value),
      feeMinor: amountToMinor(quote.coinbase_fee?.value),
      networkFeeMinor: amountToMinor(quote.network_fee?.value),
      paymentTotalMinor: amountToMinor(quote.payment_total?.value),
      paymentCurrency: "USD",
      purchaseAmountMinor,
      purchaseCurrency: "USDC",
      expiresAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
      available: Boolean(quote.quote_id && purchaseAmountMinor >= input.commitment.depositAmountMinor),
      providerReference: quote.quote_id,
    }
  },
  async createOnrampSession(input) {
    const token = await cdpFetch<{ token?: string }>("POST", TOKEN_PATH, {
      addresses: [{ address: input.wallet.publicAddress, blockchains: ["base"] }],
      assets: ["USDC"],
      clientIp: input.clientIp,
    })
    if (!token.token) {
      throw new CommitmentPilotError(
        "external_service_unavailable",
        "Coinbase did not create a funding session.",
        502,
      )
    }
    const url = new URL("https://pay.coinbase.com/buy/select-asset")
    url.searchParams.set("sessionToken", token.token)
    url.searchParams.set("partnerUserRef", input.commitment.opaqueCommitmentId.slice(2, 50))
    url.searchParams.set("defaultNetwork", "base")
    url.searchParams.set("defaultAsset", "USDC")
    url.searchParams.set("presetCryptoAmount", (input.commitment.depositAmountMinor / 100).toFixed(2))
    if (input.quote.providerReference) url.searchParams.set("quoteId", input.quote.providerReference)
    return {
      providerReference: input.quote.providerReference ?? createOpaqueId("coinbase-onramp"),
      url: url.toString(),
    }
  },
  async fundExactAmount() {
    throw new CommitmentPilotError(
      "invalid_transition",
      "The patient wallet must authorize the prepared exact-amount deposit.",
      409,
    )
  },
  async prepareDeposit(input) {
    const token = requireAddress("Base Sepolia USDC", process.env.COMMITMENT_BASE_SEPOLIA_USDC_ADDRESS)
    const escrow = requireAddress(
      "Conditional deposit contract",
      process.env.COMMITMENT_BASE_SEPOLIA_ESCROW_ADDRESS,
    )
    return {
      network: "base-sepolia",
      chainId: 84_532,
      amountMinor: input.commitment.depositAmountMinor,
      currency: "USDC",
      calls: buildBaseSepoliaDepositCalls({
        token,
        escrow,
        opaqueCommitmentId: input.commitment.opaqueCommitmentId as Hex,
        amountMinor: input.commitment.depositAmountMinor,
      }),
    }
  },
  async confirmDeposit(input) {
    const escrow = requireAddress(
      "Conditional deposit contract",
      process.env.COMMITMENT_BASE_SEPOLIA_ESCROW_ADDRESS,
    )
    const receipt = await getBaseSepoliaClient().waitForTransactionReceipt({
      hash: input.transactionHash,
      confirmations: 2,
      timeout: 60_000,
    })
    if (receipt.status !== "success") {
      throw new CommitmentPilotError("verification_failed", "The deposit transaction failed.", 409)
    }
    const expectedAmount = amountToUsdcUnits(input.commitment.depositAmountMinor)
    const matchingDeposit = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== escrow.toLowerCase()) return false
      try {
        const decoded = decodeEventLog({
          abi: escrowAbi,
          eventName: "Deposited",
          data: log.data,
          topics: log.topics,
        })
        return (
          decoded.args.commitmentId.toLowerCase() ===
            input.commitment.opaqueCommitmentId.toLowerCase() &&
          decoded.args.depositor.toLowerCase() === input.wallet.publicAddress.toLowerCase() &&
          decoded.args.amount === expectedAmount
        )
      } catch {
        return false
      }
    })
    if (!matchingDeposit) {
      throw new CommitmentPilotError(
        "verification_failed",
        "The transaction did not contain the expected exact deposit.",
        409,
      )
    }
    return {
      id: createOpaqueId("deposit"),
      commitmentId: input.commitment.id,
      kind: "deposit",
      provider: "coinbase_cdp",
      amountMinor: input.commitment.depositAmountMinor,
      currency: "USDC",
      status: "confirmed",
      opaqueTransactionReference: input.transactionHash,
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    }
  },
  async refund(input) {
    const escrow = requireAddress(
      "Conditional deposit contract",
      process.env.COMMITMENT_BASE_SEPOLIA_ESCROW_ADDRESS,
    )
    const accountName = process.env.COMMITMENT_CDP_VERIFIER_ACCOUNT_NAME?.trim()
    if (!accountName) {
      throw new CommitmentPilotError(
        "external_service_unavailable",
        "The policy-scoped refund verifier is not configured.",
        503,
      )
    }
    const functionName =
      input.reason === "completion"
        ? "verifyCondition"
        : input.reason === "cancellation"
          ? "cancel"
          : input.reason === "expiration"
            ? "expire"
            : "exceptionRefund"
    const { CdpClient } = await import("@coinbase/cdp-sdk")
    const client = new CdpClient()
    const account = await client.evm.getAccount({ name: accountName })
    if (!account.policies?.length) {
      throw new CommitmentPilotError(
        "verification_failed",
        "The refund verifier must have a contract-call policy.",
        503,
      )
    }
    const scoped = await account.useNetwork("base-sepolia")
    const transaction = await scoped.sendTransaction({
      transaction: {
        to: escrow,
        data: encodeFunctionData({
          abi: escrowAbi,
          functionName,
          args: [input.commitment.opaqueCommitmentId as Hex],
        }),
        value: BigInt(0),
      },
      idempotencyKey: `refund-${input.commitment.id}-${input.reason}`,
    })
    const receipt = await scoped.waitForTransactionReceipt(transaction)
    return {
      id: createOpaqueId("refund"),
      commitmentId: input.commitment.id,
      kind: "refund",
      provider: "coinbase_cdp",
      amountMinor: input.amountMinor,
      currency: "USDC",
      status: receipt.status === "success" ? "confirmed" : "failed",
      opaqueTransactionReference: transaction.transactionHash,
      createdAt: new Date().toISOString(),
      confirmedAt: receipt.status === "success" ? new Date().toISOString() : undefined,
    }
  },
  async createOfframpSession() {
    return {
      available: false,
      feeDisclosure:
        "Cash-out remains unavailable until Coinbase returns a location-specific sell quote and eligible method.",
      timingDisclosure:
        "Settlement timing is shown by Coinbase only after eligibility and payment-method checks.",
    }
  },
}

export function createCommitmentAdapters(): CommitmentAdapters {
  assertCommitmentSandbox()
  if (getCommitmentPilotNetwork() === "local-mock") return createMockCommitmentAdapters()
  if (!getCommitmentFeatureFlags().coinbaseOnrampPilot) {
    throw new CommitmentPilotError(
      "disabled",
      "Coinbase funding is disabled for this Base Sepolia sandbox.",
      503,
    )
  }
  const mock = createMockCommitmentAdapters()
  return {
    ...mock,
    wallet: coinbaseWalletAdapter,
    payment: coinbasePaymentAdapter,
  }
}
