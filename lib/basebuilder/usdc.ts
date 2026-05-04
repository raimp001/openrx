import { encodeFunctionData, parseUnits, type Address } from "viem"
import { getBaseBuilderNetwork, type BaseBuilderNetwork } from "@/lib/basebuilder/config"

export const USDC_DECIMALS = 6
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const
export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const

export const erc20TransferAbi = [
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
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const

export function getBaseUsdcAddress(network: BaseBuilderNetwork = getBaseBuilderNetwork()): Address {
  const configured = (
    process.env.NEXT_PUBLIC_BASE_USDC_TOKEN ||
    process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS ||
    process.env.OPENRX_BASE_USDC_TOKEN ||
    ""
  ).trim()
  if (/^0x[a-fA-F0-9]{40}$/.test(configured)) return configured as Address
  return network === "base-sepolia" ? BASE_SEPOLIA_USDC_ADDRESS : BASE_USDC_ADDRESS
}

export function parseUsdcAmount(amount: string): bigint {
  const normalized = amount.replace(/[^0-9.]/g, "").trim()
  if (!normalized) return BigInt(0)
  return parseUnits(normalized, USDC_DECIMALS)
}

export function buildUsdcTransferCall(input: {
  amount: string
  recipientAddress: string
  network?: BaseBuilderNetwork
}) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.recipientAddress.trim())) {
    throw new Error("Recipient must be a valid EVM address.")
  }

  const value = parseUsdcAmount(input.amount)
  if (value <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.")
  }

  return {
    to: getBaseUsdcAddress(input.network),
    data: encodeFunctionData({
      abi: erc20TransferAbi,
      functionName: "transfer",
      args: [input.recipientAddress.trim() as Address, value],
    }),
    value: BigInt(0),
  }
}
