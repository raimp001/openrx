import type { Metadata, Viewport } from "next"
import { Instrument_Serif, Sora } from "next/font/google"
// OnchainKit styles omitted — v1.x uses Tailwind v4 which conflicts with our v3
// Components use internal styling instead
import "./globals.css"
import { Providers } from "./providers"

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400"],
  style: ["normal", "italic"],
})

export const metadata: Metadata = {
  title: "OpenRx — AI Healthcare Agent | Powered by OpenClaw",
  description:
    "AI-powered healthcare clinic management platform. Smart scheduling, billing, prior auth, prescriptions, care coordination, and more.",
  metadataBase: new URL("https://openrx.health"),
  openGraph: {
    title: "OpenRx — AI Healthcare Agent",
    description: "Smart scheduling, billing, prior auth, prescriptions & care coordination.",
    type: "website",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1914",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${instrumentSerif.variable} min-h-screen bg-cream text-warm-800 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
