"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  CareTeamAgent,
  CareTeamCustomAgentInput,
  CareTeamEvent,
  CareTeamHumanInputRequest,
  CareTeamResolveInput,
  CareTeamStateSnapshot,
} from "@/lib/care-team/types"

interface SnapshotResponse {
  snapshot: CareTeamStateSnapshot
}

function mergeAgent(existing: CareTeamAgent[], incoming: CareTeamAgent): CareTeamAgent[] {
  const index = existing.findIndex((agent) => agent.id === incoming.id)
  if (index === -1) return [...existing, incoming]
  const next = [...existing]
  next[index] = incoming
  return next
}

function mergeRequest(
  existing: CareTeamHumanInputRequest[],
  incoming: CareTeamHumanInputRequest,
  openOnly = true
): CareTeamHumanInputRequest[] {
  const filtered = openOnly ? existing.filter((request) => request.status === "needs_input") : existing
  const index = filtered.findIndex((request) => request.id === incoming.id)
  if (index === -1) {
    if (incoming.status !== "needs_input" && openOnly) return filtered
    return [incoming, ...filtered]
  }

  const next = [...filtered]
  if (incoming.status !== "needs_input" && openOnly) {
    next.splice(index, 1)
    return next
  }
  next[index] = incoming
  return next
}

export function useCareTeamCommandCenter() {
  const [agents, setAgents] = useState<CareTeamAgent[]>([])
  const [openRequests, setOpenRequests] = useState<CareTeamHumanInputRequest[]>([])
  const [recentAuditHashes, setRecentAuditHashes] = useState<string[]>([])
  const [needsInputCount, setNeedsInputCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [connected, setConnected] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/agent-notify", { cache: "no-store" })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error || "Failed to load care-team snapshot.")
      }

      const data = (await response.json()) as SnapshotResponse
      const snapshot = data.snapshot
      setAgents(snapshot.agents)
      setOpenRequests(snapshot.openRequests)
      setRecentAuditHashes(snapshot.recentAudit.map((item) => item.id))
      setNeedsInputCount(snapshot.needsInputCount)
      setError("")
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to load care-team snapshot.")
    } finally {
      setLoading(false)
    }
  }, [])

  const applyEvent = useCallback((event: CareTeamEvent) => {
    if (event.payload.agent) {
      setAgents((current) => mergeAgent(current, event.payload.agent as CareTeamAgent))
    }
    if (event.payload.request) {
      setOpenRequests((current) => mergeRequest(current, event.payload.request as CareTeamHumanInputRequest, true))
    }
    setNeedsInputCount(event.payload.needsInputCount)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const source = new EventSource("/api/agent-notify/stream")
    eventSourceRef.current = source

    source.addEventListener("open", () => {
      setConnected(true)
      setError("")
    })

    source.addEventListener("care_team", (raw) => {
      try {
        const message = raw as MessageEvent<string>
        const parsed = JSON.parse(message.data) as
          | { type: "bootstrap"; snapshot: CareTeamStateSnapshot }
          | CareTeamEvent

        if ("type" in parsed && parsed.type === "bootstrap") {
          setAgents(parsed.snapshot.agents)
          setOpenRequests(parsed.snapshot.openRequests)
          setNeedsInputCount(parsed.snapshot.needsInputCount)
          setRecentAuditHashes(parsed.snapshot.recentAudit.map((item) => item.id))
          setLoading(false)
          return
        }

        applyEvent(parsed as CareTeamEvent)
      } catch {
        // ignore malformed events
      }
    })

    source.onerror = () => {
      setConnected(false)
    }

    return () => {
      source.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }, [applyEvent])

  useEffect(() => {
    const poll = setInterval(() => {
      if (connected) return
      void refresh()
    }, 15000)
    return () => clearInterval(poll)
  }, [connected, refresh])

  const resolveRequest = useCallback(async (payload: CareTeamResolveInput) => {
    const response = await fetch("/api/agent-notify/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      request?: CareTeamHumanInputRequest
      agent?: CareTeamAgent
      event?: CareTeamEvent
    }

    if (!response.ok || data.error) {
      throw new Error(data.error || "Failed to resolve request.")
    }

    if (data.event) {
      applyEvent(data.event)
    } else {
      const request = data.request
      if (request) {
        setOpenRequests((current) => mergeRequest(current, request, true))
      }
      if (data.agent) {
        setAgents((current) => mergeAgent(current, data.agent as CareTeamAgent))
      }
    }
  }, [applyEvent])

  const createCustomAgent = useCallback(async (payload: CareTeamCustomAgentInput) => {
    const response = await fetch("/api/agent-notify/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      agent?: CareTeamAgent
      event?: CareTeamEvent
    }

    if (!response.ok || data.error) {
      throw new Error(data.error || "Failed to create custom agent.")
    }

    if (data.event) {
      applyEvent(data.event)
    } else if (data.agent) {
      setAgents((current) => mergeAgent(current, data.agent as CareTeamAgent))
    }
  }, [applyEvent])

  const triggerDemo = useCallback(async () => {
    const response = await fetch("/api/agent-notify/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(payload.error || "Failed to trigger demo.")
    }
  }, [])

  const requestsByAgent = useMemo(() => {
    return openRequests.reduce<Record<string, CareTeamHumanInputRequest[]>>((acc, request) => {
      acc[request.agentId] = acc[request.agentId] || []
      acc[request.agentId].push(request)
      return acc
    }, {})
  }, [openRequests])

  return {
    agents,
    openRequests,
    requestsByAgent,
    recentAuditHashes,
    needsInputCount,
    loading,
    error,
    connected,
    refresh,
    resolveRequest,
    createCustomAgent,
    triggerDemo,
  }
}
