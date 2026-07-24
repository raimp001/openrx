"use client"

import Link from "next/link"
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet"
import { Identity, Avatar, Name, Address } from "@coinbase/onchainkit/identity"
import { AppPageHeader } from "@/components/layout/app-page"
import { useWalletIdentity } from "@/lib/wallet-context"

export default function LoginPage() {
  const { isConnected, walletAddress, profile } = useWalletIdentity()

  return (
    <div className="animate-slide-up mx-auto max-w-2xl space-y-6">
      <AppPageHeader
        eyebrow="Account"
        title="Sign in to OpenRx"
        description="OpenRx uses wallet-based sign-in. Connect the wallet linked to your care profile to pick up your dashboard, screening history, and messages."
      />

      <section className="surface-card space-y-5 p-6 sm:p-8">
        {isConnected ? (
          <>
            <p className="text-sm leading-6 text-secondary">
              You are signed in{profile?.fullName ? ` as ${profile.fullName}` : ""}
              {walletAddress ? (
                <span className="font-mono text-[12px] text-muted">{` (${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)})`}</span>
              ) : null}
              . Continue to your care workspace:
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-cyan-700 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-cyan-800"
              >
                Open dashboard
              </Link>
              <Link
                href="/profile"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-primary transition hover:bg-white/[0.1]"
              >
                View profile
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-secondary">
              No passwords, no separate account system — your wallet is your sign-in. Connecting only proves control
              of the wallet; it never shares balances or triggers a transaction.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Wallet>
                <ConnectWallet className="rounded-full bg-cyan-700 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-cyan-800" />
                <WalletDropdown>
                  <Identity className="px-4 pb-2 pt-3" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
              <Link href="/signup" className="text-[13px] font-semibold text-cyan-700 underline-offset-4 hover:underline">
                New here? Create an account
              </Link>
            </div>
          </>
        )}
      </section>

      <p className="text-xs leading-5 text-muted">
        OpenRx is clinical decision support, not a diagnosis, medical order, or insurance approval. Never share your
        wallet seed phrase — OpenRx will never ask for it.
      </p>
    </div>
  )
}
