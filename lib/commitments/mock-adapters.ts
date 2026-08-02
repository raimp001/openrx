import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { privateKeyToAccount } from "viem/accounts"
import { verifyTypedData, type Hex } from "viem"
import type {
  CommitmentAdapters,
  CredentialIssuerAdapter,
  CredentialVerifierAdapter,
  IdentityVerificationAdapter,
  PaymentRailAdapter,
  ScreeningCompletionAdapter,
  WalletProviderAdapter,
} from "@/lib/commitments/adapters"
import { CommitmentPilotError } from "@/lib/commitments/errors"
import { encryptCommitmentValue } from "@/lib/commitments/encryption"
import { assertCommitmentSandbox } from "@/lib/commitments/flags"
import { assertPublicPayloadSafe, createOpaqueId } from "@/lib/commitments/privacy"
import type {
  CompletionEventInput,
  PrivateCompletionCredential,
} from "@/lib/commitments/types"

const MOCK_ISSUER_KEY =
  (process.env.COMMITMENT_MOCK_ISSUER_PRIVATE_KEY as Hex | undefined) ??
  "0x9b2be6abf1d5a3bbf87500ed4c322390288819b0443b95f0af6bccf9d063b36f"
const COMPLETION_SECRET = process.env.COMMITMENT_MOCK_COMPLETION_SECRET ?? "local-sandbox-completion-secret"
const MOCK_PROVIDER_ID = "openrx-local-lab"
const BASE_SEPOLIA_CHAIN_ID = 84_532

const credentialTypes = {
  PrivateCompletionCredential: [
    { name: "commitmentId", type: "string" },
    { name: "completionStatus", type: "string" },
    { name: "broadValidityPeriod", type: "string" },
    { name: "issuerOrganizationId", type: "string" },
    { name: "credentialVersion", type: "string" },
    { name: "issuedAt", type: "string" },
    { name: "expiresAt", type: "string" },
    { name: "revocationStatus", type: "string" },
  ],
} as const

function credentialDomain() {
  return {
    name: "OpenRx Private Completion Credential",
    version: "1",
    chainId: BASE_SEPOLIA_CHAIN_ID,
  } as const
}

function mockAddress(): `0x${string}` {
  return `0x${randomBytes(20).toString("hex")}`
}

export function completionSignaturePayload(
  input: Omit<CompletionEventInput, "signature">,
): string {
  return [
    input.eventId,
    input.commitmentId,
    input.providerId,
    input.occurredAt,
    input.nonce,
    input.idempotencyKey,
  ].join(".")
}

export function signMockCompletionEvent(
  input: Omit<CompletionEventInput, "signature">,
): CompletionEventInput {
  assertCommitmentSandbox()
  return {
    ...input,
    signature: createHmac("sha256", COMPLETION_SECRET)
      .update(completionSignaturePayload(input))
      .digest("hex"),
  }
}

const mockWalletAdapter: WalletProviderAdapter = {
  id: "mock",
  async createOrLinkWallet(input) {
    assertCommitmentSandbox()
    const address = input.existingWalletAddress ?? mockAddress()
    return {
      id: createOpaqueId("wallet"),
      patientId: input.patientId,
      provider: "mock",
      providerReference: createOpaqueId("mock-wallet"),
      encryptedWalletAddress: encryptCommitmentValue(address, `wallet:${input.patientId}`),
      publicAddress: address,
      dedicated: !input.existingWalletAddress,
      recoverySupported: true,
      createdAt: new Date().toISOString(),
    }
  },
  async recoverWallet() {
    assertCommitmentSandbox()
    return { recovered: true }
  },
}

const mockIdentityAdapter: IdentityVerificationAdapter = {
  id: "mock",
  async verify(input) {
    assertCommitmentSandbox()
    const now = new Date()
    return {
      id: createOpaqueId("identity"),
      patientId: input.patientId,
      walletBindingId: input.walletBinding.id,
      provider: "mock",
      assuranceLevel: "sandbox-ial2-simulation",
      status: "verified",
      providerReferenceToken: encryptCommitmentValue(
        input.providerReferenceToken ?? createOpaqueId("mock-idv"),
        `identity:${input.patientId}`,
      ),
      verifiedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
      createdAt: now.toISOString(),
    }
  },
}

const mockPaymentAdapter: PaymentRailAdapter = {
  id: "mock",
  async quoteFunding(input) {
    assertCommitmentSandbox()
    const now = Date.now()
    return {
      id: createOpaqueId("quote"),
      commitmentId: input.commitment.id,
      provider: "mock",
      paymentMethod: input.paymentMethod,
      paymentSubtotalMinor: input.commitment.depositAmountMinor,
      feeMinor: 50,
      networkFeeMinor: 0,
      paymentTotalMinor: input.commitment.depositAmountMinor + 50,
      paymentCurrency: "USD",
      purchaseAmountMinor: input.commitment.depositAmountMinor,
      purchaseCurrency: "USDC",
      expiresAt: new Date(now + 15 * 60 * 1_000).toISOString(),
      available: true,
      providerReference: createOpaqueId("mock-quote"),
    }
  },
  async createOnrampSession(input) {
    assertCommitmentSandbox()
    return {
      providerReference: createOpaqueId("mock-onramp"),
      url: `/commitments/${input.commitment.id}?mockOnramp=ready`,
    }
  },
  async fundExactAmount(input) {
    assertCommitmentSandbox()
    return {
      id: createOpaqueId("deposit"),
      commitmentId: input.commitment.id,
      kind: "deposit",
      provider: "mock",
      amountMinor: input.commitment.depositAmountMinor,
      currency: "USDC",
      status: "confirmed",
      opaqueTransactionReference: createOpaqueId("mock-tx"),
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    }
  },
  async prepareDeposit(input) {
    assertCommitmentSandbox()
    return {
      network: "base-sepolia",
      chainId: 84_532,
      amountMinor: input.commitment.depositAmountMinor,
      currency: "USDC",
      calls: [],
    }
  },
  async confirmDeposit(input) {
    return this.fundExactAmount(input)
  },
  async refund(input) {
    assertCommitmentSandbox()
    return {
      id: createOpaqueId("refund"),
      commitmentId: input.commitment.id,
      kind: "refund",
      provider: "mock",
      amountMinor: input.amountMinor,
      currency: "USDC",
      status: "confirmed",
      opaqueTransactionReference: createOpaqueId("mock-tx"),
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    }
  },
  async createOfframpSession() {
    assertCommitmentSandbox()
    return {
      available: true,
      url: "/commitments?mockOfframp=ready",
      feeDisclosure: "Sandbox estimate only. A production quote may include Coinbase fees and spread.",
      timingDisclosure: "Sandbox estimate only. Eligibility and settlement timing depend on Coinbase.",
    }
  },
}

const mockCompletionAdapter: ScreeningCompletionAdapter = {
  id: "mock_lab",
  async verifyCompletion(input, expectedProviderId) {
    assertCommitmentSandbox()
    if (expectedProviderId && input.providerId !== expectedProviderId) {
      throw new CommitmentPilotError("verification_failed", "Completion provider did not match.", 403)
    }
    if (input.providerId !== MOCK_PROVIDER_ID && !expectedProviderId) {
      throw new CommitmentPilotError("verification_failed", "Completion provider is not trusted.", 403)
    }
    const expected = Buffer.from(
      createHmac("sha256", COMPLETION_SECRET)
        .update(completionSignaturePayload(input))
        .digest("hex"),
    )
    const supplied = Buffer.from(input.signature)
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new CommitmentPilotError("verification_failed", "Completion signature is invalid.", 403)
    }
    const occurredAt = new Date(input.occurredAt).getTime()
    if (!Number.isFinite(occurredAt) || Math.abs(Date.now() - occurredAt) > 5 * 60 * 1_000) {
      throw new CommitmentPilotError("verification_failed", "Completion event timestamp is outside the allowed window.", 403)
    }
    return {
      eventId: input.eventId,
      commitmentId: input.commitmentId,
      providerId: input.providerId,
      occurredAt: input.occurredAt,
      idempotencyKey: input.idempotencyKey,
    }
  },
}

const mockCredentialIssuer: CredentialIssuerAdapter = {
  id: "eas-compatible-offchain",
  async issue({ commitment }) {
    assertCommitmentSandbox()
    const account = privateKeyToAccount(MOCK_ISSUER_KEY)
    const issuedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000).toISOString()
    const payload: PrivateCompletionCredential["payload"] = {
      commitmentId: commitment.opaqueCommitmentId,
      completionStatus: "verified",
      broadValidityPeriod: `${issuedAt.slice(0, 7)}/${expiresAt.slice(0, 7)}`,
      issuerOrganizationId: "openrx-sandbox-issuer",
      credentialVersion: "1",
      issuedAt,
      expiresAt,
      revocationStatus: "active",
    }
    assertPublicPayloadSafe(payload)
    const signature = await account.signTypedData({
      domain: credentialDomain(),
      types: credentialTypes,
      primaryType: "PrivateCompletionCredential",
      message: payload,
    })
    return {
      id: createOpaqueId("credential"),
      commitmentId: commitment.id,
      status: "active",
      protocol: "eas-compatible-offchain-v1",
      schemaVersion: "openrx-private-completion-v1",
      issuerOrganizationId: payload.issuerOrganizationId,
      issuerKeyId: "sandbox-eip712-key-v1",
      issuerAddress: account.address,
      broadValidityPeriod: payload.broadValidityPeriod,
      issuedAt,
      expiresAt,
      signature,
      payload,
    }
  },
  async revoke({ credential, revokedAt }) {
    return {
      ...credential,
      status: "revoked",
      revokedAt,
      payload: { ...credential.payload, revocationStatus: "revoked" },
    }
  },
}

const mockCredentialVerifier: CredentialVerifierAdapter = {
  id: "eas-compatible-offchain",
  async verify(credential) {
    if (credential.status !== "active" || credential.payload.revocationStatus !== "active") {
      return { valid: false, reason: "Credential has been revoked." }
    }
    if (new Date(credential.expiresAt).getTime() <= Date.now()) {
      return { valid: false, reason: "Credential has expired." }
    }
    const valid = await verifyTypedData({
      address: credential.issuerAddress as `0x${string}`,
      domain: credentialDomain(),
      types: credentialTypes,
      primaryType: "PrivateCompletionCredential",
      message: credential.payload,
      signature: credential.signature as Hex,
    })
    return valid ? { valid: true } : { valid: false, reason: "Credential signature is invalid." }
  },
}

export function createMockCommitmentAdapters(): CommitmentAdapters {
  return {
    wallet: mockWalletAdapter,
    payment: mockPaymentAdapter,
    identity: mockIdentityAdapter,
    completion: mockCompletionAdapter,
    credentialIssuer: mockCredentialIssuer,
    credentialVerifier: mockCredentialVerifier,
  }
}

export const MOCK_COMPLETION_PROVIDER_ID = MOCK_PROVIDER_ID

export function getSandboxTrustedIssuerRegistry() {
  const account = privateKeyToAccount(MOCK_ISSUER_KEY)
  return [
    {
      organizationId: "openrx-sandbox-issuer",
      keyId: "sandbox-eip712-key-v1",
      address: account.address,
      protocol: "eas-compatible-offchain-v1",
      status: "sandbox-only",
      network: "base-sepolia",
    },
  ] as const
}
