import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { getCareTeamSnapshot } from "@/lib/care-team/store"
import { subscribeCareTeamEvents } from "@/lib/care-team/realtime"

export const runtime = "nodejs"

function formatSse(payload: unknown, event = "message"): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!session.canAccessCareTeam) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false

      const safeClose = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // no-op
        }
      }

      const initialSnapshot = await getCareTeamSnapshot(15)
      controller.enqueue(encoder.encode(formatSse({ type: "bootstrap", snapshot: initialSnapshot }, "care_team")))

      const unsubscribe = subscribeCareTeamEvents((event) => {
        if (closed) return
        controller.enqueue(encoder.encode(formatSse(event, "care_team")))
      })

      const keepAlive = setInterval(() => {
        if (closed) return
        controller.enqueue(encoder.encode(": keep-alive\n\n"))
      }, 15000)

      const onAbort = () => {
        clearInterval(keepAlive)
        unsubscribe()
        safeClose()
      }

      request.signal.addEventListener("abort", onAbort)
    },
  })

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
}
