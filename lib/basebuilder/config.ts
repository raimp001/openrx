import { base, baseSepolia } from "viem/chains"

export type BaseBuilderNetwork = "base" | "base-sepolia"

export function getBaseBuilderNetwork(): BaseBuilderNetwork {
  const raw = (process.env.NEXT_PUBLIC_BASEBUILDER_NETWORK || "").trim().toLowerCase()
  return raw === "base-sepolia" ? "base-sepolia" : "base"
}

export function getBaseBuilderChainId(): number {
  return getBaseBuilderNetwork() === "base-sepolia" ? baseSepolia.id : base.id
}

export function getBaseBuilderExplorerBaseUrl(): string {
  return getBaseBuilderNetwork() === "base-sepolia"
    ? "https://sepolia.basescan.org/tx/"
    : "https://basescan.org/tx/"
}

export function getBaseBuilderExplorerRootUrl(): string {
  return getBaseBuilderNetwork() === "base-sepolia"
    ? "https://sepolia.basescan.org"
    : "https://basescan.org"
}

export function toBaseBuilderTxUrl(txHash: string): string {
  return `${getBaseBuilderExplorerBaseUrl()}${txHash}`
}
