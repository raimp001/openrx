// ── Care automation gateway client ─────────────────────────
// Typed client for communicating with the care automation gateway
// from the Next.js application layer.

import { OPENCLAW_CONFIG, type AgentId } from "./config"

interface GatewayMessage {
  role: "user" | "assistant" | "system"
  content: string
  agentId?: AgentId
  channel?: string
  metadata?: Record<string, unknown>
}

interface GatewaySession {
  id: string
  agentId: AgentId
  channel: string
  patientId?: string
  startedAt: string
  lastActivity: string
  messageCount: number
  status: "active" | "idle" | "closed"
}

interface AgentAction {
  id: string
  agentId: AgentId
  type: "message_sent" | "appointment_booked" | "claim_filed" | "pa_submitted" | "refill_requested" | "alert_created" | "reminder_sent" | "escalation"
  description: string
  patientId?: string
  channel?: string
  timestamp: string
  status: "completed" | "pending" | "failed"
  metadata?: Record<string, unknown>
}

interface CronJobStatus {
  id: string
  lastRun: string | null
  nextRun: string
  status: "active" | "paused" | "error"
  lastResult?: string
}

// ── Gateway Connection ───────────────────────────────────

class OpenClawClient {
  private gatewayUrl: string
  private token: string
  constructor() {
    this.gatewayUrl = OPENCLAW_CONFIG.gateway.url
    this.token = OPENCLAW_CONFIG.gateway.token
  }

  // Check if gateway is reachable
  async isConnected(): Promise<boolean> {
    try {
      const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
      const res = await fetch(`${httpUrl}/health`, {
        signal: AbortSignal.timeout(3000),
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      })
      return res.ok
    } catch {
      return false
    }
  }

  // Send a message to a specific agent
  async sendMessage(params: {
    agentId: AgentId
    message: string
    sessionId?: string
    patientId?: string
    channel?: string
  }): Promise<{ sessionId: string; response: string }> {
    const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
    const res = await fetch(`${httpUrl}/api/sessions/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({
        agentId: params.agentId,
        message: params.message,
        sessionKey: params.sessionId || "main",
        metadata: {
          patientId: params.patientId,
          channel: params.channel || "portal",
          source: "openrx-app",
        },
      }),
    })

    if (!res.ok) throw new Error(`Gateway error: ${res.statusText}`)
    return res.json()
  }

  // List active sessions
  async listSessions(params?: {
    agentId?: AgentId
    activeMinutes?: number
  }): Promise<GatewaySession[]> {
    const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
    const searchParams = new URLSearchParams()
    if (params?.agentId) searchParams.set("agentId", params.agentId)
    if (params?.activeMinutes) searchParams.set("activeMinutes", String(params.activeMinutes))

    const res = await fetch(`${httpUrl}/api/sessions?${searchParams}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    })
    if (!res.ok) throw new Error(`Gateway error: ${res.statusText}`)
    return res.json()
  }

  // Get session history
  async getSessionHistory(sessionId: string, limit = 50): Promise<GatewayMessage[]> {
    const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
    const res = await fetch(`${httpUrl}/api/sessions/${sessionId}/history?limit=${limit}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    })
    if (!res.ok) throw new Error(`Gateway error: ${res.statusText}`)
    return res.json()
  }

  // Get recent agent actions (for activity feed)
  async getRecentActions(limit = 20): Promise<AgentAction[]> {
    const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
    const res = await fetch(`${httpUrl}/api/actions?limit=${limit}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    })
    if (!res.ok) throw new Error(`Gateway error: ${res.statusText}`)
    return res.json()
  }

  // Get cron job statuses
  async getCronStatus(): Promise<CronJobStatus[]> {
    const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
    const res = await fetch(`${httpUrl}/api/cron/status`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    })
    if (!res.ok) throw new Error(`Gateway error: ${res.statusText}`)
    return res.json()
  }

  // Trigger a specific agent action
  async triggerAction(params: {
    agentId: AgentId
    action: string
    data: Record<string, unknown>
  }): Promise<{ actionId: string; status: string }> {
    const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
    const res = await fetch(`${httpUrl}/api/actions/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error(`Gateway error: ${res.statusText}`)
    return res.json()
  }

  // Send message via specific channel (WhatsApp, SMS, etc.)
  async sendChannelMessage(params: {
    channel: string
    target: string // phone number, chat ID, etc.
    message: string
    media?: string // file path or URL
  }): Promise<{ messageId: string }> {
    const httpUrl = this.gatewayUrl.replace("ws://", "http://").replace("wss://", "https://")
    const res = await fetch(`${httpUrl}/api/message/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error(`Gateway error: ${res.statusText}`)
    return res.json()
  }
}

// Singleton instance
export const openclawClient = new OpenClawClient()

// Export types
export type { GatewayMessage, GatewaySession, AgentAction, CronJobStatus }
