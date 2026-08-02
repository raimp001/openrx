import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Screening reservations | OpenRx",
  description:
    "Preview OpenRx's optional screening commitment pilot and track sandbox completion reservations.",
}

export default function CommitmentsLayout({ children }: { children: React.ReactNode }) {
  return children
}
