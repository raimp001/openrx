import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create your account | OpenRx",
  description: "Create an OpenRx account with your wallet and complete a short guided care setup.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
