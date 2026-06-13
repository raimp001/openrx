import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "OpenRx | Prior-auth automation and screening navigation",
  description:
    "OpenRx connects source-linked screening guidance, care navigation, provider handoffs, and prior authorization workflow infrastructure.",
  metadataBase: new URL("https://openrx.health"),
  openGraph: {
    title: "OpenRx | Prior-auth automation and screening navigation",
    description:
      "See guideline-grounded screening navigation and source-linked prior authorization workflow infrastructure.",
    type: "website",
    images: [
      { url: "/og-image.svg", width: 1200, height: 630, alt: "OpenRx clinical workflow workspace" },
      { url: "/og-image.png", width: 1200, height: 630, alt: "OpenRx clinical workflow workspace" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenRx | Prior-auth automation and screening navigation",
    description:
      "Source-linked screening navigation, provider handoffs, and prior authorization workflow infrastructure.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505",
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "OpenRx",
  url: "https://openrx.health",
  description: "Clinical decision support and prior authorization workflow preparation.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-surface text-primary antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
