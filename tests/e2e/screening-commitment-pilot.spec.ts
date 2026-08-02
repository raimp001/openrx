import { expect, test, type APIRequestContext } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const patientHeaders = {
  "x-openrx-user-role": "patient",
  "x-openrx-user-id": "commitment-e2e-patient",
}
const providerHeaders = {
  "x-openrx-user-role": "provider",
  "x-openrx-user-id": "openrx-local-lab",
}
const screenshotDirectory = process.env.OPENRX_COMMITMENT_SCREENSHOT_DIR

async function capture(page: import("@playwright/test").Page, name: string) {
  if (!screenshotDirectory) return
  mkdirSync(screenshotDirectory, { recursive: true })
  await page.screenshot({ path: join(screenshotDirectory, `${name}.png`), fullPage: true })
}

async function getEligibleRecommendation(
  request: APIRequestContext,
  headers: Record<string, string>,
) {
  const assessmentResponse = await request.post("/api/screening/assess", {
    headers,
    data: {
      age: 45,
      gender: "male",
      reportedHistory: {
        colorectalScreening: "no",
        personalCancer: "no",
        familyCancer: "no",
      },
      analysisLevel: "preview",
    },
  })
  expect(assessmentResponse.ok()).toBe(true)
  const assessment = await assessmentResponse.json()
  const recommendation = assessment.structuredRecommendations.find(
    (item: { id: string; status: string }) =>
      item.id === "uspstf-average-risk-colorectal" && item.status === "due",
  )
  expect(recommendation).toBeTruthy()
  const eligibility = assessment.commitmentEligibility[recommendation.id]
  expect(eligibility?.token).toBeTruthy()
  return { recommendation, eligibility }
}

test("patient completes the private screening commitment sandbox end to end", async ({
  request,
  browser,
}) => {
  const config = await request.get("/api/commitments/config")
  await expect(config).toBeOK()
  expect((await config.json()).network).toBe("local-mock")

  const { recommendation, eligibility } = await getEligibleRecommendation(request, patientHeaders)
  const createdResponse = await request.post("/api/commitments", {
    headers: patientHeaders,
    data: {
      recommendationId: recommendation.id,
      screeningLabel: recommendation.screeningName,
      guidelineSource: recommendation.sourceSystem,
      guidelineVersion: recommendation.sourceVersion,
      engineVersion: recommendation.engineVersion,
      sourceUrl: recommendation.sourceUrl,
      recommendationIssuedAt: new Date().toISOString(),
      eligibilityToken: eligibility.token,
      expectedCompletionProviderId: "openrx-local-lab",
      consentVersion: "openrx-screening-commitment-terms-v1",
      termsAccepted: true,
    },
  })
  await expect(createdResponse).toBeOK()
  const created = await createdResponse.json()
  const commitmentId = created.snapshot.commitment.id as string
  expect(created.snapshot.wallet.dedicated).toBe(true)

  const verifyIdentity = await request.patch(`/api/commitments/${commitmentId}`, {
    headers: patientHeaders,
    data: { action: "verify_identity" },
  })
  await expect(verifyIdentity).toBeOK()

  const quote = await request.patch(`/api/commitments/${commitmentId}`, {
    headers: patientHeaders,
    data: { action: "quote", paymentMethod: "sandbox_balance", country: "US" },
  })
  await expect(quote).toBeOK()
  expect((await quote.json()).snapshot.quote.paymentTotalMinor).toBe(2_050)

  const funded = await request.patch(`/api/commitments/${commitmentId}`, {
    headers: patientHeaders,
    data: { action: "fund" },
  })
  await expect(funded).toBeOK()
  expect((await funded.json()).snapshot.commitment.status).toBe("funded")

  const patientContext = await browser.newContext({ extraHTTPHeaders: patientHeaders })
  const patientPage = await patientContext.newPage()
  await patientPage.goto(`/commitments/${commitmentId}`)
  await expect(patientPage.getByRole("heading", { name: "Colorectal cancer screening" })).toBeVisible()
  await expect(patientPage.getByRole("heading", { name: "Completion window" })).toBeVisible()
  await expect(patientPage.getByText("Advanced details")).toBeVisible()
  await capture(patientPage, "patient-funded-desktop")

  const mobileContext = await browser.newContext({
    extraHTTPHeaders: patientHeaders,
    viewport: { width: 375, height: 812 },
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`/commitments/${commitmentId}`)
  await expect(mobilePage.getByRole("heading", { name: "Completion window" })).toBeVisible()
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await capture(mobilePage, "patient-funded-mobile")
  await mobileContext.close()

  const providerContext = await browser.newContext({ extraHTTPHeaders: providerHeaders })
  const providerPage = await providerContext.newPage()
  await providerPage.goto("/commitments/provider")
  await expect(providerPage.getByRole("heading", { name: "Completion confirmations" })).toBeVisible()
  const assignedCommitment = providerPage.getByTestId(`provider-commitment-${commitmentId}`)
  await expect(assignedCommitment.getByText("Colorectal cancer screening")).toBeVisible()
  await capture(providerPage, "provider-confirmation")
  await assignedCommitment.getByRole("button", { name: "Confirm completion" }).click()
  await expect(assignedCommitment.getByText("Recorded")).toBeVisible()
  await providerContext.close()

  const completed = await request.get(`/api/commitments/${commitmentId}`, {
    headers: patientHeaders,
  })
  await expect(completed).toBeOK()
  const completedData = await completed.json()
  expect(completedData.snapshot.commitment.status).toBe("refunded")
  expect(completedData.snapshot.refundTransaction.amountMinor).toBe(2_000)
  expect(completedData.snapshot.credential.payload).not.toHaveProperty("testName")
  expect(completedData.snapshot.notifications).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ messageCode: "completion_verified_refund_confirmed" }),
    ]),
  )
  expect(JSON.stringify(completedData)).not.toContain("45378")

  const shared = await request.post(`/api/commitments/${commitmentId}/shares`, {
    headers: patientHeaders,
    data: { intendedVerifier: "E2E sandbox verifier", ttlMinutes: 30 },
  })
  await expect(shared).toBeOK()
  const shareData = await shared.json()
  const shareToken = String(shareData.url).split("/").pop()
  expect(shareToken).toBeTruthy()
  const verifierResponse = await request.get(`/api/commitments/verify/${shareToken}`)
  await expect(verifierResponse).toBeOK()
  const verified = await verifierResponse.json()
  expect(verified.valid).toBe(true)
  expect(verified.credential).not.toHaveProperty("screeningName")

  const verifierPage = await patientContext.newPage()
  await verifierPage.goto(shareData.url)
  await expect(verifierPage.getByRole("heading", { name: "Valid completion credential" })).toBeVisible()
  await expect(verifierPage.getByText("does not imply insurer acceptance")).toBeVisible()
  await capture(verifierPage, "private-verifier")

  await patientPage.reload()
  await expect(patientPage.getByRole("heading", { name: "Completion credential" })).toBeVisible()
  await expect(patientPage.getByRole("heading", { name: "Deposit returned" })).toBeVisible()
  await capture(patientPage, "patient-refunded-credential")

  const supportContext = await browser.newContext({
    extraHTTPHeaders: {
      "x-openrx-user-role": "support",
      "x-openrx-user-id": "commitment-e2e-support",
    },
  })
  const supportPage = await supportContext.newPage()
  await supportPage.goto("/admin-review/commitments")
  await expect(supportPage.getByRole("heading", { name: "Commitment pilot operations" })).toBeVisible()
  await expect(supportPage.getByText("Audit events")).toBeVisible()
  await expect(supportPage.getByRole("button", { name: "Full exception refund" })).toHaveCount(0)
  await capture(supportPage, "support-operations")
  await supportContext.close()

  const activeShare = completedData.snapshot.shares?.[0]
  const current = await request.get(`/api/commitments/${commitmentId}`, { headers: patientHeaders })
  const currentData = await current.json()
  const shareId = currentData.snapshot.shares[0].id
  expect(activeShare).toBeUndefined()
  const revoked = await request.delete(`/api/commitments/${commitmentId}/shares`, {
    headers: patientHeaders,
    data: { shareId },
  })
  await expect(revoked).toBeOK()
  const revokedVerifier = await request.get(`/api/commitments/verify/${shareToken}`)
  expect(revokedVerifier.status()).toBe(404)
  await patientContext.close()
})

test("patient cannot access another patient's commitment and patient role cannot open admin operations", async ({
  request,
}) => {
  const secondPatientHeaders = {
    "x-openrx-user-role": "patient",
    "x-openrx-user-id": "commitment-e2e-patient-2",
  }
  const { recommendation, eligibility } = await getEligibleRecommendation(
    request,
    secondPatientHeaders,
  )
  const createdResponse = await request.post("/api/commitments", {
    headers: secondPatientHeaders,
    data: {
      recommendationId: recommendation.id,
      screeningLabel: recommendation.screeningName,
      guidelineSource: recommendation.sourceSystem,
      guidelineVersion: recommendation.sourceVersion,
      engineVersion: recommendation.engineVersion,
      sourceUrl: recommendation.sourceUrl,
      recommendationIssuedAt: new Date().toISOString(),
      eligibilityToken: eligibility.token,
      consentVersion: "openrx-screening-commitment-terms-v1",
      termsAccepted: true,
    },
  })
  const created = await createdResponse.json()
  const commitmentId = created.snapshot.commitment.id

  const otherPatient = await request.get(`/api/commitments/${commitmentId}`, {
    headers: {
      "x-openrx-user-role": "patient",
      "x-openrx-user-id": "another-patient",
    },
  })
  expect(otherPatient.status()).toBe(403)

  const admin = await request.get("/api/admin/commitments", { headers: patientHeaders })
  expect(admin.status()).toBe(403)

  const support = await request.get("/api/admin/commitments", {
    headers: {
      "x-openrx-user-role": "support",
      "x-openrx-user-id": "commitment-e2e-support",
    },
  })
  await expect(support).toBeOK()
  const supportPayload = await support.json()
  expect(JSON.stringify(supportPayload)).not.toContain("patientId")
  expect(JSON.stringify(supportPayload)).not.toContain("publicAddress")
  expect(JSON.stringify(supportPayload)).not.toContain("walletAddress")
  expect(
    supportPayload.commitments.every(
      (item: { commitment: { screeningLabel: string } }) =>
        item.commitment.screeningLabel === "Preventive screening commitment",
    ),
  ).toBe(true)

  const compliance = await request.get("/api/admin/commitments", {
    headers: {
      "x-openrx-user-role": "compliance",
      "x-openrx-user-id": "commitment-e2e-compliance",
    },
  })
  await expect(compliance).toBeOK()

  const providerDashboard = await request.get("/api/admin/commitments", {
    headers: providerHeaders,
  })
  expect(providerDashboard.status()).toBe(403)

  const supportExceptionRefund = await request.patch(
    `/api/admin/commitments/${commitmentId}`,
    {
      headers: {
        "x-openrx-user-role": "support",
        "x-openrx-user-id": "commitment-e2e-support",
      },
      data: { action: "exception_refund" },
    },
  )
  expect(supportExceptionRefund.status()).toBe(403)
})
