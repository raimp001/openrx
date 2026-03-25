import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession, type ClinicSession } from "@/lib/clinic-auth"

/**
 * Require a real auth source in production. Returns the session if authorized,
 * or a 401 NextResponse if the caller has no credentials.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ session: ClinicSession } | { response: NextResponse }> {
  const session = await resolveClinicSession(request)

  if (session.authSource === "default" && process.env.NODE_ENV === "production") {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    }
  }

  return { session }
}
