import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "OpenRx AI Care Team Command Center API",
      version: "1.0.0",
    },
    paths: {
      "/api/agent-notify": {
        post: {
          summary: "Care automation status and human-review signal",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["agent_id", "agent_name", "status"],
                  properties: {
                    agent_id: { type: "string" },
                    agent_name: { type: "string" },
                    status: { type: "string", enum: ["running", "paused", "needs_input"] },
                    context: {
                      type: "object",
                      properties: {
                        patient_id_hash: { type: "string", description: "SHA-256 only" },
                        reason: { type: "string" },
                        suggested_action: { type: "string" },
                        document_snapshot_hash: { type: "string" },
                        workflow: { type: "string" },
                        confidence_score: { type: "number" },
                        browser_url: { type: "string" },
                        highlight_selector: { type: "string" },
                      },
                    },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Human input request queued" },
            "200": { description: "Status updated" },
            "403": { description: "Forbidden" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/agent-notify/resolve": {
        post: {
          summary: "Human decision for agent request",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["requestId", "decision"],
                  properties: {
                    requestId: { type: "string" },
                    decision: { type: "string", enum: ["approve", "reject", "edit"] },
                    note: { type: "string" },
                    editedSuggestedAction: { type: "string" },
                    browserUrl: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent-notify/stream": {
        get: {
          summary: "SSE realtime event stream for clinic operators",
          responses: {
            "200": {
              description: "text/event-stream",
            },
          },
        },
      },
    },
  })
}
