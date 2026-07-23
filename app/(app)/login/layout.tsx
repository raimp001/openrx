import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign in | OpenRx",
  description: "Sign in to OpenRx with your wallet to access your care dashboard, screening history, and messages.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
