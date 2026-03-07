import Sidebar from "@/components/layout/sidebar"
import Topbar from "@/components/layout/topbar"
import AgentBar from "@/components/layout/agent-bar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isDatabaseConfigured = Boolean(process.env.DATABASE_URL?.trim())

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "linear-gradient(160deg, #f8fcfa 0%, #f3f8f6 45%, #eef5f2 100%)" }}>
      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-[248px] right-0 h-[400px] bg-[radial-gradient(ellipse_900px_400px_at_70%_-10%,rgba(240,90,61,0.07),transparent_60%)]" />
        <div className="absolute top-0 right-0 h-[300px] w-[400px] bg-[radial-gradient(ellipse_400px_300px_at_100%_0%,rgba(31,169,113,0.08),transparent_65%)]" />
      </div>
      <Sidebar />
      <div className="relative lg:ml-[248px]">
        <AgentBar />
        <Topbar />
        {!isDatabaseConfigured && (
          <div className="mx-auto mt-3 w-full max-w-[1200px] px-4 sm:px-5 lg:px-8">
            <div className="rounded-xl border border-yellow-300/40 bg-yellow-100/20 px-3 py-2 text-xs text-warm-700">
              Live DB is not configured (`DATABASE_URL` missing). OpenRx is running in fallback mode with limited persisted data.
            </div>
          </div>
        )}
        <main className="px-4 pb-10 pt-5 sm:px-5 lg:px-8 lg:pt-6">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
