import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** Security headers applied to all responses (Edge-compatible — no dynamic objects) */
const SECURITY_HEADERS: [string, string][] = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["X-XSS-Protection", "1; mode=block"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
  [
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: blob: https:; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "connect-src 'self' https: wss:; " +
    "frame-ancestors 'none';",
  ],
]

/** Allowed origins for CORS */
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://openrx.vercel.app",
  "https://openrx.health",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith("/api/")

  // CORS handling for API routes
  const origin = request.headers.get("origin") || ""
  const response = NextResponse.next()

  if (isApiRoute && origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-api-key, x-openrx-user-id, x-openrx-user-role, x-wallet-address")
    response.headers.set("Access-Control-Max-Age", "86400")
  }

  // Handle preflight
  if (isApiRoute && request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    })
  }

  // Apply security headers to all responses
  for (let i = 0; i < SECURITY_HEADERS.length; i++) {
    response.headers.set(SECURITY_HEADERS[i][0], SECURITY_HEADERS[i][1])
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
