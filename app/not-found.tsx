import Link from "next/link"
import { ArrowLeft, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-teal/10 to-teal/5 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold text-teal font-serif">404</span>
        </div>
        <h1 className="text-2xl font-serif text-primary">Page not found</h1>
        <p className="text-sm text-muted mt-3 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Link href="/dashboard" className="control-button-primary">
            <Home size={14} />
            Dashboard
          </Link>
          <Link href="/" className="control-button-secondary">
            <ArrowLeft size={14} />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
