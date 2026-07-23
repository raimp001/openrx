import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Clinical chat | OpenRx",
  description: "Ask screening and care-navigation questions and get source-linked answers with clarifying questions.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
