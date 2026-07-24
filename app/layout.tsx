import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

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
  themeColor: "#fafafa",
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
