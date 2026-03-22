import { NextResponse } from "next/server"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { getRecentActions } from "@/lib/ai-engine"
import { listRecentCronRuns, listWorkerHeartbeats } from "@/lib/openclaw/runtime-persistence"

export const dynamic = "force-dynamic"

export async function GET() {
  const hasLLM = !!process.env.OPENAI_API_KEY
  const recentActions = getRecentActions(5)
  const [workers, recentRuns] = await Promise.all([
    listWorkerHeartbeats(5),
    listRecentCronRuns(5),
  ])

  return NextResponse.json({
    connected: hasLLM,
    gateway: {
      status: hasLLM ? "live" : "offline",
      engine: hasLLM ? "OpenAI GPT-4o-mini" : "not-configured",
    },
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
