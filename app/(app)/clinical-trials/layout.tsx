import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Clinical trials | OpenRx",
  description: "Search clinical trial options with eligibility context and navigator handoff.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
