import Sidebar from "@/components/layout/sidebar"
import Topbar from "@/components/layout/topbar"
import AgentBar from "@/components/layout/agent-bar"
import { getDatabaseHealth } from "@/lib/database-health"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const databaseHealth = await getDatabaseHealth()
  const showDatabaseBanner = databaseHealth.status !== "connected"

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[34rem] w-full bg-[radial-gradient(ellipse_900px_420px_at_72%_-14%,rgba(224,91,67,0.09),transparent_62%)]" />
        <div className="absolute right-0 top-0 h-[26rem] w-[34rem] bg-[radial-gradient(ellipse_420px_300px_at_100%_0%,rgba(22,142,104,0.11),transparent_66%)]" />
        <div className="absolute bottom-0 left-[18rem] right-0 h-[30rem] bg-[radial-gradient(ellipse_820px_360px_at_50%_100%,rgba(42,124,167,0.05),transparent_60%)]" />
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
