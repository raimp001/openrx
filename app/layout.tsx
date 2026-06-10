import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { Inter, Fraunces } from "next/font/google"
import "./globals.css"

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
  title: "OpenRx | Clinical answers to prior authorization action",
  description:
    "Ask a clinical question in plain English. OpenRx provides source-linked answers and a sandboxed path from denial to appeal preparation. Decision support, not a substitute for clinician judgment.",
  metadataBase: new URL("https://openrx.health"),
  openGraph: {
    title: "OpenRx | Clinical answers to prior authorization action",
    description:
      "See source-linked clinical workflow and a synthetic denial-to-appeal prior authorization demo.",
    type: "website",
    images: [
      { url: "/og-image.svg", width: 1200, height: 630, alt: "OpenRx clinical workflow workspace" },
      { url: "/og-image.png", width: 1200, height: 630, alt: "OpenRx clinical workflow workspace" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenRx | Clinical answers to prior authorization action",
    description:
      "Ask a clinical question. See source-linked guidance and a synthetic denial-to-appeal workflow.",
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
      <body className={`${inter.variable} ${GeistMono.variable} ${fraunces.variable} min-h-screen bg-surface text-primary antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <noscript>
          <div
            style={{
              padding: "12px 16px",
              background: "#164e63",
              color: "#f4f4f5",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            The interactive parts of OpenRx — chat, screening, and the denial-to-appeal sandbox —
            require JavaScript. Enable JavaScript to use them, or read about how OpenRx works on
            this page.
          </div>
        </noscript>
        {/* Wallet/query providers are scoped to the (app) route group so the
            public marketing surface ships no wallet JavaScript. */}
        {children}
      </body>
    </html>
  )
}
