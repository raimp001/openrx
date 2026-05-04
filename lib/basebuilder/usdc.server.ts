import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  http,
  type Address,
  type Hex,
} from "viem"
import { base, baseSepolia } from "viem/chains"
import { getBaseBuilderNetwork } from "@/lib/basebuilder/config"
import { erc20TransferAbi, getBaseUsdcAddress, parseUsdcAmount, USDC_DECIMALS } from "@/lib/basebuilder/usdc"

export interface BaseUsdcTransferStatus {
  status: "completed" | "pending" | "failed" | "not_found"
  id: string
  message?: string
  sender?: string
  amount?: string
  recipient?: string
  error?: unknown
}

type TransferLog = {
  sender: string
  recipient: string
  amountUnits: bigint
  amount: string
}

function normalizeAddress(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

function isTxHash(value: string): value is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim())
}

function getChain(testnet?: boolean) {
  if (typeof testnet === "boolean") return testnet ? baseSepolia : base
  return getBaseBuilderNetwork() === "base-sepolia" ? baseSepolia : base
}

function getRpcUrl(testnet?: boolean): string | undefined {
  if (testnet) {
    return process.env.OPENRX_BASE_SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || undefined
  }
  return process.env.OPENRX_BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined
}

function decodeUsdcTransfers(logs: Array<{ address: string; data: Hex; topics: readonly Hex[] }>, usdcAddress: string): TransferLog[] {
  const normalizedUsdc = normalizeAddress(usdcAddress)
  const transfers: TransferLog[] = []

  for (const log of logs) {
    if (normalizeAddress(log.address) !== normalizedUsdc) continue

    try {
      const decoded = decodeEventLog({
        abi: erc20TransferAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      })
      if (decoded.eventName !== "Transfer") continue
      const args = decoded.args as { from: Address; to: Address; value: bigint }
      transfers.push({
        sender: normalizeAddress(args.from),
        recipient: normalizeAddress(args.to),
        amountUnits: args.value,
        amount: formatUnits(args.value, USDC_DECIMALS),
      })
    } catch {
      // Ignore non-ERC20 transfer logs from unrelated contracts.
    }
  }

  return transfers
}

export async function resolveBaseUsdcTransferStatus(input: {
  txHash: string
  walletAddress?: string
  expectedRecipient?: string
  expectedAmount?: string
  testnet?: boolean
}): Promise<BaseUsdcTransferStatus> {
  const hash = input.txHash.trim()
  if (!isTxHash(hash)) {
    return { status: "not_found", id: hash, message: "Expected a Base transaction hash." }
  }

  const chain = getChain(input.testnet)
  const client = createPublicClient({
    chain,
    transport: http(getRpcUrl(input.testnet)),
  })

  try {
    const receipt = await client.getTransactionReceipt({ hash })
    if (!receipt) return { status: "pending", id: hash, message: "Transaction receipt is not available yet." }
    if (receipt.status !== "success") {
      return { status: "failed", id: hash, message: "Base transaction reverted or failed." }
    }

    const transfers = decodeUsdcTransfers(receipt.logs, getBaseUsdcAddress(chain.id === baseSepolia.id ? "base-sepolia" : "base"))
    if (transfers.length === 0) {
      return { status: "failed", id: hash, message: "No Base USDC transfer was found in this transaction." }
    }

    const expectedSender = normalizeAddress(input.walletAddress)
    const expectedRecipient = normalizeAddress(input.expectedRecipient)
    const expectedAmountUnits = input.expectedAmount ? parseUsdcAmount(input.expectedAmount) : undefined
    const matchingTransfer = transfers.find((transfer) => {
      if (expectedSender && transfer.sender !== expectedSender) return false
      if (expectedRecipient && transfer.recipient !== expectedRecipient) return false
      if (expectedAmountUnits !== undefined && transfer.amountUnits !== expectedAmountUnits) return false
      return true
    }) || transfers[0]

    return {
      status: "completed",
      id: hash,
      sender: matchingTransfer.sender,
      recipient: matchingTransfer.recipient,
      amount: matchingTransfer.amount,
      message: "Base USDC transfer confirmed.",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Base transaction receipt."
    if (/not found|could not find|transaction receipt/i.test(message)) {
      return { status: "pending", id: hash, message: "Transaction is pending or not indexed yet.", error }
    }
    return { status: "failed", id: hash, message, error }
  }
}
