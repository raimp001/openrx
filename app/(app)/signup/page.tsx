"use client"

import Link from "next/link"
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet"
import { Identity, Avatar, Name, Address } from "@coinbase/onchainkit/identity"
import { AppPageHeader } from "@/components/layout/app-page"
import { useWalletIdentity } from "@/lib/wallet-context"

const steps = [
  "Connect a wallet — this becomes your sign-in, with no password to manage.",
  "Answer a short guided setup (doctors, pharmacy, medications, screening context). Every step is skippable.",
  "Land on your care dashboard with screening guidance and next actions.",
]

export default function SignupPage() {
  const { isConnected } = useWalletIdentity()

  return (
    <div className="animate-slide-up mx-auto max-w-2xl space-y-6">
      <AppPageHeader
        eyebrow="Get started"
        title="Create your OpenRx account"
        description="Two minutes of setup turns OpenRx into a personalized screening and care-navigation workspace."
      />

      <section className="surface-card space-y-5 p-6 sm:p-8">
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-[11px] font-bold text-black">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-secondary">{step}</p>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          {isConnected ? (
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-full bg-cyan-300 px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-cyan-200"
            >
              Continue to guided setup
            </Link>
          ) : (
            <Wallet>
              <ConnectWallet className="rounded-full bg-cyan-300 px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-cyan-200" />
              <WalletDropdown>
                <Identity className="px-4 pb-2 pt-3" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          )}
          <Link href="/login" className="text-[13px] font-semibold text-cyan-200 underline-offset-4 hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </section>

      <p className="text-xs leading-5 text-muted">
        Prefer to look around first? <Link href="/screening" className="text-cyan-200 underline-offset-4 hover:underline">Try the screening navigator</Link> or{" "}
        <Link href="/chat" className="text-cyan-200 underline-offset-4 hover:underline">ask a question in chat</Link> — no account required.
      </p>
    </div>
  )
}
