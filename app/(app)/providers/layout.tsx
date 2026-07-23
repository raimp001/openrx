import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Provider and care directory | OpenRx",
  description: "Search live CMS NPI provider results plus caregiver, lab, and imaging supply for your area.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
