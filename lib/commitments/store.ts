import type {
  CredentialShare,
  CommitmentNotification,
  CommitmentPatientConsent,
  IdentityVerification,
  PaymentQuote,
  PaymentTransaction,
  PilotAuditEvent,
  PrivateCompletionCredential,
  ScreeningCommitment,
  WalletBinding,
} from "@/lib/commitments/types"

export interface CommitmentPilotState {
  commitments: Map<string, ScreeningCommitment>
  wallets: Map<string, WalletBinding>
  identities: Map<string, IdentityVerification>
  consents: Map<string, CommitmentPatientConsent>
  quotes: Map<string, PaymentQuote>
  transactions: Map<string, PaymentTransaction>
  credentials: Map<string, PrivateCompletionCredential>
  shares: Map<string, CredentialShare>
  notifications: CommitmentNotification[]
  audit: PilotAuditEvent[]
  processedCompletionKeys: Set<string>
  processedCoinbaseWebhookKeys: Set<string>
  usedNonces: Set<string>
  remindersSent: Set<string>
  notificationKeys: Set<string>
  assignments: Map<string, { patientId: string; cohort: "reminders_only" | "commitment_offer"; assignmentMode: "manual"; assignedAt: string }>
}

const globalCommitmentState = globalThis as typeof globalThis & {
  __openrxCommitmentPilotState?: CommitmentPilotState
}

function createState(): CommitmentPilotState {
  return {
    commitments: new Map(),
    wallets: new Map(),
    identities: new Map(),
    consents: new Map(),
    quotes: new Map(),
    transactions: new Map(),
    credentials: new Map(),
    shares: new Map(),
    notifications: [],
    audit: [],
    processedCompletionKeys: new Set(),
    processedCoinbaseWebhookKeys: new Set(),
    usedNonces: new Set(),
    remindersSent: new Set(),
    notificationKeys: new Set(),
    assignments: new Map(),
  }
}

export function getCommitmentPilotState(): CommitmentPilotState {
  if (!globalCommitmentState.__openrxCommitmentPilotState) {
    globalCommitmentState.__openrxCommitmentPilotState = createState()
  }
  return globalCommitmentState.__openrxCommitmentPilotState
}

export function resetCommitmentPilotState(): void {
  globalCommitmentState.__openrxCommitmentPilotState = createState()
}
