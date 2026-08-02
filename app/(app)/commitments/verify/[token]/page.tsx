"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react"

interface VerificationResult {
  valid: boolean
  reason?: string
  intendedVerifier?: string
  credential?: {
    commitmentId: string
    completionStatus: "verified"
    broadValidityPeriod: string
    issuerOrganizationId: string
    credentialVersion: "1"
    issuedAt: string
    expiresAt: string
    revocationStatus: "active" | "revoked"
  }
  expiresAt?: string
}

export default function CredentialVerifierPage({ params }: { params: { token: string } }) {
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/commitments/verify/${encodeURIComponent(params.token)}`, { cache: "no-store" })
      .then(async (response) => {
        const value = (await response.json()) as VerificationResult & { error?: { message?: string } }
        if (!response.ok) return { valid: false, reason: value.error?.message || "This private link is unavailable." }
        return value
      })
      .then(setResult)
      .finally(() => setLoading(false))
  }, [params.token])

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-xl items-center px-4 py-10">
      <section className="w-full border-y border-white/10 py-8">
        <p className="flex items-center gap-2 text-xs font-semibold text-teal">
          <ShieldCheck size={15} />
          OpenRx sandbox verifier
        </p>
        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-secondary">
            <Loader2 size={16} className="animate-spin" />
            Verifying private credential...
          </p>
        ) : result?.valid && result.credential ? (
          <>
            <div className="mt-6 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-300" size={24} />
              <h1 className="text-2xl font-semibold text-primary">Valid completion credential</h1>
            </div>
            <p className="mt-3 text-sm leading-6 text-secondary">
              A trusted sandbox issuer signed a generic completion status for {result.intendedVerifier}. This demo
              does not imply insurer acceptance or a premium benefit.
            </p>
            <dl className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-secondary">Status</dt>
                <dd className="font-medium text-primary">Verified</dd>
              </div>
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-secondary">Broad validity</dt>
                <dd className="font-medium text-primary">{result.credential.broadValidityPeriod}</dd>
              </div>
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-secondary">Issuer</dt>
                <dd className="font-medium text-primary">{result.credential.issuerOrganizationId}</dd>
              </div>
              <div className="flex justify-between gap-5 py-3">
                <dt className="text-secondary">Link expires</dt>
                <dd className="font-medium text-primary">
                  {result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "Unknown"}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-xs leading-5 text-muted">
              Not disclosed: patient identity, screening or result, diagnosis, procedure code, provider notes, or
              exact completion date.
            </p>
          </>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <XCircle className="text-red-300" size={24} />
              <h1 className="text-2xl font-semibold text-primary">Credential unavailable</h1>
            </div>
            <p className="mt-3 text-sm leading-6 text-secondary">
              {result?.reason || "This private link is invalid, expired, or revoked."}
            </p>
          </>
        )}
      </section>
    </main>
  )
}
