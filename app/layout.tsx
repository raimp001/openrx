import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { Fraunces, Sora } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const sora = Sora({
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
  title: "OpenRx - Preventive screening, start to finish",
  description:
    "OpenRx helps patients understand which preventive screening is due, find the next real-world step, and keep follow-up from getting lost.",
  metadataBase: new URL("https://openrx.health"),
  openGraph: {
    title: "OpenRx - Preventive screening, start to finish",
    description: "Check what screening is due, find a realistic care path, and track follow-up in one guided flow.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OpenRx - Preventive screening, start to finish",
    description: "A calmer way to move preventive screening from reminder to follow-up.",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7FAFF",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${GeistMono.variable} ${fraunces.variable} min-h-screen bg-surface text-primary antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
