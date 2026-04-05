import Sidebar from "@/components/layout/sidebar"
import Topbar from "@/components/layout/topbar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div className="relative lg:ml-[256px]">
        <Topbar />
        <main id="main-content" className="px-4 pb-14 pt-16 sm:px-6 lg:px-8 lg:pt-6" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
