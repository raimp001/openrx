import { NextRequest, NextResponse } from "next/server"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { routeUserMessageLLM } from "@/lib/openclaw/router"
import {
  getActiveSessions,
  getActiveTasks,
  getOrchestratorState,
} from "@/lib/openclaw/orchestrator"

// GET: Get orchestrator state and agent collaboration info
export async function GET() {
  const orch = getOrchestratorState()
  const agents = OPENCLAW_CONFIG.agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    description: a.description,
    canMessage: a.canMessage,
    status: orch.agentStatuses[a.id] ?? "idle",
  }))

  const collaborationMap = OPENCLAW_CONFIG.agents.map((agent) => ({
    agentId: agent.id,
    name: agent.name,
    canMessageTo: agent.canMessage,
    canReceiveFrom: OPENCLAW_CONFIG.agents
      .filter((other) => {
        const cm = other.canMessage as readonly string[]
        return cm.includes("*") || cm.includes(agent.id)
      })
      .map((other) => other.id),
  }))

  const activeTasks = getActiveTasks()

  return NextResponse.json({
    agents,
    collaborationMap,
    totalAgents: agents.length,
    cronJobs: OPENCLAW_CONFIG.cronJobs.length,
    channels: Object.entries(OPENCLAW_CONFIG.channels)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k),
    orchestrator: {
      activeSessionCount: getActiveSessions().length,
      activeTaskCount: activeTasks.length,
      messageLogSize: orch.messageLog.length,
      agentStatuses: orch.agentStatuses,
    },
  })
}

// POST: Trigger a multi-agent workflow
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, walletAddress } = body as {
      message: string
      walletAddress?: string
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      )
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: "message must be under 5000 characters" },
        { status: 400 }
      )
    }

    const route = await routeUserMessageLLM(message)

    return NextResponse.json({
      route,
      walletLinked: !!walletAddress,
      agentCount: OPENCLAW_CONFIG.agents.length,
      routedByLLM: !!process.env.ANTHROPIC_API_KEY,
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to process orchestration request" },
      { status: 500 }
    )
  }
}
