/**
 * Hermes — OpenRx Autonomous Research & Build Agent
 *
 * Hermes runs as a persistent background process (on AWS EC2 or any VM)
 * and collaborates with Claude + OpenAI to:
 *   1. Research clinical evidence, payer policy updates, FDA approvals
 *   2. Generate feature implementations (creates GitHub issues/PRs)
 *   3. Monitor payer rule changes and update the rules engine
 *   4. Draft whitepaper sections from real-world PA outcome data
 *   5. Self-improve based on PA outcome telemetry
 *
 * Architecture:
 *   HermesAgent → TaskQueue → ResearchPipeline → CodeGen → GitHubPR
 *
 * Deployment: AWS EC2 t3.medium, runs via PM2, wakes on cron or webhook
 */

// ── Task types ────────────────────────────────────────────────────────

export type HermesTaskType =
  | "RESEARCH_PAYER_POLICY"    // Watch payer policy updates (Aetna, UHC, etc.)
  | "RESEARCH_FDA_APPROVAL"    // Monitor new FDA drug approvals
  | "RESEARCH_CLINICAL_TRIAL"  // Track relevant trial results (NEJM, JCO, ASCO)
  | "UPDATE_PAYER_RULES"       // Update engine.ts with new payer criteria
  | "GENERATE_FEATURE"         // Generate code for a new feature
  | "DRAFT_WHITEPAPER_SECTION" // Add section to investor whitepaper
  | "GENERATE_PA_APPEAL"       // Generate appeal for a specific denied PA
  | "ANALYZE_PA_OUTCOMES"      // Analyze PA win/loss patterns
  | "MONITOR_COMPETITOR"       // Track competitor feature releases
  | "BUILD_DEMO_SCENARIO"      // Build a compelling demo patient scenario

export type HermesTaskStatus = "queued" | "running" | "completed" | "failed" | "review_needed"

export interface HermesTask {
  id: string
  type: HermesTaskType
  status: HermesTaskStatus
  priority: 1 | 2 | 3          // 1 = highest
  title: string
  description: string
  context?: Record<string, unknown>
  result?: string
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  prUrl?: string               // GitHub PR if code was generated
  requiresHumanReview: boolean
}

// ── Scheduled research tasks (run automatically) ──────────────────────

export const SCHEDULED_TASKS: Omit<HermesTask, "id" | "status" | "createdAt">[] = [
  {
    type: "RESEARCH_PAYER_POLICY",
    priority: 1,
    title: "Monitor Aetna specialty drug PA policy updates",
    description: "Check Aetna's clinical policy bulletins for changes to BCMA-targeted therapy PA requirements. Update engine.ts if criteria changed.",
    context: { payer: "Aetna", drugClasses: ["BCMA_BISPECIFIC", "CAR_T", "PD1_PDLR1"], source: "https://www.aetna.com/cpb/medical/" },
    requiresHumanReview: true,
  },
  {
    type: "RESEARCH_PAYER_POLICY",
    priority: 1,
    title: "Monitor UHC oncology PA policy updates",
    description: "Check UnitedHealthcare's oncology PA policy changes (Prior Auth list updates). Alert if any teclistamab/gilteritinib criteria changed.",
    context: { payer: "UnitedHealthcare", drugClasses: ["BCMA_BISPECIFIC", "FLT3_INHIBITOR"], source: "https://www.uhcprovider.com/prior-auth" },
    requiresHumanReview: true,
  },
  {
    type: "RESEARCH_FDA_APPROVAL",
    priority: 2,
    title: "Monitor FDA oncology drug approvals (Hematology/Oncology)",
    description: "Check FDA Oncology Center of Excellence approvals in last 30 days. Add new drugs to DRUG_RULES in engine.ts with HCPCS codes, criteria, and step therapy.",
    context: { source: "https://www.fda.gov/patients/hematologyoncology-cancer-approvals-safety-notifications", category: "oncology" },
    requiresHumanReview: true,
  },
  {
    type: "RESEARCH_CLINICAL_TRIAL",
    priority: 2,
    title: "Track ASCO/ASH abstracts for new PA-relevant trial data",
    description: "Search recent NEJM, JCO, Blood journal publications for Phase 3 trial results on drugs in our rules engine. Update nccnCategory and guidelineReferences.",
    context: { journals: ["NEJM", "JCO", "Blood", "Nature Medicine"], conferences: ["ASCO", "ASH", "EHA"] },
    requiresHumanReview: false,
  },
  {
    type: "ANALYZE_PA_OUTCOMES",
    priority: 2,
    title: "Weekly PA win/loss analysis",
    description: "Analyze PA approval/denial patterns from the last 7 days. Identify which missing criteria most often cause denials. Recommend engine.ts score weight adjustments.",
    requiresHumanReview: false,
  },
  {
    type: "DRAFT_WHITEPAPER_SECTION",
    priority: 3,
    title: "Draft 'Market Opportunity' whitepaper section",
    description: "Research PA burden statistics (CMS, AMA), denial rates by drug class, provider hours wasted on PA. Draft compelling market opportunity section with citations.",
    context: {
      targetLength: 800,
      keyStats: ["$93B in delayed care costs annually", "40% of PA denials are administrative", "2027 CMS mandate timeline"],
    },
    requiresHumanReview: true,
  },
  {
    type: "MONITOR_COMPETITOR",
    priority: 3,
    title: "Competitive landscape monitoring",
    description: "Track feature releases from Cohere Health, Infinitus, Waystar, Availity. Identify gaps we can fill faster. Report to devops agent.",
    context: {
      competitors: ["Cohere Health", "Infinitus Systems", "Waystar", "Availity", "CoverMyMeds", "RxBenefits"],
    },
    requiresHumanReview: false,
  },
  {
    type: "BUILD_DEMO_SCENARIO",
    priority: 1,
    title: "Build teclistamab investor demo scenario",
    description: "Create a complete demo patient: John Mitchell, 67yo, relapsed/refractory multiple myeloma after 4 prior lines. Build PA request, simulate Aetna denial, auto-generate appeal, show approval in 4 minutes. This is the Calacanis pitch moment.",
    context: {
      patient: { name: "John Mitchell", age: 67, diagnosis: "C90.02", drug: "teclistamab", payer: "Aetna" },
      flow: ["submit PA", "receive denial", "generate appeal with MajesTEC-1 data", "request P2P", "approval"],
    },
    requiresHumanReview: false,
  },
]

// ── Hermes task executor ──────────────────────────────────────────────
// This runs server-side or on AWS. Requires OPENAI_API_KEY.

export interface HermesExecutionResult {
  success: boolean
  output: string
  codeChanges?: Array<{ file: string; description: string; patch?: string }>
  citations?: string[]
  requiresPR: boolean
  prTitle?: string
  prBody?: string
}

export async function executeHermesTask(
  task: HermesTask,
  anthropicApiKey: string
): Promise<HermesExecutionResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic({ apiKey: anthropicApiKey })

  const systemPrompt = `You are Hermes, the autonomous research and build agent for OpenRx Health.

OpenRx is an AI-powered prior authorization platform built with:
- Next.js 14, TypeScript, Prisma/PostgreSQL
- FHIR R4, Da Vinci PAS v2.0
- 12 specialized AI agents (OpenClaw)
- MCP server exposing PA tools
- Payer rules engine at /lib/payer-rules/engine.ts

Your role:
1. Research the task thoroughly with specific, citable sources
2. Generate actionable outputs (code patches, report sections, PR descriptions)
3. Always include citations (DOI, trial name, FDA approval date, policy bulletin number)
4. Flag anything that requires human clinical review
5. Be concise and production-ready

CRITICAL: All code you write must be TypeScript-safe and follow the existing patterns.
Never hallucinate clinical data — if uncertain, say so explicitly.`

  const taskPrompt = buildTaskPrompt(task)

  // Use adaptive thinking for complex research/code-gen tasks
  const useAdaptiveThinking = [
    "RESEARCH_PAYER_POLICY",
    "RESEARCH_FDA_APPROVAL",
    "RESEARCH_CLINICAL_TRIAL",
    "UPDATE_PAYER_RULES",
    "GENERATE_FEATURE",
    "ANALYZE_PA_OUTCOMES",
  ].includes(task.type)

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8000,
      ...(useAdaptiveThinking && { thinking: { type: "adaptive" } }),
      system: systemPrompt,
      messages: [
        { role: "user", content: taskPrompt },
      ],
    })

    // Extract text from response (skip thinking blocks)
    const output = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")

    // Detect if output includes code changes
    const hasCodeBlock = output.includes("```typescript") || output.includes("```ts")
    const requiresPR = hasCodeBlock || task.type === "UPDATE_PAYER_RULES" || task.type === "GENERATE_FEATURE"

    // Extract citations
    const citationMatches = output.match(/\[[\d]+\]|\(doi:[^\)]+\)|(NEJM|JCO|Blood|JAMA|Lancet)\s+\d{4}/g)
    const citations = citationMatches ? Array.from(new Set(citationMatches)) : []

    let prTitle: string | undefined
    let prBody: string | undefined

    if (requiresPR) {
      prTitle = `[Hermes] ${task.title}`
      prBody = `## Automated Research Update

**Task:** ${task.title}
**Type:** ${task.type}
**Model:** claude-opus-4-6 (adaptive thinking: ${useAdaptiveThinking})
**Generated by:** Hermes Autonomous Agent

## Changes

${output}

## Citations

${citations.join("\n") || "See output above for references"}

---
*Requires human clinical review before merging* — ${task.requiresHumanReview ? "YES" : "NO"}

Generated: ${new Date().toISOString()}
`
    }

    return {
      success: true,
      output,
      requiresPR,
      prTitle,
      prBody,
      citations,
    }
  } catch (error) {
    return {
      success: false,
      output: `Task failed: ${String(error)}`,
      requiresPR: false,
    }
  }
}

function buildTaskPrompt(task: HermesTask): string {
  const ctx = task.context ? JSON.stringify(task.context, null, 2) : "No additional context"

  const typeInstructions: Record<HermesTaskType, string> = {
    RESEARCH_PAYER_POLICY: `
Research the latest PA policy for this payer and drug class.
Output:
1. Summary of current criteria (with source document reference)
2. Any changes from the previous known version
3. TypeScript patch to update /lib/payer-rules/engine.ts if criteria changed
4. Flag: requiresHumanReview = true for all clinical criteria changes`,

    RESEARCH_FDA_APPROVAL: `
Research recent FDA drug approvals in this category.
Output:
1. New approvals with: drug name, brand, HCPCS code (if assigned), indication, approval date
2. TypeScript code to add to DRUG_RULES array in /lib/payer-rules/engine.ts
3. NCCN category and key trial references
4. Flag any drugs requiring REMS`,

    RESEARCH_CLINICAL_TRIAL: `
Research recent high-impact trial results for drugs in our rules engine.
Output:
1. Trial name, drug, indication, key endpoints (OS, PFS, ORR)
2. Update guidelineReferences array in engine.ts
3. Recommend NCCN category update if warranted
4. Include DOI or PubMed ID for each citation`,

    UPDATE_PAYER_RULES: `
Generate a TypeScript patch for /lib/payer-rules/engine.ts based on the research findings.
Include: new criteria, updated step therapy, changed auth days, payer override entries.
Must be syntactically valid TypeScript.`,

    GENERATE_FEATURE: `
Design and implement the requested feature.
Output:
1. Implementation plan (5 steps max)
2. Complete TypeScript/React code
3. API routes if needed
4. Brief test cases`,

    DRAFT_WHITEPAPER_SECTION: `
Write a compelling, data-driven whitepaper section.
Requirements:
- ${task.context?.targetLength ?? 600} words
- Include specific statistics with citations
- Make the business case for OpenRx's approach
- Connect to the 2027 CMS mandate opportunity
- Investor-grade prose (Calacanis-level pitch quality)`,

    GENERATE_PA_APPEAL: `
Draft a complete PA appeal letter.
Include:
1. Formal appeal letter (physician-ready)
2. Clinical evidence summary with trial citations
3. Peer-to-peer review request language
4. Documentation checklist`,

    ANALYZE_PA_OUTCOMES: `
Analyze the PA outcome patterns.
Output:
1. Most common denial reasons by drug class
2. Criteria most often missing at submission
3. Recommended score weight adjustments for engine.ts
4. Top 3 process improvements to increase approval rate`,

    MONITOR_COMPETITOR: `
Research competitor feature releases and positioning.
Output:
1. Feature comparison matrix (us vs competitors)
2. Gaps we can fill in the next 30 days
3. Unique differentiators to emphasize in investor pitch
4. Recommended features to build next`,

    BUILD_DEMO_SCENARIO: `
Build a complete, compelling investor demo scenario.
Output:
1. Patient profile JSON (matches LivePatient type)
2. PA request data
3. Step-by-step demo script (clinician → AI → approval)
4. Talking points for each step
5. "wow moment" callouts for investors`,
  }

  return `
Task: ${task.title}
Type: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

Context:
${ctx}

Instructions:
${typeInstructions[task.type]}

Be specific, cite sources, and produce production-ready output.
`.trim()
}

// ── Task queue (in-memory for dev, Redis in production) ───────────────

const taskQueue: HermesTask[] = []

export function queueHermesTask(task: Omit<HermesTask, "id" | "status" | "createdAt">): HermesTask {
  const fullTask: HermesTask = {
    ...task,
    id: `hermes-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    status: "queued",
    createdAt: new Date().toISOString(),
  }
  taskQueue.unshift(fullTask)
  if (taskQueue.length > 100) taskQueue.pop()
  return fullTask
}

export function getHermesQueue(limit = 20): HermesTask[] {
  return taskQueue.slice(0, limit)
}

export function getHermesTask(id: string): HermesTask | undefined {
  return taskQueue.find((t) => t.id === id)
}

// Pre-queue the scheduled tasks
for (const task of SCHEDULED_TASKS) {
  queueHermesTask(task)
}
