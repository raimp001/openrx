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
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-soft-red/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-soft-red" />
        </div>
        <h2 className="text-xl font-serif text-primary">
          Something went wrong
        </h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-teal text-white text-sm font-semibold rounded-xl hover:bg-teal-dark transition flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-surface text-primary text-sm font-semibold rounded-xl border border-border hover:border-teal/30 transition flex items-center gap-2"
          >
            <Home size={14} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
