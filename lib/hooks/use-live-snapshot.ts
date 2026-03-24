"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useWalletIdentity } from "@/lib/wallet-context"
import { createEmptyLiveSnapshot, type LivePhysician, type LiveSnapshot } from "@/lib/live-data-types"

interface UseLiveSnapshotResult {
  snapshot: LiveSnapshot
  loading: boolean
  error: string
  refresh: () => Promise<void>
  getPhysician: (id?: string | null) => LivePhysician | undefined
}

export function useLiveSnapshot(): UseLiveSnapshotResult {
  const { walletAddress } = useWalletIdentity()
  const demoWalletAddress = process.env.NEXT_PUBLIC_DEVELOPER_WALLET || undefined
  const activeWalletAddress = walletAddress || demoWalletAddress
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(() => createEmptyLiveSnapshot(activeWalletAddress || null))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams()
      if (activeWalletAddress) params.set("walletAddress", activeWalletAddress)

      const response = await fetch(`/api/live/patient-snapshot?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Failed to load patient snapshot.")
      }

      const payload = (await response.json()) as LiveSnapshot
      setSnapshot(payload)
    } catch (issue) {
      setSnapshot(createEmptyLiveSnapshot(activeWalletAddress || null))
      setError(issue instanceof Error ? issue.message : "Failed to load patient snapshot.")
    } finally {
      setLoading(false)
    }
  }, [activeWalletAddress])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const handleRefresh = () => {
      void load()
    }

    window.addEventListener("openrx:live-refresh", handleRefresh)
    return () => window.removeEventListener("openrx:live-refresh", handleRefresh)
  }, [load])

  const physicianMap = useMemo(() => {
    const map = new Map<string, LivePhysician>()
    snapshot.physicians.forEach((physician) => map.set(physician.id, physician))
    return map
  }, [snapshot.physicians])

  const getPhysician = useCallback(
    (id?: string | null) => (id ? physicianMap.get(id) : undefined),
    [physicianMap]
  )

  return {
    snapshot,
    loading,
    error,
    refresh: load,
    getPhysician,
  }
}
