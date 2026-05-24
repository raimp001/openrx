import type { Metadata } from "next"
import { DenialToAppealDemo } from "@/components/demo/denial-to-appeal-demo"

export const metadata: Metadata = {
  title: "Prior authorization demo | OpenRx",
  description:
    "See a synthetic denial become a source-linked appeal draft and a clearly labeled FHIR prior authorization sandbox trace.",
}

export default function DemoPage() {
  return <DenialToAppealDemo />
}
