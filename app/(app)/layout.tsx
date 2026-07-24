import Sidebar from "@/components/layout/sidebar"
import Topbar from "@/components/layout/topbar"
import { AnalyticsDebugPanel } from "@/components/analytics-debug-panel"
import { getDatabaseHealth } from "@/lib/database-health"
import { Providers } from "@/app/providers"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const databaseHealth = await getDatabaseHealth()
  const isProduction = process.env.NODE_ENV === "production"
  const showDatabaseBanner = !isProduction && databaseHealth.status !== "connected"

  return (
    <Providers>
    <div data-openrx-app-shell className="relative min-h-screen overflow-x-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div className="relative lg:ml-[var(--openrx-sidebar-width,76px)]">
        <Topbar />
        {showDatabaseBanner && (
          <div className="mx-auto mt-4 w-full max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="surface-card flex items-start gap-3 border-amber-200 bg-amber-50 px-4 py-3 text-xs text-primary">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <span>
                {databaseHealth.status === "missing" ? (
                  <>
                    <strong>No database connected</strong> — set <code className="rounded bg-amber-100 px-1 font-mono text-amber-800">DATABASE_URL</code> in <code className="rounded bg-amber-100 px-1 font-mono text-amber-800">.env.local</code>.
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
      <AnalyticsDebugPanel />
    </div>
    </Providers>
  )
}
