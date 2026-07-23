import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Prior authorization | OpenRx",
  description: "Source-linked prior authorization workflow infrastructure with evidence-backed appeal drafting.",
}

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
