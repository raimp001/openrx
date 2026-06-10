import { expect, test } from "@playwright/test"

// Authorization guards on the PHI-bearing referral endpoint. Creation must
// never succeed for an anonymous caller, and a caller can never attribute a
// referral to an arbitrary patientId they don't own.

test.describe("referral endpoint authorization", () => {
  test("anonymous create with a spoofed patientId is rejected", async ({ request }) => {
    const res = await request.post("/api/referrals/screening", {
      data: {
        action: "create",
        patientId: "user_someone_else",
        recommendationId: "uspstf-average-risk-colorectal",
        consentAccepted: true,
        providerId: "provider_1",
        screeningInput: { age: 52, gender: "female" },
      },
    })
    expect(res.status(), "PHI-bearing create must require an authenticated identity").toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
    const body = await res.json().catch(() => ({}))
    expect(body.created, "no referral may be created for a spoofed patient").toBeUndefined()
  })

  test("anonymous preview works but never echoes a caller-chosen patientId as trusted", async ({ request }) => {
    const res = await request.post("/api/referrals/screening", {
      data: {
        action: "preview",
        patientId: "user_someone_else",
        recommendationId: "uspstf-average-risk-colorectal",
        screeningInput: { age: 52, gender: "female" },
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.patientId).not.toBe("user_someone_else")
    expect(body.created).toBeUndefined()
  })
})
