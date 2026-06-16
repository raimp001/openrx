import { expect, test } from "@playwright/test"
import { buildDeterministicScreeningResponse, runAgent } from "@/lib/ai-engine"
import { isChatHistoryPersistenceEnabled } from "@/lib/chat-history-owner"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"
import {
  CLEAN_MODEL_BUSY_MESSAGE,
  cleanModelErrorState,
  withModelApiBoundary,
} from "@/lib/openclaw/model-boundary"
import { resolveOpenAIHealthcareConfig } from "@/lib/openai-healthcare"

test("age-sex intake returns a guideline-grounded colorectal recommendation without echo template", () => {
  const response = deterministicClinicalResponse("age 45 male")

  expect(response).toBeTruthy()
  expect(response).toContain("Colorectal cancer screening")
  expect(response).toContain("USPSTF: Colorectal cancer screening for average-risk adults (2021-05-18)")
  expect(response).toContain("Grade B")
  expect(response).toContain("https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening")
  expect(response).not.toContain("Direct answer")
  expect(response).not.toContain("age 45 male")
  expect(response).not.toContain("handling a high volume")
})

test("legacy screening builder does not echo intake as a direct-answer template", () => {
  const response = buildDeterministicScreeningResponse("age 45 male")

  expect(response).toContain("Colorectal")
  expect(response).not.toContain("Direct answer")
  expect(response).not.toContain("age 45 male")
})

test("no-key fallback answer does not echo raw patient input", async () => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY

  try {
    const result = await runAgent({ agentId: "rx", message: "age 45 male" })

    expect(result.response).toContain("What to do now")
    expect(result.response).not.toContain("Direct answer")
    expect(result.response).not.toContain("age 45 male")
  } finally {
    if (anthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = anthropicKey
    if (openaiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = openaiKey
  }
})

test("OpenAI API PHI use requires both a server key and an explicit BAA gate", () => {
  const noBaa = resolveOpenAIHealthcareConfig({
    OPENAI_API_KEY: "sk-test",
    OPENRX_OPENAI_BAA_ENABLED: "false",
  })
  const withBaa = resolveOpenAIHealthcareConfig({
    OPENAI_API_KEY: "sk-test",
    OPENRX_OPENAI_BAA_ENABLED: "true",
  })
  const clinicianWorkspace = resolveOpenAIHealthcareConfig({
    OPENAI_API_KEY: "sk-test",
    OPENRX_OPENAI_BAA_ENABLED: "true",
    OPENRX_OPENAI_CLINICAL_MODE: "chatgpt_for_clinicians",
  })

  expect(noBaa.apiKeyConfigured).toBe(true)
  expect(noBaa.apiPhiAllowed).toBe(false)
  expect(noBaa.disabledReason).toContain("BAA")
  expect(withBaa.apiPhiAllowed).toBe(true)
  expect(clinicianWorkspace.apiPhiAllowed).toBe(false)
  expect(clinicianWorkspace.disabledReason).toContain("workspace product")
})

test("OpenAI key without BAA does not activate patient chat model fallback", async () => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const openaiBaa = process.env.OPENRX_OPENAI_BAA_ENABLED
  const openaiLegacyBaa = process.env.OPENAI_BAA_ENABLED
  delete process.env.ANTHROPIC_API_KEY
  process.env.OPENAI_API_KEY = "sk-test"
  delete process.env.OPENRX_OPENAI_BAA_ENABLED
  delete process.env.OPENAI_BAA_ENABLED

  try {
    const result = await runAgent({ agentId: "rx", message: "Can I take ibuprofen with warfarin?" })

    expect(result.response).toContain("What to do now")
    expect(result.response).not.toBe(CLEAN_MODEL_BUSY_MESSAGE)
    expect(result.response).not.toContain("high volume")
    expect(result.response).not.toContain("warfarin")
  } finally {
    if (anthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = anthropicKey
    if (openaiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = openaiKey
    if (openaiBaa === undefined) delete process.env.OPENRX_OPENAI_BAA_ENABLED
    else process.env.OPENRX_OPENAI_BAA_ENABLED = openaiBaa
    if (openaiLegacyBaa === undefined) delete process.env.OPENAI_BAA_ENABLED
    else process.env.OPENAI_BAA_ENABLED = openaiLegacyBaa
  }
})

test("chat history persistence is off by default for the stateless MVP", () => {
  const previous = process.env.OPENRX_ENABLE_PHI_CHAT_HISTORY
  delete process.env.OPENRX_ENABLE_PHI_CHAT_HISTORY

  try {
    expect(isChatHistoryPersistenceEnabled()).toBe(false)
    process.env.OPENRX_ENABLE_PHI_CHAT_HISTORY = "true"
    expect(isChatHistoryPersistenceEnabled()).toBe(true)
  } finally {
    if (previous === undefined) delete process.env.OPENRX_ENABLE_PHI_CHAT_HISTORY
    else process.env.OPENRX_ENABLE_PHI_CHAT_HISTORY = previous
  }
})

test("model API boundary retries 429 and exposes only a clean error state", async () => {
  let attempts = 0
  const upstreamError = Object.assign(new Error("raw provider overloaded: include no patient text"), {
    status: 429,
    request_id: "req_test_429",
  })

  await expect(
    withModelApiBoundary("test-429-boundary", async () => {
      attempts += 1
      throw upstreamError
    })
  ).rejects.toMatchObject({ status: 429 })

  const state = cleanModelErrorState()
  const payload = { answer: undefined as string | undefined, cleanError: state.error }

  expect(attempts).toBe(3)
  expect(state.error).toBe(CLEAN_MODEL_BUSY_MESSAGE)
  expect(JSON.stringify(state)).not.toContain("raw provider overloaded")
  expect(Boolean(payload.answer) !== Boolean(payload.cleanError)).toBe(true)
})
