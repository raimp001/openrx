"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface CareTeamSessionResponse {
  role: "admin" | "staff" | "service" | "patient"
  userId: string
  canAccessCareTeam: boolean
  authSource: string
  needsInputCount: number
}

interface Options {
  pollMs?: number
  autoStart?: boolean
}

export function useCareTeamSession(options: Options = {}) {
  const pollMs = options.pollMs ?? 15000
  const autoStart = options.autoStart !== false

  const [session, setSession] = useState<CareTeamSessionResponse | null>(null)
  const [loading, setLoading] = useState(autoStart)
  const [error, setError] = useState("")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/agent-notify/session", { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to load care-team session.")
      const data = (await response.json()) as CareTeamSessionResponse
      setSession(data)
      setError("")
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to load care-team session.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoStart) return
    void load()
    timerRef.current = setInterval(() => {
      void load()
    }, pollMs)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [autoStart, load, pollMs])

  return {
    session,
    loading,
    error,
    refresh: load,
  }
}
