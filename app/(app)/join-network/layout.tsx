import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Join the care network | OpenRx",
  description: "Structured credentialing intake for providers, caregivers, labs, and imaging centers joining OpenRx.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
