// ── Agent Orchestrator ──────────────────────────────────────
// Multi-agent collaboration engine. Agents communicate through
// a message bus, delegate tasks, and coordinate responses.

import { OPENCLAW_CONFIG, type AgentId } from "./config"

// ── Types ──────────────────────────────────────────────────

export interface AgentMessage {
  id: string
  fromAgent: AgentId
  toAgent: AgentId | "*"
  type: "request" | "response" | "broadcast" | "delegation" | "escalation"
  content: string
  metadata?: Record<string, unknown>
  timestamp: string
  status: "pending" | "delivered" | "processed" | "failed"
}

export interface AgentTask {
  id: string
  assignedTo: AgentId
  delegatedBy: AgentId | "user"
  description: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "queued" | "in_progress" | "completed" | "failed" | "delegated"
  result?: string
  createdAt: string
  completedAt?: string
  subtasks?: AgentTask[]
}

export interface CollaborationSession {
  id: string
  initiator: AgentId
  participants: AgentId[]
  purpose: string
  messages: AgentMessage[]
  tasks: AgentTask[]
  status: "active" | "completed" | "paused"
  startedAt: string
  endedAt?: string
}

export interface OrchestratorState {
  activeSessions: CollaborationSession[]
  messageLog: AgentMessage[]
  taskQueue: AgentTask[]
  agentStatuses: Record<string, "idle" | "busy" | "waiting">
}

// ── Orchestrator ───────────────────────────────────────────

let state: OrchestratorState = {
  activeSessions: [],
  messageLog: [],
  taskQueue: [],
  agentStatuses: {},
}

// Initialize agent statuses
OPENCLAW_CONFIG.agents.forEach((agent) => {
  state.agentStatuses[agent.id] = "idle"
})

type EventHandler = (msg: AgentMessage) => void
const listeners: Map<string, EventHandler[]> = new Map()

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Subscribe to messages for a specific agent */
export function onAgentMessage(agentId: AgentId | "*", handler: EventHandler): () => void {
  const existing = listeners.get(agentId) || []
  existing.push(handler)
  listeners.set(agentId, existing)
  return () => {
    const handlers = listeners.get(agentId) || []
    listeners.set(agentId, handlers.filter((h) => h !== handler))
  }
}

/** Send a message between agents */
export function sendAgentMessage(params: {
  from: AgentId
  to: AgentId | "*"
  type: AgentMessage["type"]
  content: string
  metadata?: Record<string, unknown>
}): AgentMessage {
  const msg: AgentMessage = {
    id: generateId(),
    fromAgent: params.from,
    toAgent: params.to,
    type: params.type,
    content: params.content,
    metadata: params.metadata,
    timestamp: new Date().toISOString(),
    status: "pending",
  }

  // Validate routing
  const fromAgent = OPENCLAW_CONFIG.agents.find((a) => a.id === params.from)
  if (fromAgent && params.to !== "*") {
    const canMessage = fromAgent.canMessage as readonly string[]
    if (!canMessage.includes("*") && !canMessage.includes(params.to)) {
      msg.status = "failed"
      state.messageLog.push(msg)
      return msg
    }
  }

  // Deliver message
  msg.status = "delivered"
  state.messageLog.push(msg)

  // Notify listeners
  const targetHandlers = listeners.get(params.to) || []
  const broadcastHandlers = listeners.get("*") || []
  ;[...targetHandlers, ...broadcastHandlers].forEach((h) => h(msg))

  return msg
}

/** Create a collaboration session between agents */
export function startCollaboration(params: {
  initiator: AgentId
  participants: AgentId[]
  purpose: string
}): CollaborationSession {
  const session: CollaborationSession = {
    id: generateId(),
    initiator: params.initiator,
    participants: [params.initiator, ...params.participants],
    purpose: params.purpose,
    messages: [],
    tasks: [],
    status: "active",
    startedAt: new Date().toISOString(),
  }

  state.activeSessions.push(session)

  // Notify all participants
  params.participants.forEach((agentId) => {
    sendAgentMessage({
      from: params.initiator,
      to: agentId,
      type: "request",
      content: `Collaboration started: ${params.purpose}`,
      metadata: { sessionId: session.id },
    })
  })

  return session
}

/** Delegate a task to an agent */
export function delegateTask(params: {
  from: AgentId | "user"
  to: AgentId
  description: string
  priority?: AgentTask["priority"]
  sessionId?: string
}): AgentTask {
  const task: AgentTask = {
    id: generateId(),
    assignedTo: params.to,
    delegatedBy: params.from,
    description: params.description,
    priority: params.priority || "medium",
    status: "queued",
    createdAt: new Date().toISOString(),
  }

  state.taskQueue.push(task)
  state.agentStatuses[params.to] = "busy"

  // If part of a session, attach to it
  if (params.sessionId) {
    const session = state.activeSessions.find((s) => s.id === params.sessionId)
    if (session) session.tasks.push(task)
  }

  // Notify the target agent
  if (params.from !== "user") {
    sendAgentMessage({
      from: params.from as AgentId,
      to: params.to,
      type: "delegation",
      content: `Task delegated: ${params.description}`,
      metadata: { taskId: task.id, priority: task.priority },
    })
  }

  return task
}

/** Complete a task and update state */
export function completeTask(taskId: string, result: string): AgentTask | null {
  const task = state.taskQueue.find((t) => t.id === taskId)
  if (!task) return null

  task.status = "completed"
  task.result = result
  task.completedAt = new Date().toISOString()
  state.agentStatuses[task.assignedTo] = "idle"

  // Notify delegator
  if (task.delegatedBy !== "user") {
    sendAgentMessage({
      from: task.assignedTo,
      to: task.delegatedBy as AgentId,
      type: "response",
      content: `Task completed: ${task.description}\nResult: ${result}`,
      metadata: { taskId: task.id },
    })
  }

  return task
}

/** Route a user message to the best agent using Atlas (coordinator) */
export function routeUserMessage(message: string): {
  primaryAgent: AgentId
  collaborators: AgentId[]
  reasoning: string
} {
  const lower = message.toLowerCase()

  // Keyword-based routing (Atlas logic)
  if (lower.includes("appointment") || lower.includes("schedule") || lower.includes("book") || lower.includes("cancel visit")) {
    return {
      primaryAgent: "scheduling",
      collaborators: ["billing"],
      reasoning: "Scheduling request detected. Billing co-assigned for copay estimates.",
    }
  }

  if (
    lower.includes("provider") ||
    lower.includes("caregiver") ||
    lower.includes("care network") ||
    lower.includes("npi") ||
    lower.includes("zip code") ||
    lower.includes("near me") ||
    lower.includes("radiology") ||
    lower.includes("imaging center") ||
    lower.includes("laboratory") ||
    lower.includes("lab near")
  ) {
    return {
      primaryAgent: "scheduling",
      collaborators: ["wellness", "coordinator"],
      reasoning: "Care-network discovery detected. Scheduler coordinates nearby options with wellness context.",
    }
  }

  if (lower.includes("bill") || lower.includes("claim") || lower.includes("charge") || lower.includes("payment") || lower.includes("insurance") || lower.includes("appeal")) {
    return {
      primaryAgent: "billing",
      collaborators: ["prior-auth"],
      reasoning: "Billing inquiry detected. PA agent on standby for denial-related issues.",
    }
  }

  if (lower.includes("prescription") || lower.includes("refill") || lower.includes("medication") || lower.includes("drug") || lower.includes("pharmacy") || lower.includes("adherence")) {
    return {
      primaryAgent: "rx",
      collaborators: ["scheduling"],
      reasoning: "Medication request. Scheduler on standby for lab follow-ups.",
    }
  }

  if (lower.includes("prior auth") || lower.includes("authorization") || lower.includes("denied") || lower.includes("approval")) {
    return {
      primaryAgent: "prior-auth",
      collaborators: ["billing", "coordinator"],
      reasoning: "PA-related query. Billing and coordinator monitoring.",
    }
  }

  if (lower.includes("pain") || lower.includes("fever") || lower.includes("symptom") || lower.includes("sick") || lower.includes("emergency") || lower.includes("chest") || lower.includes("breath")) {
    return {
      primaryAgent: "triage",
      collaborators: ["scheduling", "rx"],
      reasoning: "Symptom report. Triage primary. Scheduler for potential visit, Rx for medication check.",
    }
  }

  if (lower.includes("new patient") || lower.includes("onboard") || lower.includes("register") || lower.includes("sign up") || lower.includes("get started")) {
    return {
      primaryAgent: "onboarding",
      collaborators: ["rx", "scheduling", "wellness"],
      reasoning: "New patient flow. Full team onboarding with medication, scheduling, and wellness.",
    }
  }

  if (
    lower.includes("screening") ||
    lower.includes("risk score") ||
    lower.includes("risk assessment") ||
    lower.includes("preventive screening") ||
    lower.includes("uspstf") ||
    lower.includes("family history") ||
    lower.includes("genetic") ||
    lower.includes("germline") ||
    lower.includes("mutation") ||
    lower.includes("brca") ||
    lower.includes("lynch") ||
    lower.includes("polyposis") ||
    lower.includes("prostate cancer") ||
    lower.includes("colorectal cancer")
  ) {
    return {
      primaryAgent: "screening",
      collaborators: ["wellness", "scheduling"],
      reasoning: "Preventive screening request. Screening agent leads with wellness and scheduling support.",
    }
  }

  if (
    lower.includes("second opinion") ||
    lower.includes("another opinion") ||
    lower.includes("review my diagnosis") ||
    lower.includes("treatment plan review")
  ) {
    return {
      primaryAgent: "second-opinion",
      collaborators: ["triage", "coordinator"],
      reasoning: "Second-opinion request. Clinical review with triage safety monitoring.",
    }
  }

  if (
    lower.includes("clinical trial") ||
    lower.includes("clinical trials") ||
    lower.includes("research study") ||
    lower.includes("trial match")
  ) {
    return {
      primaryAgent: "trials",
      collaborators: ["screening", "billing"],
      reasoning: "Clinical trial matching request. Screening validates fit, billing checks logistics.",
    }
  }

  if (lower.includes("wellness") || lower.includes("preventive") || lower.includes("vaccine") || lower.includes("checkup") || lower.includes("health goal")) {
    return {
      primaryAgent: "wellness",
      collaborators: ["screening", "scheduling"],
      reasoning: "Wellness inquiry with screening and scheduling collaboration.",
    }
  }

  if (lower.includes("deploy") || lower.includes("system") || lower.includes("server") || lower.includes("status") || lower.includes("uptime") || lower.includes("error rate")) {
    return {
      primaryAgent: "devops",
      collaborators: [],
      reasoning: "System/infrastructure query routed to DevOps.",
    }
  }

  // Default: route to coordinator
  return {
    primaryAgent: "coordinator",
    collaborators: [],
    reasoning: "General query — coordinator will assess and route if needed.",
  }
}

/** Get the current orchestrator state */
export function getOrchestratorState(): OrchestratorState {
  return { ...state }
}

/** Get recent inter-agent messages */
export function getRecentMessages(limit = 20): AgentMessage[] {
  return state.messageLog.slice(-limit)
}

/** Get active tasks */
export function getActiveTasks(): AgentTask[] {
  return state.taskQueue.filter((t) => t.status === "queued" || t.status === "in_progress")
}

/** Get collaboration sessions */
export function getActiveSessions(): CollaborationSession[] {
  return state.activeSessions.filter((s) => s.status === "active")
}

/** Reset orchestrator (for testing) */
export function resetOrchestrator(): void {
  state = {
    activeSessions: [],
    messageLog: [],
    taskQueue: [],
    agentStatuses: {},
  }
  OPENCLAW_CONFIG.agents.forEach((agent) => {
    state.agentStatuses[agent.id] = "idle"
  })
}

/** Execute a multi-agent workflow for a user message */
export function executeWorkflow(userMessage: string): {
  route: ReturnType<typeof routeUserMessage>
  session: CollaborationSession | null
  tasks: AgentTask[]
} {
  const route = routeUserMessage(userMessage)

  let session: CollaborationSession | null = null
  const tasks: AgentTask[] = []

  // If collaborators are needed, start a session
  if (route.collaborators.length > 0) {
    session = startCollaboration({
      initiator: route.primaryAgent,
      participants: route.collaborators,
      purpose: `Process user request: "${userMessage.slice(0, 100)}"`,
    })

    // Create primary task
    const primaryTask = delegateTask({
      from: "user",
      to: route.primaryAgent,
      description: `Handle user message: "${userMessage.slice(0, 200)}"`,
      priority: "high",
      sessionId: session.id,
    })
    tasks.push(primaryTask)

    // Create supporting tasks for collaborators
    route.collaborators.forEach((collaborator) => {
      const supportTask = delegateTask({
        from: route.primaryAgent,
        to: collaborator,
        description: `Support ${route.primaryAgent} with: "${userMessage.slice(0, 100)}"`,
        priority: "medium",
        sessionId: session!.id,
      })
      tasks.push(supportTask)
    })
  } else {
    // Single agent, no session needed
    const task = delegateTask({
      from: "user",
      to: route.primaryAgent,
      description: `Handle user message: "${userMessage.slice(0, 200)}"`,
      priority: "high",
    })
    tasks.push(task)
  }

  return { route, session, tasks }
}
