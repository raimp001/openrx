"use client"

import { type ReactNode, useState } from "react"
import { OnchainKitProvider } from "@coinbase/onchainkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type State, WagmiProvider } from "wagmi"
import { getConfig } from "@/lib/wagmi"
import { getBaseBuilderChain } from "@/lib/basebuilder/config"
import { WalletIdentityProvider } from "@/lib/wallet-context"

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [config] = useState(() => getConfig())
  const [chain] = useState(() => getBaseBuilderChain())
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          chain={chain}
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          config={{
            paymaster:
              chain.id === 84_532
                ? process.env.NEXT_PUBLIC_COMMITMENT_PAYMASTER_URL
                : process.env.NEXT_PUBLIC_CDP_PAYMASTER_URL ||
                  process.env.NEXT_PUBLIC_ONCHAINKIT_PAYMASTER_URL,
            appearance: {
              mode: "dark",
              theme: "base",
            },
          }}
        >
          <WalletIdentityProvider>
            {children}
          </WalletIdentityProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
