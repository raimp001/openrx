import Link from "next/link"
import { ArrowLeft, Compass, Home } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(47,107,255,0.08),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(47,107,255,0.08),transparent_20%),linear-gradient(180deg,#f7faff_0%,#edf4ff_52%,#ffffff_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between">
        <Link href="/" className="inline-flex items-center gap-3 self-start">
          <BrandMark size="sm" />
          <BrandWordmark />
        </Link>

        <div className="surface-hero mx-auto max-w-3xl px-6 py-10 text-center sm:px-10 sm:py-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-[rgba(82,108,139,0.12)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(239,246,255,0.92))] shadow-[0_18px_44px_rgba(8,24,46,0.08)]">
            <Compass size={28} className="text-teal" />
          </div>
          <span className="eyebrow-pill mt-6">Route unavailable</span>
          <h1 className="mt-5 text-[clamp(2.8rem,6vw,4.5rem)] font-serif text-primary">
            This route isn&apos;t available.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-8 text-secondary">
            The page may have moved, expired, or never existed in this environment. The safest way back in is through a
            stable workflow surface like the dashboard or the public home page.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="control-button-primary px-5 py-3">
              <Home size={14} />
              Go to dashboard
            </Link>
            <Link href="/" className="control-button-secondary px-5 py-3">
              <ArrowLeft size={14} />
              Return home
            </Link>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted">
          If you reached this page from a saved bookmark, reopen the flow from the main navigation.
        </p>
      </div>
    </div>
  )
}
