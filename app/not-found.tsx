import Link from "next/link"
import { ArrowLeft, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal/10 to-teal/5 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold text-teal font-serif">404</span>
        </div>
        <h1 className="text-2xl font-serif text-primary">Page not found</h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-teal text-white text-sm font-semibold rounded-xl hover:bg-teal-dark transition flex items-center gap-2"
          >
            <Home size={14} />
            Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 bg-surface text-primary text-sm font-semibold rounded-xl border border-border hover:border-teal/30 transition flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
