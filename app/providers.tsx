"use client"

import { type ReactNode, useState } from "react"
import { OnchainKitProvider } from "@coinbase/onchainkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type State, WagmiProvider } from "wagmi"
import { base } from "wagmi/chains"
import { getConfig } from "@/lib/wagmi"
import { WalletIdentityProvider } from "@/lib/wallet-context"

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [config] = useState(() => getConfig())
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          chain={base}
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          config={{
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
