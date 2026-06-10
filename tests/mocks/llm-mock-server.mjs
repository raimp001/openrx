// Mock model-API server for regression tests.
//
// Stands in for api.anthropic.com / api.openai.com at the HTTP boundary so the
// app's real SDK clients, retry logic, and fallback paths are exercised without
// calling a real model. Point the app at it with:
//   ANTHROPIC_BASE_URL=http://127.0.0.1:18790  ANTHROPIC_API_KEY=sk-ant-mock
//   OPENAI_BASE_URL=http://127.0.0.1:18790/v1  OPENAI_API_KEY=sk-mock
//
// Control endpoint: POST /__mock/mode {"mode":"ok"|"429"|"500"|"timeout"}
import http from "node:http"

const PORT = Number(process.env.LLM_MOCK_PORT || 18790)
let mode = "ok"

const MOCK_COMPLETION_TEXT =
  "Mock model response for end-to-end testing. No clinical content."

function readBody(req) {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (chunk) => {
      data += chunk
    })
    req.on("end", () => resolve(data))
  })
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`)

  if (url.pathname === "/__mock/health") {
    return json(res, 200, { ok: true, mode })
  }

  if (url.pathname === "/__mock/mode" && req.method === "POST") {
    const body = await readBody(req)
    try {
      const parsed = JSON.parse(body || "{}")
      if (["ok", "429", "500", "timeout"].includes(parsed.mode)) {
        mode = parsed.mode
        return json(res, 200, { ok: true, mode })
      }
    } catch {
      // fall through to error below
    }
    return json(res, 400, { ok: false, error: "mode must be ok|429|500|timeout" })
  }

  // Model API surface (Anthropic /v1/messages, OpenAI /v1/chat/completions)
  await readBody(req)

  if (mode === "timeout") {
    // Hold the socket open well past any client timeout under test.
    setTimeout(() => {
      try {
        json(res, 200, { ok: true, late: true })
      } catch {
        // socket already closed by the client timeout — expected
      }
    }, 120_000)
    return
  }

  if (mode === "429") {
    return json(res, 429, {
      type: "error",
      error: { type: "rate_limit_error", message: "Mock rate limit exceeded." },
    })
  }

  if (mode === "500") {
    return json(res, 500, {
      type: "error",
      error: { type: "api_error", message: "Mock internal server error." },
    })
  }

  if (url.pathname.endsWith("/messages")) {
    return json(res, 200, {
      id: "msg_mock_001",
      type: "message",
      role: "assistant",
      model: "claude-mock",
      content: [{ type: "text", text: MOCK_COMPLETION_TEXT }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    })
  }

  if (url.pathname.endsWith("/chat/completions")) {
    return json(res, 200, {
      id: "chatcmpl-mock-001",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-mock",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: MOCK_COMPLETION_TEXT },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })
  }

  return json(res, 404, { error: "unknown mock route", path: url.pathname })
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[llm-mock] listening on http://127.0.0.1:${PORT} (mode=${mode})`)
})
