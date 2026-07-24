import { NextRequest, NextResponse } from "next/server"
import { createPublicClient, http, type Address } from "viem"
import { base, baseSepolia } from "viem/chains"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { prisma } from "@/lib/db"
import { getDatabaseHealth } from "@/lib/database-health"
import { resolveBaseUsdcTransferStatus } from "@/lib/basebuilder/usdc.server"
import {
  buildSelfTestReport,
  DEFAULT_SELF_TEST_TX_HASH,
  evaluatePaymentRailsConfig,
  isTxHash,
  type SelfTestCheck,
} from "@/lib/payments-self-test"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LEDGER_ROLLBACK_SENTINEL = "OPENRX_SELF_TEST_ROLLBACK"

const erc20MetadataAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getChain(network: "base" | "base-sepolia") {
  return network === "base-sepolia" ? baseSepolia : base
}

function getRpcUrl(network: "base" | "base-sepolia"): string | undefined {
  if (network === "base-sepolia") {
    return process.env.OPENRX_BASE_SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || undefined
  }
  return process.env.OPENRX_BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined
}

async function checkChainConnectivity(network: "base" | "base-sepolia"): Promise<SelfTestCheck> {
  try {
    const client = createPublicClient({ chain: getChain(network), transport: http(getRpcUrl(network)) })
    const blockNumber = await client.getBlockNumber()
    return {
      id: "chain.connectivity",
      label: "Chain connectivity",
      status: "ok",
      detail: `RPC reachable on ${network}; latest block ${blockNumber.toString()}.`,
    }
  } catch (error) {
    return {
      id: "chain.connectivity",
      label: "Chain connectivity",
      status: "fail",
      detail: `RPC unreachable on ${network}: ${errorMessage(error)}`,
      fixHint: "Set OPENRX_BASE_RPC_URL (or OPENRX_BASE_SEPOLIA_RPC_URL) to a reliable RPC endpoint.",
    }
  }
}

async function checkUsdcContract(network: "base" | "base-sepolia", tokenAddress: string): Promise<SelfTestCheck> {
  try {
    const client = createPublicClient({ chain: getChain(network), transport: http(getRpcUrl(network)) })
    const [decimals, symbol] = await Promise.all([
      client.readContract({
        address: tokenAddress as Address,
        abi: erc20MetadataAbi,
        functionName: "decimals",
      }),
      client.readContract({
        address: tokenAddress as Address,
        abi: erc20MetadataAbi,
        functionName: "symbol",
      }),
    ])
    const mismatch = symbol !== "USDC" || decimals !== 6
    return {
      id: "chain.usdcContract",
      label: "USDC contract metadata",
      status: mismatch ? "warn" : "ok",
      detail: `Contract at ${tokenAddress} responded: symbol=${symbol}, decimals=${decimals}.${
        mismatch ? " Expected USDC with 6 decimals — verify the configured token address." : ""
      }`,
      ...(mismatch
        ? { fixHint: "Point OPENRX_BASE_USDC_TOKEN / NEXT_PUBLIC_BASE_USDC_TOKEN at the canonical USDC token for this network." }
        : {}),
    }
  } catch (error) {
    return {
      id: "chain.usdcContract",
      label: "USDC contract metadata",
      status: "fail",
      detail: `Unable to read USDC contract at ${tokenAddress}: ${errorMessage(error)}`,
      fixHint: "Confirm the configured USDC token address exists on the resolved network.",
    }
  }
}

async function checkLedgerDatabase(): Promise<SelfTestCheck> {
  const health = await getDatabaseHealth({ force: true })
  if (!health.configured) {
    return {
      id: "ledger.database",
      label: "Ledger database write/rollback",
      status: "fail",
      detail: "DATABASE_URL is not configured; the Postgres ledger cannot be exercised.",
      fixHint: "Set DATABASE_URL and run `npx prisma migrate deploy`.",
    }
  }
  if (!health.reachable) {
    return {
      id: "ledger.database",
      label: "Ledger database write/rollback",
      status: "fail",
      detail: `Database is configured but unreachable (${health.status}).`,
      fixHint: "Check DATABASE_URL and database availability, then run `npx prisma migrate deploy`.",
    }
  }

  const sentinelIntentId = `self-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date()

  // Preferred path: write a full ledger payment + entry inside an interactive
  // transaction and intentionally roll it back, proving the tables exist and
  // are writable while leaving zero data behind.
  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.ledgerPaymentRecord.create({
        data: {
          id: `pay-${sentinelIntentId}`,
          intentId: sentinelIntentId,
          walletAddress: "0x0000000000000000000000000000000000000001",
          recipientAddress: "0x0000000000000000000000000000000000000002",
          category: "other",
          description: "Payment rails self-test sentinel (rolled back)",
          expectedAmount: "0.01",
          status: "initiated",
          metadata: { selfTest: true },
          createdAt: now,
        },
      })
      await tx.ledgerEntryRecord.create({
        data: {
          id: `led-${sentinelIntentId}`,
          eventType: "payment_intent_created",
          direction: "memo",
          accountCode: "9990-COMPLIANCE",
          amount: "0.01",
          currency: "USDC",
          description: "Payment rails self-test sentinel (rolled back)",
          paymentId: payment.id,
          reference: sentinelIntentId,
          metadata: { selfTest: true },
          createdAt: now,
        },
      })
      throw new Error(LEDGER_ROLLBACK_SENTINEL)
    })
    // If we reach here the transaction committed unexpectedly.
    await prisma.ledgerEntryRecord.deleteMany({ where: { reference: sentinelIntentId } })
    await prisma.ledgerPaymentRecord.deleteMany({ where: { intentId: sentinelIntentId } })
    return {
      id: "ledger.database",
      label: "Ledger database write/rollback",
      status: "fail",
      detail: "Self-test transaction committed instead of rolling back; sentinel rows were cleaned up manually.",
      fixHint: "Investigate Prisma transaction behavior for this database.",
    }
  } catch (error) {
    if (errorMessage(error).includes(LEDGER_ROLLBACK_SENTINEL)) {
      const leftover = await prisma.ledgerPaymentRecord.count({ where: { intentId: sentinelIntentId } })
      if (leftover === 0) {
        return {
          id: "ledger.database",
          label: "Ledger database write/rollback",
          status: "ok",
          detail: "Ledger tables accepted a write inside a transaction that was intentionally rolled back; no data persisted.",
        }
      }
      await prisma.ledgerEntryRecord.deleteMany({ where: { reference: sentinelIntentId } })
      await prisma.ledgerPaymentRecord.deleteMany({ where: { intentId: sentinelIntentId } })
      return {
        id: "ledger.database",
        label: "Ledger database write/rollback",
        status: "fail",
        detail: "Rollback sentinel was raised but rows persisted; manual cleanup was applied.",
        fixHint: "Investigate transaction isolation for the payments ledger tables.",
      }
    }

    // Interactive transactions can fail on unmigrated schemas; fall back to a
    // create-then-delete sentinel so the tables are still exercised for real.
    try {
      const payment = await prisma.ledgerPaymentRecord.create({
        data: {
          id: `pay-${sentinelIntentId}`,
          intentId: sentinelIntentId,
          walletAddress: "0x0000000000000000000000000000000000000001",
          recipientAddress: "0x0000000000000000000000000000000000000002",
          category: "other",
          description: "Payment rails self-test sentinel (deleted)",
          expectedAmount: "0.01",
          status: "initiated",
          metadata: { selfTest: true },
          createdAt: now,
        },
      })
      await prisma.ledgerPaymentRecord.delete({ where: { id: payment.id } })
      return {
        id: "ledger.database",
        label: "Ledger database write/rollback",
        status: "warn",
        detail: `Interactive rollback unavailable (${errorMessage(error)}); fell back to create-and-delete sentinel, which succeeded.`,
        fixHint: "Run `npx prisma migrate deploy` so ledger tables support transactional rollback.",
      }
    } catch (fallbackError) {
      await prisma.ledgerPaymentRecord.deleteMany({ where: { intentId: sentinelIntentId } }).catch(() => undefined)
      return {
        id: "ledger.database",
        label: "Ledger database write/rollback",
        status: "fail",
        detail: `Ledger tables are not writable: ${errorMessage(fallbackError)}`,
        fixHint: "Run `npx prisma migrate deploy` and confirm the database user has write access.",
      }
    }
  }
}

async function checkVerificationPath(
  network: "base" | "base-sepolia",
  txHashOverride?: string | null
): Promise<SelfTestCheck> {
  const txHash = (txHashOverride || "").trim()
  if (network === "base-sepolia" && !txHash) {
    return {
      id: "verification.path",
      label: "On-chain verification path",
      status: "warn",
      detail: "Skipped on base-sepolia: no default historical USDC transfer is documented for testnet.",
      fixHint: "Re-run with ?txhash=<base-sepolia USDC transfer hash> to exercise the verification path.",
    }
  }
  const targetHash = txHash || DEFAULT_SELF_TEST_TX_HASH
  if (!isTxHash(targetHash)) {
    return {
      id: "verification.path",
      label: "On-chain verification path",
      status: "fail",
      detail: `Provided ?txhash= override "${targetHash}" is not a valid transaction hash.`,
      fixHint: "Pass a 0x-prefixed 64-hex-character transaction hash.",
    }
  }

  try {
    const result = await resolveBaseUsdcTransferStatus({
      txHash: targetHash,
      testnet: network === "base-sepolia",
    })
    if (result.status === "completed" && result.sender && result.recipient && result.amount) {
      return {
        id: "verification.path",
        label: "On-chain verification path",
        status: "ok",
        detail: `Resolved USDC transfer ${targetHash}: ${result.amount} USDC from ${result.sender} to ${result.recipient}.`,
      }
    }
    return {
      id: "verification.path",
      label: "On-chain verification path",
      status: "fail",
      detail: `Verification returned status "${result.status}" for ${targetHash}: ${result.message || "no detail"}.`,
      fixHint: "Confirm the hash is a successful USDC transfer on the resolved network, or override with ?txhash=.",
    }
  } catch (error) {
    return {
      id: "verification.path",
      label: "On-chain verification path",
      status: "fail",
      detail: `Verification path threw for ${targetHash}: ${errorMessage(error)}`,
      fixHint: "Check RPC reachability and that the hash belongs to the resolved network.",
    }
  }
}

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Payment rails self-test requires admin authorization." }, { status: 401 })
  }

  const txHashOverride = request.nextUrl.searchParams.get("txhash")
  const { network, usdcTokenAddress, checks: configChecks } = evaluatePaymentRailsConfig(process.env)

  const [chainCheck, contractCheck, ledgerCheck] = await Promise.all([
    checkChainConnectivity(network),
    checkUsdcContract(network, usdcTokenAddress),
    checkLedgerDatabase(),
  ])
  const verificationCheck = await checkVerificationPath(network, txHashOverride)

  const report = buildSelfTestReport({ network, checks: [...configChecks, chainCheck, contractCheck, ledgerCheck, verificationCheck] })
  return NextResponse.json(report, { status: report.status === "fail" ? 503 : 200 })
}
