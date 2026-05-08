import Sidebar from "@/components/layout/sidebar"
import Topbar from "@/components/layout/topbar"
import { getDatabaseHealth } from "@/lib/database-health"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const databaseHealth = await getDatabaseHealth()
  const isProduction = process.env.NODE_ENV === "production"
  const showDatabaseBanner = !isProduction && databaseHealth.status !== "connected"

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(103,232,249,0.08),transparent_22%),radial-gradient(circle_at_88%_8%,rgba(59,130,246,0.07),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_24%)]" />
      <div className="relative lg:ml-[var(--openrx-sidebar-width,76px)]">
        <Topbar />
        {showDatabaseBanner && (
          <div className="mx-auto mt-4 w-full max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="surface-card flex items-start gap-3 border-amber-300/30 bg-[linear-gradient(145deg,rgba(35,28,10,0.96),rgba(18,18,20,0.9))] px-4 py-3 text-xs text-primary">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <span>
                {databaseHealth.status === "missing" ? (
                  <>
                    <strong>No database connected</strong> — set <code className="rounded bg-amber-300/10 px-1 font-mono text-amber-100">DATABASE_URL</code> in <code className="rounded bg-amber-300/10 px-1 font-mono text-amber-100">.env.local</code>.
                  </>
                ) : (
                  <>
                    <strong>Database connection needs attention</strong> — OpenRx could not reach Postgres at runtime.
                  </>
                )}
              </span>
            </div>
          </div>
        )}
        <main id="main-content" className="px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pt-5" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
