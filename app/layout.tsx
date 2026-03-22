import type { Metadata, Viewport } from "next"
// OnchainKit styles omitted — v1.x uses Tailwind v4 which conflicts with our v3
// Components use internal styling instead
import "./globals.css"
import { Providers } from "./providers"

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Sora:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-cream text-warm-800 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
