import { NextRequest, NextResponse } from "next/server"
import { createPublicClient, http, type Address, type Hex } from "viem"
import { base } from "viem/chains"
import { resolveClinicSession, type ClinicSession } from "@/lib/clinic-auth"
import { walletAuthMessageMatches } from "@/lib/wallet-auth-message"

const PUBLIC_PATIENT_API_PATHS = new Set([
  "/api/ai/chat",
  "/api/openclaw/chat",
  "/api/pa/appeal",
  "/api/pa/evaluate",
  "/api/second-opinion/review",
])

function getPathname(request: NextRequest): string {
  return request.nextUrl?.pathname || new URL(request.url).pathname
}

function allowsPublicPatientAccess(request: NextRequest): boolean {
  return PUBLIC_PATIENT_API_PATHS.has(getPathname(request))
}

export function normalizeWalletAddress(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

export function isEvmWalletAddress(value?: string | null): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test((value || "").trim())
}

export function getRequestWalletAddress(request: NextRequest): string {
  return normalizeWalletAddress(
    request.headers.get("x-wallet-address") ||
      request.headers.get("x-openrx-wallet") ||
      request.headers.get("x-user-wallet")
  )
}

export function allowsUnsignedWalletHeader(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.OPENRX_ALLOW_UNSIGNED_WALLET_HEADER === "true"
}

export function requestWalletMatches(request: NextRequest, walletAddress?: string | null): boolean {
  if (!allowsUnsignedWalletHeader()) return false
  const requestedWallet = normalizeWalletAddress(walletAddress)
  const headerWallet = getRequestWalletAddress(request)
  return !!requestedWallet && !!headerWallet && requestedWallet === headerWallet
}

type WalletProofClient = {
  verifyMessage: (params: {
    address: Address
    message: string
    signature: Hex
  }) => Promise<boolean>
}

let walletProofClient: WalletProofClient | null = null

function getWalletProofClient() {
  if (!walletProofClient) {
    walletProofClient = createPublicClient({
      chain: base,
      transport: http(process.env.OPENRX_BASE_RPC_URL || undefined),
    }) as WalletProofClient
  }
  return walletProofClient
}

export async function requestWalletProofMatches(
  request: NextRequest,
  walletAddress?: string | null
): Promise<boolean> {
  if (requestWalletMatches(request, walletAddress)) return true

  const requestedWallet = normalizeWalletAddress(walletAddress)
  const headerWallet = getRequestWalletAddress(request)
  const signature = request.headers.get("x-wallet-signature") || ""
  const message = request.headers.get("x-wallet-message") || ""

  if (!isEvmWalletAddress(requestedWallet)) return false
  if (headerWallet !== requestedWallet) return false
  if (!/^0x[a-fA-F0-9]+$/.test(signature)) return false
  if (!walletAuthMessageMatches(message, requestedWallet)) return false

  try {
    return await getWalletProofClient().verifyMessage({
      address: requestedWallet as Address,
      message,
      signature: signature as Hex,
    })
  } catch {
    return false
  }
}

export function isDemoWalletAddress(walletAddress?: string | null): boolean {
  const wallet = normalizeWalletAddress(walletAddress)
  const demoWallets = [
    process.env.NEXT_PUBLIC_DEVELOPER_WALLET,
    process.env.NEXT_PUBLIC_DEMO_WALLET,
    process.env.OPENRX_DEMO_WALLET,
  ]
    .map(normalizeWalletAddress)
    .filter(Boolean)

  return !!wallet && demoWallets.includes(wallet)
}

export function canUseWalletScopedData(session: ClinicSession, walletAddress?: string | null): boolean {
  const wallet = normalizeWalletAddress(walletAddress)
  if (!wallet) return false
  if (session.authSource === "wallet_lookup") {
    return normalizeWalletAddress(session.walletAddress) === wallet
  }
  if (session.authSource === "admin_api_key" || session.authSource === "agent_token" || session.authSource === "trusted_header") {
    return true
  }
  return isDemoWalletAddress(wallet)
}

/**
 * Require a real auth source in production. Returns the session if authorized,
 * or a 401 NextResponse if the caller has no credentials.
 */
export async function requireAuth(
  request: NextRequest,
  options?: { allowPublic?: boolean }
): Promise<{ session: ClinicSession } | { response: NextResponse }> {
  const session = await resolveClinicSession(request)

  if (
    session.authSource === "default" &&
    process.env.NODE_ENV === "production" &&
    !options?.allowPublic &&
    !allowsPublicPatientAccess(request)
  ) {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    }
  }

  return { session }
}
