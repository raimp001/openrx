import Sidebar from "@/components/layout/sidebar"
import Topbar from "@/components/layout/topbar"
import AgentBar from "@/components/layout/agent-bar"
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
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[34rem] w-full bg-[radial-gradient(ellipse_860px_360px_at_70%_-10%,rgba(224,91,67,0.06),transparent_64%)]" />
        <div className="absolute left-0 top-0 h-full w-[272px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,241,231,0.34))]" />
        <div className="absolute left-[272px] top-0 hidden h-full w-px bg-[linear-gradient(180deg,rgba(216,208,194,0.1),rgba(216,208,194,0.7),rgba(216,208,194,0.1))] lg:block" />
      </div>
      <Sidebar />
      <div className="relative lg:ml-[272px]">
        <AgentBar />
        <Topbar />
        {showDatabaseBanner && (
          <div className="mx-auto mt-4 w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3 rounded-[22px] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,247,217,0.84))] px-4 py-3 text-xs text-amber-900 shadow-soft-card">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <span>
                {databaseHealth.status === "missing" ? (
                  <>
                    <strong>No database connected</strong> — set <code className="font-mono bg-amber-100 px-1 rounded">DATABASE_URL</code> in <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code> for local use, or run <code className="font-mono bg-amber-100 px-1 rounded">npx vercel env add DATABASE_URL production</code> and then <code className="font-mono bg-amber-100 px-1 rounded">npm run db:push</code> for the deployed app. Currently showing empty states.
                  </>
                ) : (
                  <>
                    <strong>Database connection needs attention</strong> — OpenRx has a configured <code className="font-mono bg-amber-100 px-1 rounded">DATABASE_URL</code> but could not reach Postgres at runtime. Live records and durable ledger features will fall back until connectivity is restored.
                  </>
                )}
              </span>
            </div>
          </div>
        )}
        <main id="main-content" className="px-4 pb-14 pt-5 sm:px-6 lg:px-8 lg:pt-7" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
