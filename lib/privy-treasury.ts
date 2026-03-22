import { encodeFunctionData, isAddress, parseEther, parseUnits, toHex } from "viem"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { listTreasuryActions, recordTreasuryAction, type TreasuryActionRecord } from "@/lib/payments-ledger"

const PRIVY_API_ROOT = "https://api.privy.io/v1"
const BASE_CAIP2 = "eip155:8453"
const BASE_USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

export interface PrivyBalance {
  chain: string
  asset: string
  rawValue: string
  decimals: number
  display: string
  usd?: string
}

export interface PrivyTransaction {
  hash?: string
  status: string
  createdAt: string
  type?: string
  chain?: string
  asset?: string
  sender?: string
  recipient?: string
  amount?: string
}

export interface TreasurySnapshot {
  configured: boolean
  message: string
  walletId?: string
  walletAddress?: string
  balances: PrivyBalance[]
  recentTransactions: PrivyTransaction[]
  recentActions: TreasuryActionRecord[]
}

export interface TreasuryTransferInput {
  asset: "ETH" | "USDC"
  amount: string
  toAddress: string
  reason: string
  initiatedBy: string
  kind?: "transfer" | "refund"
}

interface PrivyConfig {
  appId: string
  appSecret: string
  walletId: string
  walletAddress: string
}

function getPrivyConfig(): PrivyConfig | null {
  const appId = process.env.PRIVY_APP_ID?.trim()
  const appSecret = process.env.PRIVY_APP_SECRET?.trim()
  const walletId = process.env.OPENRX_TREASURY_PRIVY_WALLET_ID?.trim()
  const walletAddress = process.env.OPENRX_TREASURY_WALLET?.trim()
  if (!appId || !appSecret || !walletId || !walletAddress) return null
  return { appId, appSecret, walletId, walletAddress }
}

function privyHeaders(config: PrivyConfig): HeadersInit {
  const auth = Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64")
  return {
    Authorization: `Basic ${auth}`,
    "privy-app-id": config.appId,
    "Content-Type": "application/json",
  }
}

async function fetchPrivy(path: string, init: RequestInit, config: PrivyConfig): Promise<Response> {
  return fetchWithTimeout(`${PRIVY_API_ROOT}${path}`, {
    ...init,
    headers: {
      ...privyHeaders(config),
      ...(init.headers || {}),
    },
    cache: "no-store",
  }, 12_000)
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function normalizeAmount(value: string): string {
  const numeric = Number.parseFloat(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Amount must be a positive decimal value.")
  }
  return numeric.toFixed(2)
}

export function getPrivyTreasuryConfigState() {
  const configured = Boolean(getPrivyConfig())
  return {
    configured,
    message: configured
      ? "Privy treasury is configured."
      : "Set PRIVY_APP_ID, PRIVY_APP_SECRET, OPENRX_TREASURY_PRIVY_WALLET_ID, and OPENRX_TREASURY_WALLET to enable treasury controls.",
  }
}

async function fetchWallet(config: PrivyConfig): Promise<{ id: string; address?: string }> {
  const response = await fetchPrivy(`/wallets/${config.walletId}`, { method: "GET" }, config)
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Privy wallet lookup failed (${response.status}): ${details || "unknown error"}`)
  }
  const payload = parseJsonObject(await response.json())
  return {
    id: String(payload.id || config.walletId),
    address: typeof payload.address === "string" ? payload.address : config.walletAddress,
  }
}

async function fetchBalances(config: PrivyConfig): Promise<PrivyBalance[]> {
  const response = await fetchPrivy(`/wallets/${config.walletId}/balance?chain=base&include_currency=usd`, { method: "GET" }, config)
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Privy balance fetch failed (${response.status}): ${details || "unknown error"}`)
  }

  const payload = parseJsonObject(await response.json())
  const balances = Array.isArray(payload.balances) ? payload.balances : []
  return balances.map((item) => {
    const record = parseJsonObject(item)
    const displayValues = parseJsonObject(record.display_values)
    return {
      chain: String(record.chain || "base"),
      asset: String(record.asset || "eth").toUpperCase(),
      rawValue: String(record.raw_value || "0"),
      decimals: Number(record.raw_value_decimals || 18),
      display: String(displayValues.eth || displayValues.usdc || displayValues.value || "0"),
      usd: typeof displayValues.usd === "string" ? displayValues.usd : undefined,
    }
  })
}

async function fetchTransactions(config: PrivyConfig): Promise<PrivyTransaction[]> {
  const response = await fetchPrivy(`/wallets/${config.walletId}/transactions`, { method: "GET" }, config)
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Privy transaction fetch failed (${response.status}): ${details || "unknown error"}`)
  }

  const payload = parseJsonObject(await response.json())
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : []
  return transactions.slice(0, 12).map((item) => {
    const record = parseJsonObject(item)
    const details = parseJsonObject(record.details)
    return {
      hash: typeof record.transaction_hash === "string" ? record.transaction_hash : undefined,
      status: String(record.status || "unknown"),
      createdAt: new Date(Number(record.created_at || Date.now())).toISOString(),
      type: typeof details.type === "string" ? details.type : undefined,
      chain: typeof details.chain === "string" ? details.chain : undefined,
      asset: typeof details.asset === "string" ? details.asset.toUpperCase() : undefined,
      sender: typeof details.sender === "string" ? details.sender : undefined,
      recipient: typeof details.recipient === "string" ? details.recipient : undefined,
      amount: typeof details.amount === "string" ? details.amount : undefined,
    }
  })
}

export async function getTreasurySnapshot(): Promise<TreasurySnapshot> {
  const config = getPrivyConfig()
  const recentActions = await listTreasuryActions(12)

  if (!config) {
    return {
      configured: false,
      message: "Set PRIVY_APP_ID, PRIVY_APP_SECRET, OPENRX_TREASURY_PRIVY_WALLET_ID, and OPENRX_TREASURY_WALLET to enable treasury controls.",
      balances: [],
      recentTransactions: [],
      recentActions,
    }
  }

  const [wallet, balances, recentTransactions] = await Promise.all([
    fetchWallet(config),
    fetchBalances(config),
    fetchTransactions(config),
  ])

  return {
    configured: true,
    message: "Privy treasury is live.",
    walletId: wallet.id,
    walletAddress: wallet.address,
    balances,
    recentTransactions,
    recentActions,
  }
}

export async function submitTreasuryTransfer(input: TreasuryTransferInput): Promise<{
  action: TreasuryActionRecord
  transactionHash?: string
  privyTransferId?: string
}> {
  const config = getPrivyConfig()
  if (!config) {
    throw new Error("Privy treasury is not configured.")
  }
  if (!isAddress(input.toAddress)) {
    throw new Error("Recipient must be a valid EVM address.")
  }

  const amount = normalizeAmount(input.amount)
  const asset = input.asset
  const tokenAddress = asset === "USDC" ? process.env.OPENRX_BASE_USDC_TOKEN?.trim() || BASE_USDC_TOKEN : undefined
  const rpcBody =
    asset === "ETH"
      ? {
          method: "eth_sendTransaction",
          caip2: BASE_CAIP2,
          chain_type: "ethereum",
          params: {
            transaction: {
              to: input.toAddress,
              value: toHex(parseEther(amount)),
            },
          },
        }
      : {
          method: "eth_sendTransaction",
          caip2: BASE_CAIP2,
          chain_type: "ethereum",
          params: {
            transaction: {
              to: tokenAddress,
              value: "0x0",
              data: encodeFunctionData({
                abi: [
                  {
                    type: "function",
                    name: "transfer",
                    stateMutability: "nonpayable",
                    inputs: [
                      { name: "to", type: "address" },
                      { name: "value", type: "uint256" },
                    ],
                    outputs: [{ name: "", type: "bool" }],
                  },
                ],
                functionName: "transfer",
                args: [input.toAddress as `0x${string}`, parseUnits(amount, 6)],
              }),
            },
          },
        }

  let action: TreasuryActionRecord | null = null

  try {
    const response = await fetchPrivy(`/wallets/${config.walletId}/rpc`, {
      method: "POST",
      body: JSON.stringify(rpcBody),
    }, config)

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`Privy transfer failed (${response.status}): ${details || "unknown error"}`)
    }

    const payload = parseJsonObject(await response.json())
    const data = parseJsonObject(payload.data)
    const transactionHash =
      typeof data.hash === "string"
        ? data.hash
        : typeof data.transaction_hash === "string"
          ? data.transaction_hash
          : undefined
    const privyTransferId =
      typeof data.transaction_id === "string"
        ? data.transaction_id
        : typeof data.privy_transaction_id === "string"
          ? data.privy_transaction_id
          : undefined

    action = await recordTreasuryAction({
      kind: input.kind || "transfer",
      asset,
      amount,
      chain: "base",
      tokenAddress,
      fromAddress: config.walletAddress,
      toAddress: input.toAddress,
      initiatedBy: input.initiatedBy,
      reason: input.reason,
      status: transactionHash ? "submitted" : "initiated",
      walletId: config.walletId,
      transactionHash,
      privyTransferId,
      metadata: {
        provider: "privy",
      },
    })

    return {
      action,
      transactionHash,
      privyTransferId,
    }
  } catch (error) {
    action = await recordTreasuryAction({
      kind: input.kind || "transfer",
      asset,
      amount,
      chain: "base",
      tokenAddress,
      fromAddress: config.walletAddress,
      toAddress: input.toAddress,
      initiatedBy: input.initiatedBy,
      reason: input.reason,
      status: "failed",
      walletId: config.walletId,
      errorMessage: error instanceof Error ? error.message : "Privy transfer failed.",
      metadata: {
        provider: "privy",
      },
    })
    throw Object.assign(error instanceof Error ? error : new Error("Privy transfer failed."), {
      actionId: action.id,
    })
  }
}
