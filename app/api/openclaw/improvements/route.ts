import { NextRequest, NextResponse } from "next/server"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { getImprovementMetrics, getImprovements, runImprovementCycle } from "@/lib/openclaw/self-improve"

// GET: Return live care automation improvement status.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("refresh") === "1") {
    runImprovementCycle()
  }

  const now = new Date()
  const improvements = getImprovements().map((entry) => ({
    id: entry.id,
    suggestedBy: entry.suggestedBy,
    category: entry.category,
    title: entry.title,
    status: entry.status,
    votes: entry.votes.length,
    createdAt: entry.createdAt,
  }))
  const metrics = getImprovementMetrics()

  const agentContributions = OPENCLAW_CONFIG.agents.map((agent) => ({
    agentId: agent.id,
    agentName: agent.name,
    suggestionsCount: improvements.filter((item) => item.suggestedBy === agent.id).length,
  }))

  return NextResponse.json({
    protocolVersion: OPENCLAW_CONFIG.protocolVersion,
    qualityMode: OPENCLAW_CONFIG.qualityMode,
    improvements,
    metrics: {
      totalSuggested: metrics.totalSuggested,
      totalDeployed: metrics.totalDeployed,
      totalRejected: metrics.totalRejected,
      totalApproved: improvements.filter((item) => item.status === "approved").length,
      totalInProgress: improvements.filter((item) => item.status === "in_progress").length,
      averageResolutionDays: metrics.averageResolutionDays,
    },
    agentContributions,
    pipelineActive: true,
    nextCycleAt: new Date(now.getTime() + 3600000).toISOString(),
  })
}
