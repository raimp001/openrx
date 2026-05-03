import { expect, test } from "@playwright/test"

test("OpenClaw platform APIs expose status, routing, actions, and improvement state", async ({ request }) => {
  const statusResponse = await request.get("/api/openclaw/status")
  expect(statusResponse.ok()).toBeTruthy()

  const status = (await statusResponse.json()) as {
    connected: boolean
    gateway: { status: string; engine: string }
    scheduler: { mode: string; message: string }
    agents: Array<{ id: string; name: string }>
    cronJobs: Array<{ id: string }>
  }

  expect(typeof status.connected).toBe("boolean")
  expect(status.gateway.status.length).toBeGreaterThan(0)
  expect(status.scheduler.message.length).toBeGreaterThan(0)
  expect(status.agents.length).toBeGreaterThanOrEqual(10)
  expect(status.agents.some((agent) => agent.id === "coordinator")).toBe(true)
  expect(status.cronJobs.some((job) => job.id === "daily-health-check")).toBe(true)

  const actionsResponse = await request.get("/api/openclaw/actions?limit=5")
  expect(actionsResponse.ok()).toBeTruthy()
  const actions = (await actionsResponse.json()) as { actions: unknown[] }
  expect(Array.isArray(actions.actions)).toBe(true)

  const improvementsResponse = await request.get("/api/openclaw/improvements?refresh=1")
  expect(improvementsResponse.ok()).toBeTruthy()
  const improvements = (await improvementsResponse.json()) as {
    protocolVersion: string
    pipelineActive: boolean
    metrics: { totalSuggested: number; totalDeployed: number }
    agentContributions: Array<{ agentId: string }>
  }

  expect(improvements.protocolVersion.length).toBeGreaterThan(0)
  expect(improvements.pipelineActive).toBe(true)
  expect(improvements.metrics.totalSuggested).toBeGreaterThanOrEqual(0)
  expect(improvements.metrics.totalDeployed).toBeGreaterThanOrEqual(0)
  expect(improvements.agentContributions.some((agent) => agent.agentId === "devops")).toBe(true)

  const orchestratorResponse = await request.get("/api/openclaw/orchestrator")
  expect(orchestratorResponse.ok()).toBeTruthy()
  const orchestrator = (await orchestratorResponse.json()) as {
    totalAgents: number
    collaborationMap: Array<{ agentId: string; canMessageTo: string[] }>
    orchestrator: { activeTaskCount: number }
  }

  expect(orchestrator.totalAgents).toBeGreaterThanOrEqual(10)
  expect(orchestrator.collaborationMap.some((agent) => agent.agentId === "coordinator")).toBe(true)
  expect(orchestrator.orchestrator.activeTaskCount).toBeGreaterThanOrEqual(0)

  const routeResponse = await request.post("/api/openclaw/orchestrator", {
    data: {
      message: "I need to book a follow-up appointment and understand the copay.",
      walletAddress: "0x0000000000000000000000000000000000000000",
    },
  })
  expect(routeResponse.ok()).toBeTruthy()
  const route = (await routeResponse.json()) as {
    route: { primaryAgent: string; collaborators: string[]; reasoning: string }
    agentCount: number
    walletLinked: boolean
  }

  expect(route.route.primaryAgent).toBe("scheduling")
  expect(route.route.collaborators).toContain("billing")
  expect(route.route.reasoning.length).toBeGreaterThan(0)
  expect(route.agentCount).toBeGreaterThanOrEqual(10)
  expect(route.walletLinked).toBe(true)
})
