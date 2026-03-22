import { prisma } from "@/lib/db"

export type DatabaseHealthStatus = "missing" | "connected" | "unreachable"

export interface DatabaseHealth {
  status: DatabaseHealthStatus
  configured: boolean
  reachable: boolean
  checkedAt: string
  message: string
}

const CACHE_TTL_MS = 30_000

type CachedHealth = {
  expiresAt: number
  value: DatabaseHealth
}

function getCacheSlot() {
  const globalState = globalThis as typeof globalThis & { __openrxDatabaseHealth?: CachedHealth }
  return globalState
}

function missingResult(): DatabaseHealth {
  return {
    status: "missing",
    configured: false,
    reachable: false,
    checkedAt: new Date().toISOString(),
    message: "DATABASE_URL is not configured.",
  }
}

function unreachableResult(message: string): DatabaseHealth {
  return {
    status: "unreachable",
    configured: true,
    reachable: false,
    checkedAt: new Date().toISOString(),
    message,
  }
}

export async function getDatabaseHealth(options?: { force?: boolean }): Promise<DatabaseHealth> {
  if (!process.env.DATABASE_URL?.trim()) {
    const value = missingResult()
    getCacheSlot().__openrxDatabaseHealth = {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
    return value
  }

  const cache = getCacheSlot().__openrxDatabaseHealth
  if (!options?.force && cache && cache.expiresAt > Date.now()) {
    return cache.value
  }

  try {
    await prisma.$queryRawUnsafe("select 1")
    const value: DatabaseHealth = {
      status: "connected",
      configured: true,
      reachable: true,
      checkedAt: new Date().toISOString(),
      message: "Database is reachable.",
    }
    getCacheSlot().__openrxDatabaseHealth = {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
    return value
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach database."
    const value = unreachableResult(message)
    getCacheSlot().__openrxDatabaseHealth = {
      value,
      expiresAt: Date.now() + 5_000,
    }
    return value
  }
}
