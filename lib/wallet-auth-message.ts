export const WALLET_AUTH_MESSAGE_VERSION = "openrx-wallet-auth-v1"

export function normalizeWalletForProof(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

export function buildWalletAuthMessage(walletAddress: string): string {
  const wallet = normalizeWalletForProof(walletAddress)
  return [
    "OpenRx wallet access",
    `Version: ${WALLET_AUTH_MESSAGE_VERSION}`,
    `Wallet: ${wallet}`,
    "Purpose: authorize this browser session to read and update my OpenRx care workspace.",
    "This does not authorize payments or blockchain transactions.",
  ].join(" | ")
}

export function walletAuthMessageMatches(message?: string | null, walletAddress?: string | null): boolean {
  const wallet = normalizeWalletForProof(walletAddress)
  const normalizedMessage = (message || "").trim()
  return (
    !!wallet &&
    normalizedMessage.startsWith("OpenRx wallet access") &&
    normalizedMessage.includes(`Version: ${WALLET_AUTH_MESSAGE_VERSION}`) &&
    normalizedMessage.includes(`Wallet: ${wallet}`)
  )
}
