import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { decodeFunctionData } from "viem"
import { createMockCommitmentAdapters, MOCK_COMPLETION_PROVIDER_ID, signMockCompletionEvent } from "@/lib/commitments/mock-adapters"
import { CommitmentPilotService } from "@/lib/commitments/service"
import { resetCommitmentPilotState } from "@/lib/commitments/store"
import { DEFAULT_COMMITMENT_CONFIG, type CreateCommitmentInput } from "@/lib/commitments/types"
import { findProhibitedData } from "@/lib/commitments/privacy"
import { buildBaseSepoliaDepositCalls } from "@/lib/commitments/coinbase-adapters"
import { verifyCoinbaseWebhook } from "@/lib/commitments/coinbase-webhook"
import { createCommitmentEligibilityToken } from "@/lib/commitments/eligibility"
import { decryptCommitmentValue, encryptCommitmentValue } from "@/lib/commitments/encryption"
import { isCommitmentFeatureEnabled } from "@/lib/commitments/flags"

const patientId = "sandbox-patient-1"
const walletAddress = "0x1111111111111111111111111111111111111111"

function createInput(overrides: Partial<CreateCommitmentInput> = {}): CreateCommitmentInput {
  const input = {
    patientId,
    recommendationId: "rec-colorectal-45",
    screeningLabel: "Colorectal cancer screening",
    guidelineSource: "USPSTF",
    guidelineVersion: "USPSTF-CRC-2021",
    engineVersion: "openrx-screening-v1",
    sourceUrl:
      "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening",
    recommendationIssuedAt: new Date().toISOString(),
    eligibilityToken: "",
    expectedCompletionProviderId: MOCK_COMPLETION_PROVIDER_ID,
    consentVersion: DEFAULT_COMMITMENT_CONFIG.consentVersion,
    termsAccepted: true,
    existingWalletAddress: walletAddress,
    cohort: "commitment_offer",
    ...overrides,
  }
  input.eligibilityToken =
    overrides.eligibilityToken ||
    createCommitmentEligibilityToken({
      subjectId: input.patientId,
      recommendation: {
        recommendationId: input.recommendationId,
        screeningLabel: input.screeningLabel,
        guidelineSource: input.guidelineSource,
        guidelineVersion: input.guidelineVersion,
        engineVersion: input.engineVersion,
        sourceUrl: input.sourceUrl,
      },
    }).token
  return input
}

async function createFunded(service: CommitmentPilotService) {
  const created = await service.create(createInput())
  await service.verifyIdentity(created.commitment.id, patientId)
  return service.fund(created.commitment.id, patientId)
}

beforeEach(() => {
  process.env.SCREENING_COMMITMENT_PILOT = "true"
  process.env.COINBASE_ONRAMP_PILOT = "true"
  process.env.PRIVATE_COMPLETION_CREDENTIALS = "true"
  process.env.INSURER_VERIFIER_DEMO = "true"
  process.env.OPENRX_COMMITMENT_NETWORK = "local-mock"
  resetCommitmentPilotState()
})

describe("screening commitment state machine", () => {
  it("creates a dedicated binding, verifies identity, and funds exactly $20", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const created = await service.create(createInput({ existingWalletAddress: undefined }))
    expect(created.commitment.status).toBe("created")
    expect(created.wallet?.dedicated).toBe(true)
    expect(created.wallet?.recoverySupported).toBe(true)
    expect(created.consent?.termsHash).toMatch(/^[a-f0-9]{64}$/)
    expect(created.consent?.termsSnapshot.optional).toBe(true)
    expect(created.consent?.termsSnapshot.paymentCredentialsStoredByOpenRx).toBe(false)

    const verified = await service.verifyIdentity(created.commitment.id, patientId)
    expect(verified.identity?.status).toBe("verified")

    const funded = await service.fund(created.commitment.id, patientId)
    expect(funded.commitment.status).toBe("funded")
    expect(funded.depositTransaction?.amountMinor).toBe(2_000)
    expect(funded.commitment.currentDeadline).toBeTruthy()
    expect(funded.audit.every((event) => /^[a-f0-9]{64}$/.test(event.eventHash))).toBe(true)
    expect(funded.audit[1].previousEventHash).toBe(funded.audit[0].eventHash)
  })

  it("does not fund without identity verification", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const created = await service.create(createInput())
    await expect(service.fund(created.commitment.id, patientId)).rejects.toMatchObject({
      code: "identity_required",
    })
  })

  it("does not fund after identity verification expires", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const created = await service.create(createInput())
    const verified = await service.verifyIdentity(created.commitment.id, patientId)
    if (!verified.identity) throw new Error("Expected identity")
    verified.identity.expiresAt = new Date(Date.now() - 1_000).toISOString()
    await expect(service.fund(created.commitment.id, patientId)).rejects.toMatchObject({
      code: "identity_required",
    })
    expect(verified.identity.status).toBe("expired")
  })

  it("rejects a missing or mismatched deterministic-engine eligibility proof", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    await expect(service.create(createInput({ eligibilityToken: "invalid" }))).rejects.toMatchObject({
      code: "verification_failed",
    })
    const validForAnotherRecommendation = createInput({
      recommendationId: "different-recommendation",
    }).eligibilityToken
    await expect(
      service.create(createInput({ eligibilityToken: validForAnotherRecommendation })),
    ).rejects.toMatchObject({ code: "verification_failed" })
  })

  it("rejects a wallet already bound to another patient identity", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    await service.create(createInput())
    await expect(
      service.create(createInput({ patientId: "sandbox-patient-2" })),
    ).rejects.toMatchObject({ code: "verification_failed" })
  })

  it("permits one 90-day extension and rejects the second", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const funded = await createFunded(service)
    const extended = service.extend(funded.commitment.id, patientId)
    expect(extended.commitment.status).toBe("extended")
    expect(extended.commitment.extensionUsed).toBe(true)
    await expect(
      Promise.resolve().then(() => service.extend(funded.commitment.id, patientId)),
    ).rejects.toMatchObject({ code: "invalid_transition" })
  })

  it("returns the full deposit after a replay-protected trusted completion", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const funded = await createFunded(service)
    const unsigned = {
      eventId: "lab-event-1",
      commitmentId: funded.commitment.id,
      providerId: MOCK_COMPLETION_PROVIDER_ID,
      occurredAt: new Date().toISOString(),
      nonce: "completion-nonce-1",
      idempotencyKey: "completion-idempotency-1",
    }
    const completed = await service.complete(signMockCompletionEvent(unsigned))
    expect(completed.commitment.status).toBe("refunded")
    expect(completed.refundTransaction?.amountMinor).toBe(2_000)
    expect(completed.credential?.status).toBe("active")
    expect(completed.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageCode: "completion_verified_refund_confirmed",
          channels: ["in_app", "email"],
        }),
      ]),
    )

    const duplicate = await service.complete(signMockCompletionEvent(unsigned))
    expect(duplicate.refundTransaction?.id).toBe(completed.refundTransaction?.id)
  })

  it("keeps a failed refund retryable without repeating completion disclosure", async () => {
    const adapters = createMockCommitmentAdapters()
    const successfulRefund = adapters.payment.refund.bind(adapters.payment)
    let attempts = 0
    adapters.payment.refund = async (input) => {
      attempts += 1
      if (attempts === 1) throw new Error("synthetic provider failure")
      return successfulRefund(input)
    }
    const service = new CommitmentPilotService(adapters)
    const funded = await createFunded(service)
    const event = signMockCompletionEvent({
      eventId: "refund-retry-event",
      commitmentId: funded.commitment.id,
      providerId: MOCK_COMPLETION_PROVIDER_ID,
      occurredAt: new Date().toISOString(),
      nonce: "refund-retry-nonce",
      idempotencyKey: "refund-retry-key",
    })
    await expect(service.complete(event)).rejects.toMatchObject({
      code: "external_service_unavailable",
    })
    expect(service.snapshot(funded.commitment.id).commitment.refundStatus).toBe("failed")
    const retried = await service.retryRefund(funded.commitment.id, "sandbox-support")
    expect(retried.commitment.refundStatus).toBe("confirmed")
    expect(retried.refundTransaction?.amountMinor).toBe(2_000)
    expect(retried.credential?.status).toBe("active")
    expect(attempts).toBe(2)
  })

  it("rejects a forged or replayed completion event", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const first = await createFunded(service)
    const forged = {
      eventId: "forged",
      commitmentId: first.commitment.id,
      providerId: MOCK_COMPLETION_PROVIDER_ID,
      occurredAt: new Date().toISOString(),
      nonce: "forged-nonce",
      idempotencyKey: "forged-key",
      signature: "not-a-signature",
    }
    await expect(service.complete(forged)).rejects.toMatchObject({ code: "verification_failed" })
  })

  it("returns deposit minus the disclosed fee on cancellation and consent withdrawal", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const cancelledFunded = await createFunded(service)
    const cancelled = await service.cancel(cancelledFunded.commitment.id, patientId)
    expect(cancelled.commitment.status).toBe("cancelled")
    expect(cancelled.refundTransaction?.amountMinor).toBe(1_800)

    resetCommitmentPilotState()
    const withdrawnFunded = await createFunded(service)
    const withdrawn = await service.cancel(
      withdrawnFunded.commitment.id,
      patientId,
      "consent_withdrawn",
    )
    expect(withdrawn.commitment.terminalReason).toBe("consent_withdrawn")
    expect(withdrawn.commitment.consentWithdrawnAt).toBeTruthy()
    expect(withdrawn.consent?.revokedAt).toBe(withdrawn.commitment.consentWithdrawnAt)
    expect(withdrawn.refundTransaction?.amountMinor).toBe(1_800)
  })

  it("expires only after the deadline and never forfeits the full deposit", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const funded = await createFunded(service)
    await expect(service.expire(funded.commitment.id)).rejects.toMatchObject({
      code: "deadline_not_reached",
    })
    const afterDeadline = new Date(
      new Date(funded.commitment.currentDeadline || "").getTime() + 1,
    )
    const expired = await service.expire(funded.commitment.id, "test-expiry", afterDeadline)
    expect(expired.commitment.status).toBe("expired")
    expect(expired.refundTransaction?.amountMinor).toBe(1_800)
  })

  it("queues configured reminders once and auto-expires stale commitments", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const funded = await createFunded(service)
    const fundedAt = new Date(funded.commitment.fundedAt || "")
    const reminderRun = await service.runDeadlineWorker(
      "test-worker",
      new Date(fundedAt.getTime() + 31 * 24 * 60 * 60 * 1_000),
    )
    expect(reminderRun.remindersQueued).toBe(2)
    const duplicateRun = await service.runDeadlineWorker(
      "test-worker",
      new Date(fundedAt.getTime() + 31 * 24 * 60 * 60 * 1_000),
    )
    expect(duplicateRun.remindersQueued).toBe(0)
    expect(service.snapshot(funded.commitment.id).notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageCode: "deadline_reminder", scheduleDay: 7 }),
        expect.objectContaining({ messageCode: "deadline_reminder", scheduleDay: 30 }),
      ]),
    )
    const expiryRun = await service.runDeadlineWorker(
      "test-worker",
      new Date(new Date(funded.commitment.currentDeadline || "").getTime() + 1),
    )
    expect(expiryRun.expired).toBe(1)
    expect(service.getPilotAnalytics().commitmentOffer.refundConfirmed).toBe(1)
    expect(service.getPilotAnalytics().randomized).toBe(false)
  })

  it("creates, verifies, shares, and revokes a private completion credential", async () => {
    const service = new CommitmentPilotService(createMockCommitmentAdapters())
    const funded = await createFunded(service)
    const event = signMockCompletionEvent({
      eventId: "credential-event",
      commitmentId: funded.commitment.id,
      providerId: MOCK_COMPLETION_PROVIDER_ID,
      occurredAt: new Date().toISOString(),
      nonce: "credential-nonce",
      idempotencyKey: "credential-key",
    })
    const completed = await service.complete(event)
    const shared = await service.createCredentialShare(
      completed.commitment.id,
      patientId,
      "Sandbox insurer verifier",
      5,
    )
    const verified = await service.verifyShare(shared.token)
    expect(verified.valid).toBe(true)
    expect(verified.credential).not.toHaveProperty("testName")
    service.revokeShare(completed.commitment.id, patientId, shared.share.id)
    await expect(service.verifyShare(shared.token)).rejects.toMatchObject({ code: "not_found" })
  })
})

describe("public-data and payment controls", () => {
  it("keeps every pilot surface disabled unless its explicit flag is true", () => {
    const previous = process.env.SCREENING_COMMITMENT_PILOT
    delete process.env.SCREENING_COMMITMENT_PILOT
    expect(isCommitmentFeatureEnabled("SCREENING_COMMITMENT_PILOT")).toBe(false)
    process.env.SCREENING_COMMITMENT_PILOT = previous
  })

  it("detects prohibited health, identity, wallet, and transaction metadata", () => {
    expect(
      findProhibitedData({
        patientName: "Example Patient",
        cpt: "45378",
        walletAddress,
        txHash: `0x${"a".repeat(64)}`,
      }),
    ).toEqual(expect.arrayContaining(["$.patientName", "$.cpt", "$.walletAddress", "$.txHash"]))
  })

  it("authenticates encrypted off-chain wallet bindings", () => {
    const encrypted = encryptCommitmentValue(walletAddress, `wallet:${patientId}`)
    expect(encrypted).not.toContain(walletAddress)
    expect(decryptCommitmentValue(encrypted, `wallet:${patientId}`)).toBe(walletAddress)
    expect(() => decryptCommitmentValue(encrypted, "wallet:another-patient")).toThrow()
  })

  it("prepares only an exact USDC approval and one escrow funding call", () => {
    const token = "0x2222222222222222222222222222222222222222"
    const escrow = "0x3333333333333333333333333333333333333333"
    const calls = buildBaseSepoliaDepositCalls({
      token,
      escrow,
      opaqueCommitmentId: `0x${"a".repeat(64)}`,
      amountMinor: 2_000,
    })
    expect(calls).toHaveLength(2)
    expect(calls[0].to).toBe(token)
    const approval = decodeFunctionData({
      abi: [
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ] as const,
      data: calls[0].data,
    })
    expect(approval.args).toEqual([escrow, BigInt(20_000_000)])
  })

  it("keeps health and identity language out of the public contract surface", () => {
    const source = readFileSync(
      resolve(process.cwd(), "contracts/src/ConditionalDepositEscrow.sol"),
      "utf8",
    )
    expect(source).not.toMatch(
      /\b(patient|screening|laboratory|diagnosis|procedure|cpt|loinc|result|appointment|insurance)\b/i,
    )
  })

  it("verifies Coinbase v0 webhook signatures and rejects stale replay", () => {
    const rawBody = JSON.stringify({ id: "event-1", data: { status: "success" } })
    const timestamp = 1_750_000_000
    const secret = "coinbase-webhook-test-secret"
    const signature = require("node:crypto")
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")
    expect(() =>
      verifyCoinbaseWebhook({
        rawBody,
        signatureHeader: `t=${timestamp},v0=${signature}`,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow()
    expect(() =>
      verifyCoinbaseWebhook({
        rawBody,
        signatureHeader: `t=${timestamp},v0=${signature}`,
        secret,
        nowSeconds: timestamp + 301,
      }),
    ).toThrow()
  })
})
