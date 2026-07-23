import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Care dashboard | OpenRx",
  description: "Your screening, prior-auth, and care-navigation workspace in one place.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
