"use client"

import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="surface-hero w-full max-w-2xl overflow-hidden px-6 py-8 text-center sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-soft-red/10 text-soft-red">
          <AlertTriangle size={28} />
        </div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">OpenRx recovery</p>
        <h2 className="mt-3 font-serif text-[2.2rem] leading-tight text-primary">This page stalled before it finished loading.</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-secondary">
          {error.message || "An unexpected error occurred. Retry first. If it persists, go back to the dashboard and re-enter the workflow from a stable page."}
        </p>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-muted">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="control-button-primary"
          >
            <RefreshCw size={14} />
            Retry page
          </button>
          <Link
            href="/dashboard"
            className="control-button-secondary"
          >
            <Home size={14} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
