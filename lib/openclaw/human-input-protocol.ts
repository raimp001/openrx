import type { CareTeamDecision, CareTeamWorkflow } from "@/lib/care-team/types"

export interface HumanInputToolContext {
  patient_id_hash: string
  workflow: CareTeamWorkflow
  reason: string
  suggested_action: string
  confidence_score?: number
  document_snapshot_hash?: string
  browser_url?: string
  highlight_selector?: string
  browser_note?: string
}

export interface HumanInputToolResult {
  request_id: string
  status: "needs_input"
  queued_at: string
}

export interface HumanDecisionResult {
  resolved: boolean
  decision?: CareTeamDecision
  note?: string
  edited_suggested_action?: string
}

export const REQUEST_HUMAN_INPUT_TOOL_SCHEMA = {
  name: "request_human_input",
  description:
    "Pause agent execution and request explicit human approval for sensitive clinical/financial workflow steps.",
  input_schema: {
    type: "object",
    properties: {
      patient_id_hash: {
        type: "string",
        description: "SHA-256 hash only. Never send raw patient identifiers.",
      },
      workflow: {
        type: "string",
        enum: ["prior_auth", "billing", "rx", "scheduling", "triage", "compliance", "onboarding", "coordination", "general"],
      },
      reason: { type: "string", maxLength: 240 },
      suggested_action: { type: "string", maxLength: 240 },
      confidence_score: { type: "number", minimum: 0, maximum: 1 },
      document_snapshot_hash: { type: "string" },
      browser_url: { type: "string" },
      highlight_selector: { type: "string" },
      browser_note: { type: "string" },
    },
    required: ["patient_id_hash", "workflow", "reason", "suggested_action"],
    additionalProperties: false,
  },
} as const

export async function requestHumanInput(params: {
  commandCenterBaseUrl: string
  agentId: string
  agentName: string
  context: HumanInputToolContext
  serviceToken?: string
}): Promise<HumanInputToolResult> {
  const response = await fetch(`${params.commandCenterBaseUrl}/api/agent-notify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(params.serviceToken ? { authorization: `Bearer ${params.serviceToken}` } : {}),
    },
    body: JSON.stringify({
      agent_id: params.agentId,
      agent_name: params.agentName,
      status: "needs_input",
      context: params.context,
      timestamp: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error || "Failed to request human input.")
  }

  const payload = (await response.json()) as {
    request?: { id: string; status: "needs_input"; createdAt: string }
  }

  if (!payload.request) {
    throw new Error("Missing request payload from care automation console.")
  }

  return {
    request_id: payload.request.id,
    status: payload.request.status,
    queued_at: payload.request.createdAt,
  }
}

export async function awaitHumanDecision(params: {
  commandCenterBaseUrl: string
  requestId: string
  timeoutMs?: number
  pollMs?: number
  serviceToken?: string
}): Promise<HumanDecisionResult> {
  const timeout = params.timeoutMs ?? 15 * 60 * 1000
  const pollMs = params.pollMs ?? 5000
  const started = Date.now()

  while (Date.now() - started < timeout) {
    const response = await fetch(
      `${params.commandCenterBaseUrl}/api/agent-notify/fallback?requestId=${encodeURIComponent(params.requestId)}`,
      {
        headers: {
          ...(params.serviceToken ? { authorization: `Bearer ${params.serviceToken}` } : {}),
        },
      }
    )

    if (response.ok) {
      const payload = (await response.json()) as {
        request?: {
          id: string
          status: "needs_input" | "resolved"
          resolution?: CareTeamDecision
          resolutionNote?: string
          context?: { suggestedAction?: string }
        }
      }

      if (payload.request?.status === "resolved") {
        return {
          resolved: true,
          decision: payload.request.resolution,
          note: payload.request.resolutionNote,
          edited_suggested_action: payload.request.context?.suggestedAction,
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  return { resolved: false }
}

export function requiresHumanApproval(params: {
  workflow: CareTeamWorkflow
  actionType: "submit" | "override" | "appeal" | "dispense" | "modify"
}): boolean {
  const sensitiveWorkflows = new Set<CareTeamWorkflow>(["prior_auth", "billing", "rx", "compliance", "triage"])
  if (!sensitiveWorkflows.has(params.workflow)) return false

  return ["submit", "override", "appeal", "dispense", "modify"].includes(params.actionType)
}

export function assertHumanDecision(params: {
  decision?: CareTeamDecision
  workflow: CareTeamWorkflow
  actionSummary: string
}): void {
  if (!params.decision || params.decision !== "approve") {
    throw new Error(`Blocked sensitive ${params.workflow} action until explicit human approval: ${params.actionSummary}`)
  }
}
