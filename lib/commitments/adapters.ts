import type {
  CompletionEventInput,
  IdentityVerification,
  PaymentQuote,
  PaymentTransaction,
  PreparedDeposit,
  PrivateCompletionCredential,
  ScreeningCommitment,
  VerifiedCompletionEvent,
  WalletBinding,
} from "@/lib/commitments/types"

export interface WalletProviderAdapter {
  readonly id: WalletBinding["provider"]
  createOrLinkWallet(input: {
    patientId: string
    commitmentId: string
    existingWalletAddress?: string
  }): Promise<WalletBinding>
  recoverWallet(input: { patientId: string; walletBindingId: string }): Promise<{ recovered: boolean }>
}

export interface PaymentRailAdapter {
  readonly id: "mock" | "coinbase_cdp"
  quoteFunding(input: {
    commitment: ScreeningCommitment
    wallet: WalletBinding
    paymentMethod: string
    country: string
    subdivision?: string
    clientIp: string
  }): Promise<PaymentQuote>
  createOnrampSession(input: {
    commitment: ScreeningCommitment
    quote: PaymentQuote
    wallet: WalletBinding
    clientIp: string
  }): Promise<{ providerReference: string; url: string }>
  fundExactAmount(input: {
    commitment: ScreeningCommitment
    wallet: WalletBinding
  }): Promise<PaymentTransaction>
  prepareDeposit(input: {
    commitment: ScreeningCommitment
    wallet: WalletBinding
  }): Promise<PreparedDeposit>
  confirmDeposit(input: {
    commitment: ScreeningCommitment
    wallet: WalletBinding
    transactionHash: `0x${string}`
  }): Promise<PaymentTransaction>
  refund(input: {
    commitment: ScreeningCommitment
    wallet: WalletBinding
    amountMinor: number
    reason: "completion" | "cancellation" | "expiration" | "exception"
  }): Promise<PaymentTransaction>
  createOfframpSession(input: {
    commitment: ScreeningCommitment
    wallet: WalletBinding
    clientIp: string
  }): Promise<{ available: boolean; url?: string; feeDisclosure: string; timingDisclosure: string }>
}

export interface IdentityVerificationAdapter {
  readonly id: IdentityVerification["provider"]
  verify(input: {
    patientId: string
    walletBinding: WalletBinding
    providerReferenceToken?: string
  }): Promise<IdentityVerification>
}

export interface ScreeningCompletionAdapter {
  readonly id: "mock_lab" | "signed_provider_webhook" | "partner_lab_api" | "fhir"
  verifyCompletion(input: CompletionEventInput, expectedProviderId?: string): Promise<VerifiedCompletionEvent>
}

export interface CredentialIssuerAdapter {
  readonly id: "eas-compatible-offchain"
  issue(input: { commitment: ScreeningCommitment }): Promise<PrivateCompletionCredential>
  revoke(input: { credential: PrivateCompletionCredential; revokedAt: string }): Promise<PrivateCompletionCredential>
}

export interface CredentialVerifierAdapter {
  readonly id: "eas-compatible-offchain"
  verify(credential: PrivateCompletionCredential): Promise<{ valid: boolean; reason?: string }>
}

export interface CommitmentAdapters {
  wallet: WalletProviderAdapter
  payment: PaymentRailAdapter
  identity: IdentityVerificationAdapter
  completion: ScreeningCompletionAdapter
  credentialIssuer: CredentialIssuerAdapter
  credentialVerifier: CredentialVerifierAdapter
}
