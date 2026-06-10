import type { Metadata } from "next"
import Link from "next/link"
import { DenialToAppealDemo } from "@/components/demo/denial-to-appeal-demo"
import { DEMO_WALKTHROUGH_CASES } from "@/lib/demo/cases"

export const metadata: Metadata = {
  title: "Prior authorization demo | OpenRx",
  description:
    "See a synthetic denial become a source-linked appeal draft and a clearly labeled FHIR prior authorization sandbox trace.",
}

export default function DemoPage() {
  return (
    <>
      <DenialToAppealDemo />
      <section
        aria-labelledby="walkthrough-heading"
        className="mx-auto w-full max-w-[1100px] px-5 pb-16 sm:px-8"
      >
        <h2 id="walkthrough-heading" className="section-title">
          Guided walkthrough — what the engine is doing
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {DEMO_WALKTHROUGH_CASES.map((demoCase) => (
            <li key={demoCase.id} className="surface-card flex flex-col p-5" data-testid={`demo-case-${demoCase.id}`}>
              <h3 className="font-serif text-[18px] font-medium leading-snug text-primary">{demoCase.title}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{demoCase.caption}</p>
              <Link
                href={`/chat?prompt=${encodeURIComponent(demoCase.prompt)}&topic=${demoCase.agentId}&autorun=1`}
                className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent transition hover:text-accent-light"
              >
                Run this case in chat →
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-[72ch] text-[12px] leading-relaxed text-subtle">
          Every case is synthetic and resolves on a deterministic path — scenario engine, guideline
          engine, or safety routing — so the walkthrough completes even when the model API is
          unavailable. Recommendations carry source, grade, and version stamps; sandbox actions are
          logged with audit rows.
        </p>
      </section>
    </>
  )
}
