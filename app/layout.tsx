import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { Inter, Fraunces } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
})

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "OpenRx — Clinical answers, in chat",
  description:
    "Ask a clinical question in plain English. OpenRx answers in chat with guideline-backed sources from USPSTF, CDC, ACS, and NCCN. Decision support — not a substitute for clinician judgment.",
  metadataBase: new URL("https://openrx.health"),
  openGraph: {
    title: "OpenRx — Clinical answers, in chat",
    description:
      "Screening, medication, and preventive-care questions answered directly in chat with guideline links inline.",
    type: "website",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "OpenRx clinical chat workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenRx — Clinical answers, in chat",
    description:
      "Ask a clinical question. Get a complete answer in chat with guideline links — USPSTF, CDC, ACS, NCCN.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F8FAFC",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${GeistMono.variable} ${fraunces.variable} min-h-screen bg-surface text-primary antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
