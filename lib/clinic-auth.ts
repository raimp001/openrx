import type { NextRequest } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"

export type ClinicRole = "admin" | "staff" | "service" | "patient"

export interface ClinicSession {
  userId: string
  role: ClinicRole
  walletAddress?: string
  canAccessCareTeam: boolean
  authSource: "admin_api_key" | "agent_token" | "trusted_header" | "wallet_lookup" | "default"
}

function normalizeRole(value?: string | null): ClinicRole | null {
  if (!value) return null
  const lowered = value.toLowerCase().trim()
  if (["admin", "administrator"].includes(lowered)) return "admin"
  if (["staff", "doctor", "pharmacist", "operator"].includes(lowered)) return "staff"
  if (["service", "system", "agent"].includes(lowered)) return "service"
  if (["patient", "user"].includes(lowered)) return "patient"
  return null
}

function dbRoleToClinicRole(value?: string | null): ClinicRole {
  const role = (value || "").toUpperCase()
  if (role === "ADMIN") return "admin"
  if (role === "DOCTOR" || role === "PHARMACIST") return "staff"
  return "patient"
}

export function canAccessCareTeam(role: ClinicRole): boolean {
  return role === "admin" || role === "staff" || role === "service"
}

function getDefaultRole(): ClinicRole {
  const envRole = normalizeRole(process.env.OPENRX_CARE_TEAM_DEFAULT_ROLE)
  if (envRole) return envRole
  return "patient"
}

function getHeader(headers: Headers, key: string): string {
  return headers.get(key) || ""
}

async function resolveRoleFromWallet(headers: Headers): Promise<{ userId?: string; role?: ClinicRole; walletAddress?: string }> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.OPENRX_ALLOW_UNSIGNED_WALLET_HEADER !== "true"
  ) {
    return {}
  }

  const wallet =
    getHeader(headers, "x-wallet-address") ||
    getHeader(headers, "x-openrx-wallet") ||
    getHeader(headers, "x-user-wallet")

  if (!wallet || !process.env.DATABASE_URL) {
    return {}
  }

  const normalizedWallet = wallet.trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedWallet)) {
    return {}
  }

  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedWallet },
      select: { id: true, role: true },
    })
    if (!user) return {}

    return {
      userId: user.id,
      role: dbRoleToClinicRole(user.role),
      walletAddress: normalizedWallet,
    }
  } catch {
    return {}
  }
}

function getTrustedRole(headers: Headers): { userId?: string; role?: ClinicRole } {
  const trustHeader = (process.env.OPENRX_TRUST_ROLE_HEADER || "false").toLowerCase() === "true"
  if (!trustHeader) return {}

  const role = normalizeRole(getHeader(headers, "x-openrx-user-role") || getHeader(headers, "x-user-role"))
  if (!role) return {}

  const userId =
    getHeader(headers, "x-openrx-user-id") ||
    getHeader(headers, "x-user-id") ||
    `header-${Date.now()}`

  return { userId, role }
}

export async function resolveClinicSession(request: NextRequest): Promise<ClinicSession> {
  const headers = request.headers

  const adminKey = process.env.OPENRX_ADMIN_API_KEY || ""
  const headerAdminKey = getHeader(headers, "x-admin-api-key")
  if (adminKey && headerAdminKey && adminKey.length === headerAdminKey.length && crypto.timingSafeEqual(Buffer.from(adminKey), Buffer.from(headerAdminKey))) {
    return {
      userId: getHeader(headers, "x-openrx-user-id") || "admin-api",
      role: "admin",
      canAccessCareTeam: true,
      authSource: "admin_api_key",
    }
  }

  const agentToken = process.env.OPENRX_AGENT_NOTIFY_TOKEN || ""
  const bearer = getHeader(headers, "authorization").replace(/^Bearer\s+/i, "")
  if (agentToken && bearer && agentToken.length === bearer.length && crypto.timingSafeEqual(Buffer.from(agentToken), Buffer.from(bearer))) {
    return {
      userId: "openclaw-service",
      role: "service",
      canAccessCareTeam: true,
      authSource: "agent_token",
    }
  }

  const trusted = getTrustedRole(headers)
  if (trusted.role) {
    return {
      userId: trusted.userId || "trusted-user",
      role: trusted.role,
      canAccessCareTeam: canAccessCareTeam(trusted.role),
      authSource: "trusted_header",
    }
  }

  const walletResolved = await resolveRoleFromWallet(headers)
  if (walletResolved.role) {
    return {
      userId: walletResolved.userId || "wallet-user",
      role: walletResolved.role,
      walletAddress: walletResolved.walletAddress,
      canAccessCareTeam: canAccessCareTeam(walletResolved.role),
      authSource: "wallet_lookup",
    }
  }

  const fallbackRole = getDefaultRole()
  return {
    userId: getHeader(headers, "x-openrx-user-id") || "anonymous",
    role: fallbackRole,
    canAccessCareTeam: canAccessCareTeam(fallbackRole),
    authSource: "default",
  }
}
