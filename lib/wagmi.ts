import { http, cookieStorage, createConfig, createStorage } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { coinbaseWallet } from "wagmi/connectors"

export function getConfig() {
  const chain =
    process.env.NEXT_PUBLIC_BASEBUILDER_NETWORK === "base-sepolia" ? baseSepolia : base
  return createConfig({
    chains: [chain],
    connectors: [
      coinbaseWallet({
        appName: "OpenRx",
        preference: "smartWalletOnly",
        version: "4",
      }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http(),
    },
  })
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
