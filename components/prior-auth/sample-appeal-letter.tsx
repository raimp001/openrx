import Link from "next/link"
import { ExternalLink, FileText, ShieldAlert } from "lucide-react"
import { getDemoScenario } from "@/lib/demo/prior-auth"
import { OpsBadge } from "@/components/ui/ops-primitives"

// Public specimen of the appeal draft the prior-auth workflow produces. It is
// rendered from the same synthetic scenario the sandbox uses so the letter on
// this page never drifts from what the agent actually generates.
export function SampleAppealLetter() {
  const scenario = getDemoScenario("teclistamab-rrmm")
  if (!scenario) return null

  return (
    <section aria-labelledby="sample-appeal-heading" className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">What a drafted appeal looks like</div>
          <h2 id="sample-appeal-heading" className="mt-2 text-xl font-serif text-primary">
            Sample appeal letter
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            This is the draft OpenRx prepares from a synthetic denial — every claim is tied to a named source and
            version, and nothing is submitted until a clinician signs off. Your real cases get the same structure with
            your documentation.
          </p>
        </div>
        <OpsBadge tone="gold">Synthetic case · draft only</OpsBadge>
      </div>

      <article className="mt-5 rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3 border-b border-border/60 pb-4">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Subject</div>
            <h3 className="mt-1 text-base font-semibold leading-6 text-primary">{scenario.appealSubject}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted">
              <span className="chip">Denial: {scenario.denialReason}</span>
              <span className="chip">Tracking: {scenario.trackingNumber}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-6 text-primary">
          {scenario.appealParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Evidence cited, with versions</div>
            <ul className="mt-2 space-y-2">
              {scenario.sources.map((source) => (
                <li key={source.id} className="text-sm leading-6 text-primary">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium underline decoration-border underline-offset-2 hover:decoration-primary"
                  >
                    {source.organization}: {source.label}
                    <ExternalLink size={11} aria-hidden />
                  </a>
                  <span className="text-muted"> · {source.version}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Packet checklist</div>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-primary">
              {scenario.documentChecklist.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-soft-red/20 bg-soft-red/5 px-4 py-3 text-sm leading-6 text-soft-red">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Draft only — an authorized clinician must review medical necessity, current guideline access, and payer
            criteria before any real submission. OpenRx cannot guarantee approval.
          </span>
        </div>
      </article>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/demo" className="control-button-secondary">
          Generate this draft live in the sandbox
        </Link>
        <span className="text-muted">The sandbox shows evidence retrieval, the draft, and a simulated FHIR trace.</span>
      </div>
    </section>
  )
}
