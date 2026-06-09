import { expect, test } from "@playwright/test"
import {
  activateProvider,
  assertProviderCanReceivePhiReferral,
  canAppearInPatientFacingReferralMatching,
  claimSeededDirectoryEntry,
  describePatientFacingDirectoryStatus,
  evaluateProviderVerification,
  issuePracticeDomainProofingChallenge,
  rescreenActiveProviders,
  runProviderComplianceScreens,
  suppressSeededDirectoryEntry,
  type ProviderComplianceRecord,
} from "@/lib/provider-verification"

const NOW = new Date("2026-06-09T12:00:00.000Z")

function provider(overrides: Partial<ProviderComplianceRecord> = {}): ProviderComplianceRecord {
  return {
    id: "prov_1",
    npi: "1234567893",
    name: "Avery Test MD",
    type: "individual",
    licenseNumber: "MD-12345",
    licenseState: "OR",
    nppes: {
      matched: true,
      registryName: "Avery Test MD",
      practiceDomain: "openrxclinic.test",
      matchedAt: NOW.toISOString(),
    },
    verificationStatus: "pending",
    active: false,
    ...overrides,
  }
}

test("NPPES name match alone stays pending and is not patient-facing", () => {
  const screened = runProviderComplianceScreens(provider(), {
    now: NOW,
    licenseRegistry: [{ number: "MD-12345", state: "OR", status: "active", expiresAt: "2027-06-09" }],
  }).provider

  const verification = evaluateProviderVerification(screened)
  const activated = activateProvider(screened)

  expect(verification.status).toBe("pending")
  expect(verification.reasons.join(" ")).toContain("Identity proofing")
  expect(activated.active).toBe(false)
  expect(canAppearInPatientFacingReferralMatching(activated)).toBe(false)
})

test("practice-domain identity proofing plus BAA can activate only after clear screens", () => {
  const proof = issuePracticeDomainProofingChallenge({
    provider: provider(),
    email: "avery@openrxclinic.test",
    code: "123456",
    now: NOW,
  })
  expect(proof?.method).toBe("practice_domain_email")

  const screened = runProviderComplianceScreens(provider({
    identityProofing: proof || undefined,
    baa: { signed: true, version: "baa-2026-06", signedAt: NOW.toISOString() },
  }), {
    now: NOW,
    licenseRegistry: [{ number: "MD-12345", state: "OR", status: "active", expiresAt: "2027-06-09" }],
  }).provider

  expect(screened.verificationStatus).toBe("active")
  expect(canAppearInPatientFacingReferralMatching(screened)).toBe(true)
})

test("synthetic OIG LEIE hit blocks verification and activation", () => {
  const proof = issuePracticeDomainProofingChallenge({
    provider: provider(),
    email: "avery@openrxclinic.test",
    code: "123456",
    now: NOW,
  })

  const result = runProviderComplianceScreens(provider({
    identityProofing: proof || undefined,
    baa: { signed: true, version: "baa-2026-06", signedAt: NOW.toISOString() },
  }), {
    now: NOW,
    leieEntries: [{ npi: "1234567893", name: "Avery Test MD", source: "OIG_LEIE_SYNTHETIC" }],
    licenseRegistry: [{ number: "MD-12345", state: "OR", status: "active", expiresAt: "2027-06-09" }],
  })

  expect(result.provider.verificationStatus).toBe("blocked")
  expect(result.provider.active).toBe(false)
  expect(canAppearInPatientFacingReferralMatching(result.provider)).toBe(false)
  expect(result.auditEvents.some((event) => event.eventType === "provider_screen.oig_leie")).toBe(true)
})

test("periodic LEIE re-screen deactivates active provider and halts in-flight referrals", () => {
  const activeProvider = provider({
    verificationStatus: "active",
    active: true,
    identityProofing: {
      method: "third_party_identity",
      verifiedAt: NOW.toISOString(),
      verifier: "stripe_identity",
      referenceId: "vs_test_123",
    },
    baa: { signed: true, version: "baa-2026-06", signedAt: NOW.toISOString() },
    sanctions: {
      screenType: "oig_leie",
      status: "clear",
      source: "OIG_LEIE",
      runAt: NOW.toISOString(),
    },
    licensure: {
      screenType: "state_license",
      status: "active",
      source: "oregon_medical_board",
      runAt: NOW.toISOString(),
    },
    referrals: [
      { id: "ref_1", providerId: "prov_1", status: "accepted", history: [] },
      { id: "ref_2", providerId: "prov_1", status: "completed_provider_attested", history: [] },
    ],
  })

  const result = rescreenActiveProviders([activeProvider], {
    now: NOW,
    leieEntries: [{ npi: "1234567893", name: "Avery Test MD" }],
    licenseRegistry: [{ number: "MD-12345", state: "OR", status: "active", expiresAt: "2027-06-09" }],
  })

  expect(result.providers[0].verificationStatus).toBe("inactive")
  expect(result.providers[0].active).toBe(false)
  expect(result.haltedReferrals).toHaveLength(1)
  expect(result.haltedReferrals[0]).toMatchObject({
    id: "ref_1",
    status: "halted_provider_ineligible",
    futureDisclosuresBlocked: true,
  })
  expect(result.patientNotifications[0].message).toContain("alternatives")
})

test("claiming a seeded NPPES listing updates it in place and does not duplicate the NPI", () => {
  const seeded = provider({
    id: "seed_1",
    source: "seeded",
    active: false,
    verificationStatus: "pending",
    nppesSnapshotAt: "2026-06-01T00:00:00.000Z",
    baa: undefined,
    identityProofing: undefined,
  })

  const claimed = claimSeededDirectoryEntry({
    seeded,
    submittedProfile: {
      name: "Avery Test MD",
      identityProofing: {
        method: "manual_document_review",
        verifiedAt: NOW.toISOString(),
        verifier: "manual-review:cso",
      },
    },
    now: NOW,
  })

  expect(claimed.id).toBe(seeded.id)
  expect(claimed.npi).toBe(seeded.npi)
  expect(claimed.source).toBe("self_onboarded")
  expect(claimed.claimedAt).toBe(NOW.toISOString())
  expect(claimed.verificationStatus).toBe("pending")
  expect(claimed.active).toBe(false)
})

test("suppressed seeded listings never appear in patient-facing directory output", () => {
  const seeded = provider({
    source: "seeded",
    active: false,
    listingSuppressed: false,
    nppesSnapshotAt: NOW.toISOString(),
  })

  const result = suppressSeededDirectoryEntry(seeded, { actor: "provider-opt-out", now: NOW })
  const directory = describePatientFacingDirectoryStatus(result.provider, { now: NOW })

  expect(result.provider.listingSuppressed).toBe(true)
  expect(directory.visible).toBe(false)
  expect(directory.referralTarget).toBe(false)
  expect(result.auditEvent.eventType).toBe("provider_directory.listing_suppressed")
})

test("seeded directory entries are contact-only and cannot receive ReferralRequests or PHI", () => {
  const seeded = provider({
    source: "seeded",
    active: false,
    nppesSnapshotAt: NOW.toISOString(),
  })

  const directory = describePatientFacingDirectoryStatus(seeded, { now: NOW })

  expect(directory.visible).toBe(true)
  expect(directory.contactOnly).toBe(true)
  expect(directory.referralTarget).toBe(false)
  expect(() => assertProviderCanReceivePhiReferral(seeded)).toThrow(/Seeded public directory entries/)
})

test("stale seeded entries are visible only with an unconfirmed public-registry label", () => {
  const seeded = provider({
    source: "seeded",
    active: false,
    nppesSnapshotAt: "2026-01-01T00:00:00.000Z",
  })

  const directory = describePatientFacingDirectoryStatus(seeded, { now: NOW, ttlDays: 90 })

  expect(directory.visible).toBe(true)
  expect(directory.contactOnly).toBe(true)
  expect(directory.referralTarget).toBe(false)
  expect(directory.stale).toBe(true)
  expect(directory.label).toContain("unconfirmed")
})
