"use client"

import { useEffect, useState } from "react"
import { readWorkflowEvents, type WorkflowEvent } from "@/lib/product-analytics"

export function AnalyticsDebugPanel() {
  const [events, setEvents] = useState<WorkflowEvent[]>([])

  useEffect(() => {
    const refresh = () => setEvents(readWorkflowEvents(window.localStorage).slice(-10).reverse())
    refresh()
    window.addEventListener("openrx:workflow-event", refresh)
    return () => window.removeEventListener("openrx:workflow-event", refresh)
  }, [])

  if (process.env.NODE_ENV !== "development") return null

  return (
    <details className="fixed bottom-3 right-3 z-50 max-w-[320px] rounded-xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-600 shadow-soft-card">
      <summary className="cursor-pointer font-semibold text-zinc-900">Analytics debug ({events.length})</summary>
      <p className="mt-2 text-zinc-500">Events only. No prompt, name, contact, insurance, or address fields.</p>
      <ul className="mt-2 space-y-1">
        {events.map((event) => <li key={`${event.at}-${event.name}`} className="text-zinc-600">{event.name} · {new Date(event.at).toLocaleTimeString()}</li>)}
      </ul>
    </details>
  )
}
