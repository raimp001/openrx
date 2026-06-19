import crypto from "node:crypto"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { getDatabaseHealth } from "@/lib/database-health"
import { prisma } from "@/lib/db"
import { planPhiSafeNotification } from "@/lib/phi-safe-notifications"
import { buildConsentReceipt, CONSENT_TEXT_VERSION, createConsentScopeSnapshot, narrowDisclosureScope } from "@/lib/referral-disclosure"
import {
  createConsentedReferralRequestDraft,
  type ReferralProviderCandidate,
} from "@/lib/referral-workflow"
import {
  buildScreeningReferralPlan,
  providerRecordToReferralCandidate,
  type ScreeningReferralFieldPreview,
  type ScreeningReferralInput,
} from "@/lib/screening-referral-flow"
import { internalUserIdFromWallet } from "@/lib/screening/next-step-store"
import type { CareDirectoryMatch } from "@/lib/npi-care-search"

export const dynamic = "force-dynamic"

type ReferralScreeningAction = "preview" | "create"

interface ReferralScreeningRequestBody {
  action?: ReferralScreeningAction
  walletAddress?: string
  patientId?: string
  recommendationId?: string
  screeningInput?: ScreeningReferralInput
  directoryMatches?: CareDirectoryMatch[]
  providerId?: string
  consentAccepted?: boolean
  selectedFieldIds?: string[]
  displayedFields?: ScreeningReferralFieldPreview[]
}

function normalizeWallet(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

function cleanJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function safeError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function referralDeepLink(referralId: string): string {
  return `/referrals?referralId=${encodeURIComponent(referralId)}`
}

async function loadReferralProviders(): Promise<{
  providers: ReferralProviderCandidate[]
  databaseReady: boolean
  databaseMessage: string
}> {
  const health = await getDatabaseHealth()
  if (!health.reachable) {
    return {
      providers: [],
      databaseReady: false,
      databaseMessage: health.message,
    }
  }

  try {
    const records = await prisma.providerRecord.findMany({
      where: { listingSuppressed: false },
      take: 100,
      orderBy: [{ active: "desc" }, { acceptingNew: "desc" }, { name: "asc" }],
    })
    return {
      providers: records.map(providerRecordToReferralCandidate),
      databaseReady: true,
      databaseMessage: "Provider directory loaded.",
    }
  } catch {
    return {
      providers: [],
      databaseReady: false,
      databaseMessage: "Provider directory is not reachable right now.",
    }
  }
}

async function createReferral(params: {
  plan: ReturnType<typeof buildScreeningReferralPlan>
  provider: ReferralProviderCandidate
  patientId: string
  selectedFieldIds: string[]
  displayedFields?: ScreeningReferralFieldPreview[]
}) {
  if (!params.plan.recommendation || !params.plan.disclosureScope) {
    throw new Error("Referral plan is not supported for PHI disclosure.")
  }

  const now = new Date()
  const consentId = `consent_${crypto.randomUUID()}`
  const referralId = `ref_${crypto.randomUUID()}`
  const selectedScope = narrowDisclosureScope({
    scope: params.plan.disclosureScope,
    selectedFieldIds: params.selectedFieldIds,
  })
  const receipt = buildConsentReceipt({
    consentId,
    patientId: params.patientId,
    providerName: params.provider.name,
    recommendation: params.plan.recommendation,
    scope: selectedScope,
    grantedAt: now.toISOString(),
  })
  const consent = createConsentScopeSnapshot({
    id: consentId,
    patientId: params.patientId,
    providerId: params.provider.id,
    scope: selectedScope,
    grantedAt: now.toISOString(),
    legalBasis: "undetermined",
    consentTextVersion: CONSENT_TEXT_VERSION,
    receipt,
  })
  const draft = createConsentedReferralRequestDraft({
    id: referralId,
    patientId: params.patientId,
    provider: params.provider,
    recommendation: params.plan.recommendation,
    intake: params.plan.intake,
    consent,
    selectedFieldIds: params.selectedFieldIds,
    displayedFields: params.displayedFields,
    now,
  })
  const phiValues = draft.transmittedFields.map((field) => field.value)
  const providerNotification = planPhiSafeNotification({
    id: `notif_${crypto.randomUUID()}`,
    recipientType: "provider",
    recipientId: params.provider.id,
    eventType: "referral_requested",
    entityId: draft.id,
    deepLink: referralDeepLink(draft.id),
    requestedChannels: ["in_app", "email"],
    phiValues,
    now,
  })
  const patientNotification = planPhiSafeNotification({
    id: `notif_${crypto.randomUUID()}`,
    recipientType: "patient",
    recipientId: params.patientId,
    eventType: "referral_requested",
    entityId: draft.id,
    deepLink: referralDeepLink(draft.id),
    requestedChannels: ["in_app", "email"],
    phiValues,
    now,
  })

  await prisma.$transaction(async (tx) => {
    await tx.consentRecord.create({
      data: {
        id: consent.id,
        patientId: consent.patientId,
        providerId: consent.providerId,
        scopeHash: consent.scopeHash,
        scopeSnapshot: cleanJson(consent),
        grantedAt: new Date(consent.grantedAt),
      },
    })
    await tx.referralRequestRecord.create({
      data: {
        id: draft.id,
        patientId: draft.patientId,
        providerId: draft.providerId,
        recommendationId: draft.recommendationId,
        reason: draft.reason,
        status: draft.status,
        sharedDataScope: cleanJson(draft.sharedDataScope),
        sharedDataScopeHash: draft.sharedDataScopeHash,
        disclosureTemplateId: draft.disclosureTemplateId,
        disclosureTemplateVersion: draft.disclosureTemplateVersion,
        consentId: draft.consentId,
        baaVersion: draft.baaVersion,
        consentTimestamp: new Date(draft.consentTimestamp),
        history: cleanJson([
          {
            event: "requested",
            actor: "patient",
            at: now.toISOString(),
            consentId: draft.consentId,
          },
        ]),
      },
    })
    await tx.providerAuditEventRecord.create({
      data: {
        providerId: draft.providerId,
        referralId: draft.id,
        consentId: draft.consentId,
        eventType: "consent.granted",
        actor: "patient",
        metadata: cleanJson({
          recommendationId: draft.recommendationId,
          disclosurePayloadHash: draft.sharedDataScopeHash,
          consentTextVersion: consent.consentTextVersion,
          legalBasis: consent.legalBasis,
          expiresAt: consent.expiresAt,
          selectedFieldIds: consent.selectedFieldIds,
        }),
        createdAt: now,
      },
    })
    await tx.providerAuditEventRecord.create({
      data: {
        providerId: draft.providerId,
        referralId: draft.id,
        consentId: draft.consentId,
        eventType: "referral.phi_disclosure",
        actor: "system",
        metadata: cleanJson(draft.auditMetadata),
        createdAt: now,
      },
    })

    for (const planned of [providerNotification, patientNotification]) {
      if (!planned.duplicate) {
        await tx.careNotificationRecord.create({
          data: {
            id: planned.notification.id,
            recipientType: planned.notification.recipientType,
            recipientId: planned.notification.recipientId,
            eventType: planned.notification.eventType,
            entityId: planned.notification.entityId,
            deepLink: planned.notification.deepLink,
            channelsSent: planned.notification.channelsSent,
            createdAt: new Date(planned.notification.createdAt),
          },
        })
      }
      for (const audit of planned.auditRows) {
        await tx.providerAuditEventRecord.create({
          data: {
            providerId: draft.providerId,
            referralId: draft.id,
            consentId: draft.consentId,
            eventType: audit.eventType,
            actor: audit.actor,
            metadata: cleanJson(audit.metadata),
            createdAt: new Date(audit.createdAt),
          },
        })
      }
    }
  })

  return {
    referral: {
      id: draft.id,
      status: draft.status,
      providerId: draft.providerId,
      recommendationId: draft.recommendationId,
      disclosureTemplateVersion: draft.disclosureTemplateVersion,
      scopeHash: draft.sharedDataScopeHash,
      disclosurePayloadHash: draft.sharedDataScopeHash,
    },
    consent: {
      id: consent.id,
      scopeHash: consent.scopeHash,
      disclosurePayloadHash: consent.disclosurePayloadHash,
      grantedAt: consent.grantedAt,
      expiresAt: consent.expiresAt,
      legalBasis: consent.legalBasis,
      consentTextVersion: consent.consentTextVersion,
      receipt: draft.receipt,
    },
    notificationCount: providerNotification.notification && patientNotification.notification ? 2 : 0,
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ReferralScreeningRequestBody
  const action = body.action === "create" ? "create" : "preview"
  const recommendationId = (body.recommendationId || "").trim()
  if (!recommendationId) {
    return safeError("recommendationId is required.")
  }

  const walletAddress = normalizeWallet(body.walletAddress)
  const walletProofMatches = walletAddress ? await requestWalletProofMatches(request, walletAddress) : false
  const auth = await requireAuth(request, { allowPublic: action === "preview" || walletProofMatches })
  if ("response" in auth) return auth.response

  const canUseWallet =
    (walletAddress && canUseWalletScopedData(auth.session, walletAddress)) || walletProofMatches
  // Referral creation writes PHI rows, so the patient identity must come from
  // the verified wallet itself. A caller-supplied patientId is only honored
  // for authenticated staff/service sessions — never from an anonymous or
  // wallet-proofed caller naming someone else.
  const patientId =
    canUseWallet && walletAddress
      ? internalUserIdFromWallet(walletAddress)
      : auth.session.authSource !== "default"
        ? body.patientId
        : undefined

  if (action === "create" && !patientId) {
    return safeError("Connect a wallet before creating a PHI-bearing referral request.", 401)
  }

  const directory = await loadReferralProviders()
  const plan = buildScreeningReferralPlan({
    patientId,
    recommendationId,
    screeningInput: body.screeningInput,
    providers: directory.providers,
    directoryMatches: Array.isArray(body.directoryMatches) ? body.directoryMatches.slice(0, 25) : [],
  })

  const baseResponse = {
    ...plan,
    databaseReady: directory.databaseReady,
    databaseMessage: directory.databaseMessage,
  }

  if (action === "preview") {
    return NextResponse.json(baseResponse)
  }

  if (!plan.supported || !plan.disclosureScope || !plan.recommendation) {
    return safeError(plan.message, 422)
  }
  if (!directory.databaseReady) {
    return safeError("Provider referral storage is not reachable, so no PHI was transmitted.", 503)
  }
  if (!body.consentAccepted) {
    return safeError("Patient consent is required before any PHI is disclosed.")
  }
  if (!Array.isArray(body.selectedFieldIds) || body.selectedFieldIds.length === 0) {
    return safeError("Select the exact fields to share before creating the referral.")
  }
  if (!body.providerId) {
    return safeError("Choose a verified OpenRx provider before creating the referral.")
  }

  const provider = directory.providers.find((candidate) => candidate.id === body.providerId)
  if (!provider) {
    return safeError("Selected provider is not available for OpenRx referrals.")
  }

  const selected = plan.referralTargets.find((candidate) => candidate.id === provider.id)
  if (!selected) {
    return safeError("Selected provider is not active, verified, screened, identity-proofed, and BAA-signed.")
  }

  try {
    const created = await createReferral({
      plan,
      provider,
      patientId: patientId || plan.patientId,
      selectedFieldIds: body.selectedFieldIds,
      displayedFields: body.displayedFields?.length ? body.displayedFields : undefined,
    })
    return NextResponse.json({
      ...baseResponse,
      created,
      message: "Referral request created after consent. Email and SMS notifications only carry a neutral OpenRx update link.",
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message.includes("byte-equal")
      ? "Consent screen field list changed before disclosure. Please preview the referral again."
      : "Referral could not be created, and no PHI was transmitted."
    return safeError(message, 400)
  }
}
