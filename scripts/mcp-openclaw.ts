#!/usr/bin/env npx tsx
/**
 * OpenClaw MCP Server
 *
 * Exposes the 12 OpenRx agents as MCP tools so Claude Code can chat
 * with them, route messages, fan-out to parallel experts, and inspect
 * the orchestrator state — all while the Next.js dev server is running.
 *
 * Usage:
 *   npm run dev          # start Next.js on http://localhost:3000
 *   # Claude Code picks this up automatically via .mcp.json
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

const BASE_URL = process.env.OPENCLAW_BASE_URL || "http://localhost:3000"
const MCP_AUTH_TOKEN = process.env.OPENCLAW_MCP_TOKEN || ""

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (MCP_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${MCP_AUTH_TOKEN}`
  }
  return headers
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // Sanitize error — don't leak full response body to external consumers
    const status = res.status
    const statusText = res.statusText
    throw new Error(`OpenClaw ${path} failed (${status} ${statusText})`)
  }
  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })
  if (!res.ok) {
    const status = res.status
    const statusText = res.statusText
    throw new Error(`OpenClaw ${path} failed (${status} ${statusText})`)
  }
  return res.json() as Promise<T>
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "openclaw", version: "1.0.0" },
  { capabilities: { tools: {} } }
)

// ── Tool list ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "openclaw_chat",
      description:
        "Send a message to a specific OpenClaw agent (Sage, Atlas, Nova, Cal, Vera, Maya, Rex, Ivy, Quinn, Orion, Lyra, or Bolt) and get their response. " +
        "Agent IDs: onboarding, coordinator, triage, scheduling, billing, rx, prior-auth, wellness, screening, second-opinion, trials, devops",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description:
              "The agent to message. One of: onboarding, coordinator, triage, scheduling, billing, rx, prior-auth, wellness, screening, second-opinion, trials, devops",
          },
          message: { type: "string", description: "The message to send" },
          sessionId: {
            type: "string",
            description: "Optional session ID for conversation continuity",
          },
          walletAddress: {
            type: "string",
            description: "Optional wallet address to load patient context",
          },
        },
        required: ["agentId", "message"],
      },
    },
    {
      name: "openclaw_route",
      description:
        "Send a message through the orchestrator (Atlas). Atlas will route to the best specialist agent and optionally hand off. " +
        "Use this when you don't know which agent to use — Atlas decides.",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "The user message to route" },
          sessionId: { type: "string", description: "Optional session ID" },
          walletAddress: { type: "string", description: "Optional wallet address" },
        },
        required: ["message"],
      },
    },
    {
      name: "openclaw_experts",
      description:
        "Fan out a message to multiple OpenClaw agents simultaneously (MoE-style parallel execution). " +
        "All agents receive the same message and respond in parallel. Patient context is fetched once and shared.",
      inputSchema: {
        type: "object",
        properties: {
          expertIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of agent IDs to fan out to",
          },
          message: { type: "string", description: "The message to send to all experts" },
          sessionId: { type: "string", description: "Optional session ID" },
          walletAddress: { type: "string", description: "Optional wallet address" },
        },
        required: ["expertIds", "message"],
      },
    },
    {
      name: "openclaw_status",
      description:
        "Get the OpenClaw gateway health status and the most recent agent actions/activity log.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "openclaw_orchestrator",
      description:
        "Get the current orchestrator state: active collaboration sessions, task queue, and all 12 agent statuses (idle/busy/waiting).",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "openclaw_improvements",
      description:
        "Get the self-improvement pipeline metrics: pending suggestions, votes, approved improvements, and Bolt's deployment queue.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ],
}))

// ── Tool execution ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case "openclaw_chat": {
        const result = await post<{ response: string; agentId: string; handoff?: string }>(
          "/api/openclaw/chat",
          args
        )
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }

      case "openclaw_route": {
        const result = await post<{ response: string; agentId: string; handoff?: string }>(
          "/api/openclaw/orchestrator",
          args
        )
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        }
      }

      case "openclaw_experts": {
        const result = await post<{ agentId: string; response: string }[]>(
          "/api/openclaw/experts",
          args
        )
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        }
      }

      case "openclaw_status": {
        const result = await get<unknown>("/api/openclaw/status")
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        }
      }

      case "openclaw_orchestrator": {
        const result = await get<unknown>("/api/openclaw/orchestrator")
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        }
      }

      case "openclaw_improvements": {
        const result = await get<unknown>("/api/openclaw/improvements")
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [
        {
          type: "text",
          text: `Error calling ${name}: ${message}\n\nMake sure the Next.js dev server is running: npm run dev`,
        },
      ],
      isError: true,
    }
  }
})

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write(`OpenClaw MCP server running — connected to ${BASE_URL}\n`)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`)
  process.exit(1)
})
