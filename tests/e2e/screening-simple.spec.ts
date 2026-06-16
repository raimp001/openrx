import { expect, test, type Page } from "@playwright/test"
import {
  PROVIDER_HANDOFF_STORAGE_KEY,
  SCREENING_HANDOFF_STORAGE_KEY,
} from "@/lib/care-handoff"
import { CLEAN_MODEL_BUSY_MESSAGE } from "@/lib/openclaw/model-boundary"

type MockScreeningApisOptions = {
  localCareConnections?: unknown[]
  onAssessRequest?: (body: Record<string, unknown>) => void
}

async function mockScreeningApis(page: Page, options: MockScreeningApisOptions = {}) {
  await page.route(/\/api\/screening\/intake$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        extracted: {
          age: 58,
          bmi: 29.2,
          smoker: true,
          symptoms: ["fatigue"],
          familyHistory: ["father had prostate cancer at age 52"],
          conditions: ["BRCA mutation carrier"],
        },
      }),
    })
  })

  await page.route(/\/api\/screening\/assess$/, async (route) => {
    options.onAssessRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        patientId: "wallet-1234",
        generatedAt: "2026-02-26T12:00:00.000Z",
        overallRiskScore: 64,
        riskTier: "moderate",
        factors: [
          {
            label: "Family history signals",
            impact: "monitor",
            scoreDelta: 9,
            evidence: "Multiple family risk factors reported.",
          },
        ],
        recommendedScreenings: [
          {
            id: "colon-screening",
            name: "Colorectal cancer screening",
            priority: "medium",
            ownerAgent: "scheduling",
            reason: "Adults over 45 should stay current on colon screening cadence.",
          },
        ],
        structuredRecommendations: [
          {
            id: "uspstf-average-risk-colorectal",
            cancerType: "colorectal",
            screeningName: "Colorectal cancer screening",
            status: "due",
            riskCategory: "average_risk",
            rationale: "Adults 45-75 should stay current on colorectal cancer screening.",
            recommendedNextStep: "Request colonoscopy or discuss FIT/colonoscopy options with a clinician.",
            suggestedTiming: "Start now",
            sourceSystem: "USPSTF",
            evidenceGrade: "B",
            requiresClinicianReview: false,
            patientFriendlyExplanation: "Based on age, colorectal screening may be due now.",
            clinicianSummary: "USPSTF average-risk CRC screening; verify prior screening and symptoms.",
            nextSteps: ["request_colonoscopy", "request_care_navigation", "download_clinician_summary"],
          },
        ],
        nextActions: ["Review this plan with your clinician within 30 days."],
        localCareConnections: options.localCareConnections || [],
        evidenceCitations: [
          {
            id: "uspstf-colon",
            title: "USPSTF colorectal cancer screening",
            url: "https://www.uspreventiveservicestaskforce.org",
            source: "USPSTF",
            summary: "Adults 45-75 should undergo colorectal cancer screening.",
            type: "guideline",
          },
        ],
        accessLevel: "preview",
        isPreview: true,
      }),
    })
  })
}

async function mockChatStream(
  page: Page,
  respond: (body: { message?: string; agentId?: string; screeningContext?: string }) => string
) {
  await page.route(/\/api\/openclaw\/chat\/stream$/, async (route) => {
    const body = route.request().postDataJSON() as { message?: string; agentId?: string; screeningContext?: string }
    const text = respond(body)
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `event: delta\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: ${JSON.stringify({ finalText: text, agentId: body.agentId || "coordinator" })}\n\n`,
    })
  })
}

test("simple screening intake returns free recommendations", async ({ page }) => {
  await mockScreeningApis(page)

  await page.goto("/screening")

  await page
    .getByTestId("screening-narrative-input")
    .fill("I am 58, smoker, family history of stroke and diabetes.")

  await page.getByTestId("screening-submit-preview").click()

  await expect(page.getByText("Recommended Screenings")).toBeVisible()
  await expect(page.getByTestId("screening-section-due_now")).toBeVisible()
  await expect(page.getByTestId("screening-recommendation-card")).toHaveCount(1)
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
  await expect(page.getByText("Evidence Sources")).toBeVisible()
  await expect(page.getByText("Failed to compute screening assessment.")).toHaveCount(0)
  await expect(page.getByTestId("care-plan-preview")).toBeVisible()
  await page.getByTestId("trust-drawer").first().click()
  await expect(page.getByText("Sources used").first()).toBeVisible()

  await page.getByRole("button", { name: "Generate Advanced Review" }).click()
  await expect(page.getByText("Complete payment before advanced review")).toBeVisible()
  await expect(page.getByText("Connect payment access to unlock advanced review.")).toBeVisible()
})

test("free screening with ZIP shows nearby care matches in preview", async ({ page }) => {
  let assessBody: Record<string, unknown> | undefined
  await mockScreeningApis(page, {
    onAssessRequest: (body) => {
      assessBody = body
    },
    localCareConnections: [
      {
        recommendationId: "colon-screening",
        recommendationName: "Colorectal cancer screening",
        reason: "Adults over 45 should stay current on colon screening cadence.",
        services: ["provider"],
        query: "gastroenterology providers near 97123",
        riskContext: "Preventive continuity and routine monitoring.",
        ready: true,
        prompt: { id: "care-search", image: "", text: "" },
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Gastroenterology",
            specialty: "Gastroenterology",
            taxonomyCode: "207RG0100X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Hillsboro, OR 97123",
            phone: "503-555-0101",
          },
        ],
      },
    ],
  })

  await page.goto("/screening")
  await page.getByTestId("screening-narrative-input").fill("I am 58 and need colorectal cancer screening.")
  await page.getByTestId("screening-location-zip").fill("97123")
  await page.getByTestId("screening-submit-preview").click()

  await expect(page.getByText("Free screening plan ready.")).toBeVisible()
  expect(assessBody?.locationZip).toBe("97123")
  await expect(page.getByText(/Advanced review is optional/)).toBeVisible()
  await expect(page.getByText("Nearby Care Matches For This Screening")).toBeVisible()
  await expect(page.getByText("OpenRx Gastroenterology")).toBeVisible()
  await expect(page.getByText(/OpenRx does not place orders/)).toBeVisible()
})

test("screening handoff from chat auto-runs the free recommendations", async ({ page }) => {
  await mockScreeningApis(page)
  await page.addInitScript(
    ([key]) => {
      window.sessionStorage.setItem(key, JSON.stringify({
        source: "chat",
        narrative: "I am 58 male, father had prostate cancer at 52, BRCA mutation carrier. What recs?",
        autorun: true,
        createdAt: Date.now(),
      }))
    },
    [SCREENING_HANDOFF_STORAGE_KEY]
  )

  await page.goto("/screening?handoff=chat")

  await expect(page.getByText("Context carried forward.")).toBeVisible()
  await expect(page.getByText("Recommended Screenings")).toBeVisible()
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
})

test("screening recommendation opens provider directory with recommendation context", async ({ page }) => {
  await mockScreeningApis(page)
  let providerQuery = ""
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    providerQuery = new URL(route.request().url()).searchParams.get("q") || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: providerQuery,
          serviceTypes: ["provider"],
          city: "",
          state: "",
          zip: "",
          query: providerQuery,
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Gastroenterology",
            specialty: "Gastroenterology",
            taxonomyCode: "207RG0100X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0101",
          },
        ],
      }),
    })
  })

  await page.goto("/screening")
  await page
    .getByTestId("screening-narrative-input")
    .fill("I am 58 and need colorectal cancer screening.")
  await page.getByTestId("screening-submit-preview").click()
  await page.getByTestId("recommendation-find-schedule").first().click()

  await expect(page).toHaveURL(/\/providers\?handoff=screening/)
  await expect(page.getByTestId("provider-handoff-notice")).toContainText("Loaded the screening recommendation")
  await expect(page.getByText("OpenRx Gastroenterology").first()).toBeVisible()
  expect(providerQuery.toLowerCase()).toContain("colonoscopy")
})

test("screening recommendation provider handoff does not depend on sessionStorage", async ({ page }) => {
  await mockScreeningApis(page)
  let providerQuery = ""
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked in sandbox", "SecurityError")
      },
    })
  })
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    providerQuery = new URL(route.request().url()).searchParams.get("q") || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: providerQuery,
          serviceTypes: ["provider"],
          city: "",
          state: "",
          zip: "",
          query: providerQuery,
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Gastroenterology",
            specialty: "Gastroenterology",
            taxonomyCode: "207RG0100X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0101",
          },
        ],
      }),
    })
  })

  await page.goto("/screening")
  await page.getByTestId("screening-narrative-input").fill("I am 58 and need colorectal cancer screening.")
  await page.getByTestId("screening-submit-preview").click()
  await page.getByTestId("recommendation-find-schedule").first().click()

  await expect(page).toHaveURL(/\/providers\?handoff=screening/)
  await expect(page.getByTestId("provider-handoff-notice")).toContainText("Loaded the screening recommendation")
  await expect(page.getByText("OpenRx Gastroenterology").first()).toBeVisible()
  expect(providerQuery.toLowerCase()).toContain("colonoscopy")
})

test("screening recommendation can be saved into My Care without navigation", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await mockScreeningApis(page)
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: "Find gastroenterology providers for colonoscopy near Portland OR 97204",
          serviceTypes: ["provider"],
          city: "Portland",
          state: "OR",
          zip: "97204",
          query: "gastroenterology providers for colonoscopy",
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Gastroenterology",
            specialty: "Gastroenterology",
            taxonomyCode: "207RG0100X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0101",
          },
        ],
      }),
    })
  })
  await page.route(/\/api\/live\/patient-snapshot.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "database",
        walletAddress: null,
        generatedAt: new Date().toISOString(),
        patient: null,
        physicians: [],
        appointments: [],
        claims: [],
        prescriptions: [],
        priorAuths: [],
        messages: [],
        labResults: [],
        vitals: [],
        vaccinations: [],
        referrals: [],
        careTimeline: [],
      }),
    })
  })

  await page.goto("/screening")
  await page
    .getByTestId("screening-narrative-input")
    .fill("I am 58 and need colorectal cancer screening.")
  await page.getByTestId("screening-submit-preview").click()
  await page.getByTestId("care-plan-add-button").click()
  await expect(page).toHaveURL(/\/screening/)
  await page.goto("/dashboard")
  await expect(page.getByTestId("active-care-plans")).toBeVisible()
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("provider handoff from chat auto-searches without a second button press", async ({ page }) => {
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: "Find a radiology center near Portland OR 97204",
          serviceTypes: ["radiology"],
          city: "Portland",
          state: "OR",
          zip: "97204",
          query: "radiology near Portland OR 97204",
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "radiology",
            npi: "1234567890",
            name: "OpenRx Imaging Portland",
            specialty: "Radiology",
            taxonomyCode: "261QR0200X",
            status: "A",
            confidence: "high",
            fullAddress: "100 SW Main St, Portland, OR 97204",
            phone: "503-555-0100",
          },
        ],
      }),
    })
  })
  await page.addInitScript(
    ([key]) => {
      window.sessionStorage.setItem(key, JSON.stringify({
        source: "chat",
        query: "Find a radiology center near Portland OR 97204",
        autorun: true,
        createdAt: Date.now(),
      }))
    },
    [PROVIDER_HANDOFF_STORAGE_KEY]
  )

  await page.goto("/providers?handoff=chat")

  await expect(page.getByText("Loaded your chat context")).toBeVisible()
  await expect(page.getByText("Matched network")).toBeVisible()
  await expect(page.getByText("OpenRx Imaging Portland").first()).toBeVisible()
  await expect(page.getByText(/NPI match is not proof of licensure/)).toBeVisible()
  await expect(page.getByTestId("provider-verification-ladder").first()).toContainText("License verification")
})

test("landing care action stays in chat before a user intentionally opens the directory", async ({ page }) => {
  let providerQuery = ""
  await page.route(/\/api\/providers\/search.*/, async (route) => {
    providerQuery = new URL(route.request().url()).searchParams.get("q") || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        parsed: {
          raw: providerQuery,
          serviceTypes: ["provider"],
          city: "",
          state: "",
          zip: "",
          query: providerQuery,
        },
        prompt: { id: "care-search", image: "", text: "" },
        count: 1,
        matches: [
          {
            kind: "provider",
            npi: "1234567890",
            name: "OpenRx Primary Care",
            specialty: "Internal Medicine",
            taxonomyCode: "207R00000X",
            status: "A",
            confidence: "high",
            fullAddress: "100 Care Way, Portland, OR 97204",
            phone: "503-555-0102",
          },
        ],
      }),
    })
  })

  await page.goto("/chat")
  await page.getByRole("button", { name: "Find care near me" }).click()

  await expect(page).toHaveURL(/\/chat/)
  // First hit can pay dev-server compile cost for the stream route.
  await expect(page.getByTestId("chat-section-answer").filter({ hasText: /ZIP code first/i }).last()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Direct answer")).toHaveCount(0)
  await expect(page.getByTestId("care-plan-preview")).toHaveCount(0)
  expect(providerQuery).toBe("")
})

test("chat prompt autorun answers after landing submit without a second send", async ({ page }) => {
  let postedMessage = ""
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })
  await mockChatStream(page, (body) => {
    postedMessage = body.message || ""
    return "Review the bill amount, claim status, and insurer explanation first."
  })

  await page.goto("/chat?prompt=Explain%20this%20bill&topic=billing&autorun=1")

  await expect(page.getByText("Review the bill amount")).toBeVisible()
  expect(postedMessage).toBe("Explain this bill")
})

test("chat answers cancer screening questions inline with guideline links", async ({ page }) => {
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill("What cancer screening does a 50-year-old woman need?")
  await page.getByTestId("chat-send-button").click()

  await expect(page).toHaveURL(/\/chat/)
  await expect(page).not.toHaveURL(/\/screening/)
  await expect(page.getByTestId("chat-section-answer")).toBeVisible()
  await expect(page.getByText("Breast cancer screening").first()).toBeVisible()
  await expect(page.getByText("Colorectal cancer screening").first()).toBeVisible()
  await expect(page.getByText("Cervical cancer screening").first()).toBeVisible()
  await expect(page.getByRole("link", { name: /USPSTF.*Breast cancer screening/i }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Open screening plan" })).toHaveCount(0)
})

test("screening answer finds clinic numbers in the same chat after a ZIP follow-up", async ({ page }) => {
  const routedRequests: Array<{ message?: string; agentId?: string }> = []
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })
  await mockChatStream(page, (body) => {
    routedRequests.push(body)
    if (body.message === "Find a clinic or screening site for these recommendations.") {
      return "Answer\n\nI can help find public clinic phone numbers, but I need the ZIP code first."
    }
    if (body.message === "97123") {
      return "Answer\n\nHere are public clinic options near 97123. Call first to confirm availability.\n\nCare options\n\n- Hillsboro Primary Care: [(503) 555-0100](tel:+15035550100). Internal Medicine."
    }
    return "Answer\n\nColorectal cancer screening may be due now.\n\nReferences\n\n- [USPSTF: Colorectal cancer screening](https://www.uspreventiveservicestaskforce.org)"
  })

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill("What cancer screening does a 55-year-old man need?")
  await page.getByTestId("chat-send-button").click()
  await expect(page.getByRole("button", { name: "Find who to call" })).toBeVisible()

  await page.getByRole("button", { name: "Find who to call" }).click()
  await expect(page.getByText(/ZIP code first/)).toBeVisible()
  expect(routedRequests[1]?.agentId).toBe("scheduling")

  await page.getByTestId("chat-input").fill("97123")
  await page.getByTestId("chat-send-button").click()
  await expect(page.getByText(/public clinic options near 97123/)).toBeVisible()
  await expect(page.getByRole("link", { name: "(503) 555-0100" })).toHaveAttribute("href", "tel:+15035550100")
  expect(routedRequests[2]?.agentId).toBe("scheduling")
  await expect(page).toHaveURL(/\/chat/)
})

test("landing screening suggestion opens chat and does not redirect to screening page", async ({ page }) => {
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })

  await page.goto("/chat")
  await page.getByRole("button", { name: /Check my screening/ }).click()

  await expect(page).toHaveURL(/\/chat/)
  await expect(page).not.toHaveURL(/\/screening/)
  await expect(page.getByTestId("chat-message-user").filter({ hasText: "What screening may be due for me?" })).toBeVisible()
})

test("chat keeps medication symptom and prevention questions in conversation", async ({ page }) => {
  const routedAgents: string[] = []
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })
  await mockChatStream(page, (body) => {
    routedAgents.push(body.agentId || "")
    return body.agentId === "triage"
      ? "If chest pain or trouble breathing is present, seek emergency care now. I can also help organize follow-up after urgent symptoms are addressed."
      : body.agentId === "rx"
        ? "For medication questions, confirm the exact drug, dose, kidney history, allergies, and prescriber. Do not stop prescribed medication without clinician guidance."
        : "For prevention, I can answer here first and cite guideline-backed steps before any scheduling handoff."
  })

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill("Medication question: can I take ibuprofen with lisinopril?")
  await page.getByTestId("chat-send-button").click()
  await expect(page.getByText("For medication questions")).toBeVisible()
  await expect(page).toHaveURL(/\/chat/)

  await page.getByTestId("chat-input").fill("I have chest pain and shortness of breath")
  await page.getByTestId("chat-send-button").click()
  await expect(page.getByText("seek emergency care now")).toBeVisible()
  await expect(page.getByTestId("red-flag-alert")).toBeVisible()
  await expect(
    page.getByTestId("chat-message-agent").filter({ hasText: "seek emergency care now" }).last().getByTestId("chat-action-plan")
  ).toHaveCount(0)
  await expect(page).toHaveURL(/\/chat/)
  await page.getByTestId("red-flag-acknowledge").click()

  await page.getByTestId("chat-input").fill("What vaccines should a 55-year-old man ask about?")
  await page.getByTestId("chat-send-button").click()
  await expect(page.getByText("guideline-backed steps")).toBeVisible()
  await expect(page).toHaveURL(/\/chat/)

  expect(routedAgents).toContain("rx")
  expect(routedAgents).toContain("triage")
  expect(routedAgents).toContain("wellness")
})

test("chat renders structured screening sections and a citation rail", async ({ page }) => {
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill("What cancer screening does a 50-year-old woman need?")
  await page.getByTestId("chat-send-button").click()

  // Structured section testids exposed by the redesigned answer renderer
  await expect(page.getByTestId("chat-section-answer")).toBeVisible()
  await expect(page.getByText("Direct answer")).toHaveCount(0)
  await expect(page.getByTestId("chat-section-due-now")).toBeVisible()
  await expect(page.getByTestId("chat-section-references")).toHaveCount(0) // refs render as a rail
  await expect(page.getByTestId("chat-citations")).toBeVisible()

  // Citations row exposes guideline pills with testids
  const citations = page.getByTestId("chat-citation")
  await expect(citations.first()).toBeVisible()
  expect(await citations.count()).toBeGreaterThan(0)
})

test("chat surfaces smart care actions with directory links", async ({ page }) => {
  await mockChatStream(page, () =>
    "Answer\n\nColorectal screening may be due now.\n\nDue now\n\n- Colorectal cancer screening. Source: USPSTF 2021 · Grade B · https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening\n\nSafety note\n\nConfirm timing and options with a clinician."
  )

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill("What cancer screening does a 50-year-old woman need?")
  await page.getByTestId("chat-send-button").click()

  const actionPlan = page.getByTestId("chat-action-plan").first()
  await expect(actionPlan).toContainText(/Care actions/)
  const directoryAction = page.getByTestId("chat-action-plan-item").filter({ hasText: "Open care directory" }).first()
  await expect(directoryAction).toHaveAttribute("href", /\/providers\?/)
  await expect(directoryAction).toHaveAttribute("href", /handoff=screening/)
  await expect(directoryAction).toHaveAttribute("href", /autorun=1/)
})

test("chat suppresses care actions for clean model busy state", async ({ page }) => {
  await mockChatStream(page, () => CLEAN_MODEL_BUSY_MESSAGE)

  await page.goto("/chat")
  await page.getByTestId("chat-input").fill("What cancer screening does a 50-year-old woman need?")
  await page.getByTestId("chat-send-button").click()

  await expect(page.getByText(CLEAN_MODEL_BUSY_MESSAGE)).toBeVisible()
  await expect(page.getByTestId("chat-action-plan")).toHaveCount(0)
})

test("chat retains compact screening clarification in place and suppresses premature care actions", async ({ page }) => {
  const requests: Array<{ message?: string; agentId?: string; screeningContext?: string }> = []
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })
  await mockChatStream(page, (body) => {
    requests.push(body)
    if (!body.screeningContext?.includes("38 hx lymphoma in dad")) {
      return "Answer\n\nI can help, but I need one missing detail before giving screening guidance safely.\n\nShare one line with your age and any known family/genetic risk.\n\nSafety note: OpenRx is clinical decision support."
    }
    return "Answer\n\nOpenRx does not have a version-stamped routine screening rule for family history of lymphoma alone.\n\nQuestion to refine this\n\nWhat sex was assigned at birth, and do you have symptoms or a known inherited mutation?\n\nReferences\n\n1. [CDC: Cancer screening tests](https://www.cdc.gov/cancer/prevention/screening.html)"
  })

  await page.goto("/chat")
  await page.getByRole("button", { name: /Check my screening/ }).click()
  await expect(page.getByText(/need one missing detail/i)).toBeVisible()
  await expect(page.getByTestId("chat-action-plan")).toHaveCount(0)

  await page.getByTestId("chat-input").fill("38 hx lymphoma in dad")
  await page.getByTestId("chat-send-button").click()
  const followUpAnswer = page.getByTestId("chat-message-agent").last()
  await expect(followUpAnswer.getByText(/family history of lymphoma/i).first()).toBeVisible()
  await expect(followUpAnswer.getByText(/What sex was assigned at birth/i)).toBeVisible()
  await expect(followUpAnswer).not.toContainText("Direct answer")
  await followUpAnswer.getByTestId("trust-drawer").click()
  await expect(followUpAnswer.getByText(/Age 38/).last()).toBeVisible()
  expect(requests[1]?.agentId).toBe("screening")
  expect(requests[1]?.screeningContext).toContain("What screening may be due for me?")
  expect(requests[1]?.screeningContext).toContain("38 hx lymphoma in dad")
})

test("trust disclosure shows clinician-review boundary when no validated source is attached", async ({ page }) => {
  await page.goto("/messages")
  await page.getByTestId("trust-drawer").click()
  await expect(page.getByText(/Needs clinician review\. No validated source was attached/)).toBeVisible()
})

test("chat shows quick prompts on first load and hides them after first send", async ({ page }) => {
  await page.route(/\/api\/openclaw\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    })
  })
  await mockChatStream(page, () =>
    "Answer\n\nAcknowledged.\n\nWhat to do now\nNothing to do.\n\nReferences\n- [CDC](https://www.cdc.gov/)\n\nSafety note\nDecision support only."
  )

  await page.goto("/chat")
  await expect(page.getByTestId("chat-empty-state")).toBeVisible()

  await page.getByTestId("chat-input").fill("Hello")
  await page.getByTestId("chat-send-button").click()

  await expect(page.getByTestId("chat-message-agent").first()).toBeVisible()
  await expect(page.getByTestId("chat-empty-state")).toHaveCount(0)
})
