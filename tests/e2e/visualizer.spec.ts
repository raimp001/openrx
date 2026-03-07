import { expect, test, type Page } from "@playwright/test"
test.setTimeout(180_000)

function makeDiagram(input: {
  id: string
  title: string
  description: string
  nodeLabel: string
  nodeInsight: string
  snippet: string
}) {
  return {
    id: input.id,
    type: input.id.replace(/-/g, "_"),
    title: input.title,
    description: input.description,
    mermaid: `flowchart LR\n  a["${input.nodeLabel}"] --> b["Service"]`,
    reactFlowData: {
      nodes: [
        {
          id: `${input.id}-n1`,
          position: { x: 40, y: 80 },
          data: {
            label: input.nodeLabel,
            insight: input.nodeInsight,
            filePath: "app/(app)/dashboard/page.tsx",
            snippet: input.snippet,
          },
          style: { background: "#1b1f25", border: "1px solid #3f4a57", color: "#f0f6ff" },
        },
        {
          id: `${input.id}-n2`,
          position: { x: 360, y: 80 },
          data: {
            label: "Service",
            insight: "Core orchestration service.",
          },
          style: { background: "#162520", border: "1px solid #2b7d66", color: "#d2fff0" },
        },
      ],
      edges: [
        {
          id: `${input.id}-e1`,
          source: `${input.id}-n1`,
          target: `${input.id}-n2`,
          label: "calls",
        },
      ],
    },
    insights: [`${input.title} insight one.`, `${input.title} insight two.`],
  }
}

async function expectDownloadFromButton(page: Page, buttonName: string, extension: RegExp) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: buttonName, exact: true }).last().click(),
  ])
  expect(download.suggestedFilename()).toMatch(extension)
}

test("maps codebase, supports interactions, exports, ask, and improve", async ({ page }) => {
  const mappingResponse = {
    mappingId: "map-demo-001",
    cacheKey: "cache-demo-001",
    cacheHit: false,
    progressLogs: [
      "Scanning 247 files…",
      "Building interaction graph…",
      "Generating Mermaid + React-Flow diagrams…",
      "Refining for clarity…",
    ],
    summary: {
      repoName: "acme/openrx-demo",
      commitSha: "abc123def0",
      source: "github",
      frameworks: ["Next.js", "React"],
      languages: ["TypeScript"],
      fileCount: 247,
      routeCount: 18,
      agentCount: 12,
      generatedAt: "2026-02-26T12:00:00.000Z",
    },
    diagrams: [
      makeDiagram({
        id: "architecture",
        title: "High-level Architecture",
        description: "Core component hierarchy and module boundaries.",
        nodeLabel: "Web App",
        nodeInsight: "Primary patient and clinician surface.",
        snippet: "export default function DashboardPage() {\n  return <div>Dashboard</div>\n}",
      }),
      makeDiagram({
        id: "agent-interaction",
        title: "Agent Interaction Graph",
        description: "Directed interactions across specialized agents.",
        nodeLabel: "Coordinator",
        nodeInsight: "Routes to screening, billing, scheduling.",
        snippet: "delegateTask({ assignedTo: 'screening' })",
      }),
      makeDiagram({
        id: "communication-flow",
        title: "Communication Flowchart",
        description: "Request/response and async communication paths.",
        nodeLabel: "API Route",
        nodeInsight: "Normalizes input and calls core services.",
        snippet: "export async function POST(req: NextRequest) {}",
      }),
      makeDiagram({
        id: "deployment-pipeline",
        title: "Deployment Pipeline",
        description: "Build, test, deploy, and runtime path.",
        nodeLabel: "CI Build",
        nodeInsight: "Builds and validates release artifacts.",
        snippet: "npm run build && npm run start",
      }),
      makeDiagram({
        id: "file-dependency",
        title: "File & Dependency Graph",
        description: "Import graph and dependency hotspots.",
        nodeLabel: "lib/npi-care-search.ts",
        nodeInsight: "High fanout utility for care discovery.",
        snippet: "export function parseCareSearchQuery(query: string) {}",
      }),
      makeDiagram({
        id: "data-flow",
        title: "Data Flow",
        description: "Movement of user inputs through domain services.",
        nodeLabel: "Patient Intake",
        nodeInsight: "Natural language intake and structured extraction.",
        snippet: "const intake = await parseScreeningIntakeNarrative(text)",
      }),
      makeDiagram({
        id: "security-posture",
        title: "Security Posture Map",
        description: "Auth boundaries and sensitive data touch points.",
        nodeLabel: "Wallet Identity",
        nodeInsight: "Wallet-linked identity and access checks.",
        snippet: "if (!walletAddress) return { ok: false }",
      }),
      makeDiagram({
        id: "call-graph-hotspots",
        title: "Call Graph Hotspots",
        description: "Likely high-churn and high-latency paths.",
        nodeLabel: "screening/assess",
        nodeInsight: "Hot path for deep recommendation generation.",
        snippet: "const assessment = await buildAssessmentPayload(body)",
      }),
    ],
    cost: {
      promptTokens: 2400,
      completionTokens: 900,
      estimatedUsd: 0.021,
    },
  }

  await page.route(/\/api\/visualize(?:\?.*)?$/, async (route) => {
    const request = route.request()
    if (request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mappingResponse),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/\/api\/visualize\/ask$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "Payment flow is concentrated in compliance-ledger and screening-access.",
        citations: ["architecture", "file-dependency"],
        regeneratedDiagrams: [
          {
            ...mappingResponse.diagrams[0],
            title: "High-level Architecture (Focused)",
            insights: [
              "Focused on payment flow boundaries.",
              ...mappingResponse.diagrams[0].insights,
            ],
          },
        ],
      }),
    })
  })

  await page.route(/\/api\/visualize\/improve$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        diagram: {
          ...mappingResponse.diagrams[0],
          title: "High-level Architecture (Refined)",
          insights: ["Readability improved for highest-risk paths."],
        },
      }),
    })
  })

  await page.goto("/projects/default/visualize")

  await page.getByLabel("GitHub repo URL").fill("https://github.com/acme/openrx-demo")
  await page.getByRole("button", { name: "Data Flow" }).click()
  await page.getByRole("button", { name: "Security / Privacy" }).click()
  await page.getByRole("button", { name: "Performance Bottlenecks" }).click()
  await page.getByRole("button", { name: "Map with AI Agent" }).click()

  await expect(page.getByRole("heading", { name: "High-level Architecture" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Agent Interaction Graph" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Communication Flowchart" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Deployment Pipeline" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "File & Dependency Graph" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Data Flow" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Security Posture Map" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Call Graph Hotspots" }).first()).toBeVisible()

  await page.getByText("Web App", { exact: true }).first().click()
  await expect(page.getByRole("heading", { name: "Node Inspector" })).toBeVisible()
  await expect(page.getByText("app/(app)/dashboard/page.tsx")).toBeVisible()

  await expectDownloadFromButton(page, "Mermaid", /\.mmd$/)
  await expectDownloadFromButton(page, "JSON", /\.json$/)

  await page.getByPlaceholder("Ask the mapper").fill("focus on payment flow")
  await page.getByRole("button", { name: "Ask", exact: true }).click()
  await expect(page.getByText(/Payment flow is concentrated/)).toBeVisible()

  await page.getByRole("button", { name: "Improve this diagram" }).click()
  await expect(page.getByRole("heading", { name: "High-level Architecture (Refined)" })).toBeVisible()
})
