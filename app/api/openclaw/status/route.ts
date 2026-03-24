import { NextResponse } from "next/server"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { getRecentActions } from "@/lib/ai-engine"
import { listRecentCronRuns, listWorkerHeartbeats } from "@/lib/openclaw/runtime-persistence"

type WorkerRecord = Awaited<ReturnType<typeof listWorkerHeartbeats>>[number]

export const dynamic = "force-dynamic"

const ACTIVE_WORKER_WINDOW_MS = 12 * 60 * 60 * 1000

function toEpoch(value: Date | string | null | undefined): number {
  if (!value) return 0
  return new Date(value).getTime()
}

function isActiveWorker(worker: WorkerRecord): boolean {
  return Date.now() - toEpoch(worker.lastSeenAt) <= ACTIVE_WORKER_WINDOW_MS
}

function workerPriority(worker: WorkerRecord): number {
  switch (worker.workerType) {
    case "aws-scheduler":
      return 0
    case "researcher-vm":
      return 1
    case "vercel-cron":
      return 2
    case "manual":
      return 3
    default:
      return 4
  }
}

function summarizeScheduler(workers: WorkerRecord[]) {
  const activeWorkers = workers.filter(isActiveWorker)
  const hasAws = activeWorkers.some((worker) => worker.workerType === "aws-scheduler")
  const hasVercel = activeWorkers.some((worker) => worker.workerType === "vercel-cron")
  const hasManual = activeWorkers.some((worker) => worker.workerType === "manual")

  if (hasAws && hasVercel) {
    return {
      mode: "hybrid",
      awsWorkerActive: true,
      vercelCronActive: true,
      cutoverReady: false,
      message: "AWS worker heartbeat is active, but Vercel cron is still enabled as fallback.",
    }
  }

  if (hasAws) {
    return {
      mode: "aws",
      awsWorkerActive: true,
      vercelCronActive: false,
      cutoverReady: true,
      message: "AWS worker heartbeat is active and Vercel cron is not currently active.",
    }
  }

  if (hasVercel) {
    return {
      mode: "vercel",
      awsWorkerActive: false,
      vercelCronActive: true,
      cutoverReady: false,
      message: "Vercel cron is currently driving scheduled jobs.",
    }
  }

  if (hasManual) {
    return {
      mode: "manual",
      awsWorkerActive: false,
      vercelCronActive: false,
      cutoverReady: false,
      message: "Only manual worker activity is currently visible.",
    }
  }

  return {
    mode: "offline",
    awsWorkerActive: false,
    vercelCronActive: false,
    cutoverReady: false,
    message: "No recent background worker heartbeat is visible.",
  }
}

export async function GET() {
  const hasLLM = !!process.env.OPENAI_API_KEY
  const recentActions = getRecentActions(5)
  const [allWorkers, recentRuns] = await Promise.all([
    listWorkerHeartbeats(20),
    listRecentCronRuns(5),
  ])

  const workers = allWorkers
    .filter(isActiveWorker)
    .sort((left, right) => {
      const priorityDelta = workerPriority(left) - workerPriority(right)
      if (priorityDelta !== 0) return priorityDelta
      return toEpoch(right.lastSeenAt) - toEpoch(left.lastSeenAt)
    })
    .slice(0, 5)

  return NextResponse.json({
    connected: hasLLM,
    gateway: {
      status: hasLLM ? "live" : "offline",
      engine: hasLLM ? "OpenAI GPT-4o-mini" : "not-configured",
    },
    scheduler: summarizeScheduler(allWorkers),
    recentActions,
    agents: OPENCLAW_CONFIG.agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
    })),
    channels: Object.entries(OPENCLAW_CONFIG.channels)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k),
    backgroundWorkers: workers,
    recentCronRuns: recentRuns,
    cronJobs: OPENCLAW_CONFIG.cronJobs.map((j) => ({
      id: j.id,
      schedule: j.schedule,
      description: j.description,
      agentId: j.agentId,
    })),
  })
}
