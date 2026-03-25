import Sidebar from "@/components/layout/sidebar"
import Topbar from "@/components/layout/topbar"
import { getDatabaseHealth } from "@/lib/database-health"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const databaseHealth = await getDatabaseHealth()
  const isProduction = process.env.NODE_ENV === "production"
  const showDatabaseBanner =
    !isProduction && databaseHealth.status !== "connected"

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div className="relative lg:ml-[256px]">
        <Topbar />
        {showDatabaseBanner && (
          <div className="mx-auto mt-3 w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3 rounded-card border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <span>
                {databaseHealth.status === "missing" ? (
                  <>
                    <strong>No database connected</strong> — set <code className="font-mono bg-amber-100 px-1 rounded">DATABASE_URL</code> in <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code>.
                  </>
                ) : (
                  <>
                    <strong>Database connection needs attention</strong> — could not reach Postgres at runtime.
                  </>
                )}
              </span>
            </div>
          </div>
        )}
        <main id="main-content" className="px-4 pb-14 pt-6 sm:px-6 lg:px-8" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
