import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Screening navigation | OpenRx",
  description: "Guideline-grounded cancer screening guidance with source citations, risk-context capture, and nearby care handoffs.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
