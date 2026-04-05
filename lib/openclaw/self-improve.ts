// ── Self-Improvement Engine ────────────────────────────────
// Inspired by karpathy/autoresearch: agents iteratively propose,
// score, validate, and deploy improvements. Each candidate is
// evaluated against an objective before promotion — matching
// how autoresearch validates strategy candidates via backtest
// before promoting them to paper/live.
//
// Loop: Agent suggests → peers vote → objective score → validate → deploy
// Bolt (DevOps) coordinates the improvement pipeline.

import fs from "fs"
import path from "path"
import type { AgentId } from "./config"

export interface Improvement {
  id: string
  suggestedBy: AgentId
  category: "feature" | "bugfix" | "performance" | "ux" | "security" | "integration"
  title: string
  description: string
  priority: "low" | "medium" | "high" | "critical"
  status: "suggested" | "approved" | "in_progress" | "deployed" | "rejected"
  impact: string
  createdAt: string
  resolvedAt?: string
  votes: AgentId[]
  // Autoresearch-inspired objective scoring
  objectiveScore?: number        // 0-100, computed from impact dimensions
  validationResult?: "pass" | "fail" | "pending"
  validationNotes?: string       // Why it passed or failed
  experimentCost?: "cheap" | "moderate" | "expensive"  // Prefer cheap experiments
  iterationCount?: number        // How many refinement cycles
}

export interface ImprovementMetrics {
  totalSuggested: number
  totalDeployed: number
  totalRejected: number
  averageResolutionDays: number
  averageObjectiveScore: number
  validationPassRate: number
  topContributors: { agentId: AgentId; count: number }[]
  recentImprovements: Improvement[]
}

// ── Persistent store ────────────────────────────────────────
// Server-side: JSON file at OPENRX_IMPROVEMENTS_PATH or a default path.
// Falls back gracefully when the filesystem is read-only.

const STORE_PATH = process.env.OPENRX_IMPROVEMENTS_PATH
  || path.join(process.cwd(), "data", "openrx-improvements.json")

function loadImprovements(): Improvement[] {
  // Browser — should not happen for server components, but guard anyway
  if (typeof window !== "undefined") return getDefaultImprovements()
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8")
      return JSON.parse(raw) as Improvement[]
    }
  } catch { /* first run or read error */ }
  return getDefaultImprovements()
}

function persistImprovements(items: Improvement[]): void {
  if (typeof window !== "undefined") return
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(items, null, 2), "utf8")
  } catch (err) {
    console.warn("Could not persist improvements to disk:", err)
  }
}

const improvements: Improvement[] = loadImprovements()

function generateId(): string {
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** Suggest a new improvement */
export function suggestImprovement(params: {
  agentId: AgentId
  category: Improvement["category"]
  title: string
  description: string
  priority?: Improvement["priority"]
  impact: string
}): Improvement {
  const improvement: Improvement = {
    id: generateId(),
    suggestedBy: params.agentId,
    category: params.category,
    title: params.title,
    description: params.description,
    priority: params.priority || "medium",
    status: "suggested",
    impact: params.impact,
    createdAt: new Date().toISOString(),
    votes: [params.agentId],
  }

  improvements.push(improvement)
  persistImprovements(improvements)
  return improvement
}

/** Vote for an improvement (agents can endorse each other's suggestions) */
export function voteForImprovement(improvementId: string, agentId: AgentId): boolean {
  const imp = improvements.find((i) => i.id === improvementId)
  if (!imp || imp.votes.includes(agentId)) return false
  imp.votes.push(agentId)
  // Auto-approve if 3+ agents vote for it
  if (imp.votes.length >= 3 && imp.status === "suggested") {
    imp.status = "approved"
  }
  persistImprovements(improvements)
  return true
}

/** Update improvement status (typically by Bolt/DevOps) */
export function updateImprovementStatus(
  improvementId: string,
  status: Improvement["status"]
): Improvement | null {
  const imp = improvements.find((i) => i.id === improvementId)
  if (!imp) return null
  imp.status = status
  if (status === "deployed" || status === "rejected") {
    imp.resolvedAt = new Date().toISOString()
  }
  persistImprovements(improvements)
  return imp
}

/** Get all improvements */
export function getImprovements(filter?: {
  status?: Improvement["status"]
  category?: Improvement["category"]
  agentId?: AgentId
}): Improvement[] {
  let result = [...improvements]
  if (filter?.status) result = result.filter((i) => i.status === filter.status)
  if (filter?.category) result = result.filter((i) => i.category === filter.category)
  if (filter?.agentId) result = result.filter((i) => i.suggestedBy === filter.agentId)
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** Get improvement metrics */
export function getImprovementMetrics(): ImprovementMetrics {
  const deployed = improvements.filter((i) => i.status === "deployed")
  const rejected = improvements.filter((i) => i.status === "rejected")

  // Calculate average resolution time
  const resolved = [...deployed, ...rejected].filter((i) => i.resolvedAt)
  const avgDays =
    resolved.length > 0
      ? resolved.reduce((sum, i) => {
          const created = new Date(i.createdAt).getTime()
          const resolvedAt = new Date(i.resolvedAt!).getTime()
          return sum + (resolvedAt - created) / 86400000
        }, 0) / resolved.length
      : 0

  // Top contributors
  const counts = new Map<string, number>()
  improvements.forEach((i) => {
    counts.set(i.suggestedBy, (counts.get(i.suggestedBy) || 0) + 1)
  })
  const topContributors = Array.from(counts.entries())
    .map(([agentId, count]) => ({ agentId: agentId as AgentId, count }))
    .sort((a, b) => b.count - a.count)

  // Autoresearch-inspired metrics
  const scored = improvements.filter((i) => i.objectiveScore !== undefined)
  const avgScore = scored.length > 0
    ? scored.reduce((sum, i) => sum + (i.objectiveScore || 0), 0) / scored.length
    : 0
  const validated = improvements.filter((i) => i.validationResult && i.validationResult !== "pending")
  const passRate = validated.length > 0
    ? validated.filter((i) => i.validationResult === "pass").length / validated.length
    : 0

  return {
    totalSuggested: improvements.length,
    totalDeployed: deployed.length,
    totalRejected: rejected.length,
    averageResolutionDays: Math.round(avgDays * 10) / 10,
    averageObjectiveScore: Math.round(avgScore * 10) / 10,
    validationPassRate: Math.round(passRate * 100),
    topContributors,
    recentImprovements: improvements.slice(-5).reverse(),
  }
}

// ── Autoresearch-inspired objective scoring ────────────────
// Like karpathy/autoresearch validates strategy candidates against
// an objective before promotion, we score improvements on multiple
// dimensions and only promote those that beat the threshold.

/** Score an improvement on a 0-100 scale across impact dimensions */
export function scoreImprovement(imp: Improvement): number {
  let score = 0

  // Priority weight (30 points max)
  const priorityScores = { critical: 30, high: 22, medium: 14, low: 6 }
  score += priorityScores[imp.priority]

  // Category weight — security/bugfix get bonus (20 points max)
  const categoryScores = { security: 20, bugfix: 18, performance: 14, ux: 12, feature: 10, integration: 8 }
  score += categoryScores[imp.category]

  // Consensus signal — more votes = more confidence (25 points max)
  score += Math.min(25, imp.votes.length * 5)

  // Prefer cheap experiments (15 points max) — Karpathy: "keep each experiment cheap"
  const costScores = { cheap: 15, moderate: 10, expensive: 5, undefined: 10 }
  score += costScores[imp.experimentCost || "undefined"]

  // Iteration refinement bonus (10 points max) — more iterations = better refined
  score += Math.min(10, (imp.iterationCount || 0) * 2)

  return Math.min(100, score)
}

/** Validate an improvement candidate before deployment.
 *  Like autoresearch backtesting: only promote if it beats the threshold. */
export function validateImprovement(improvementId: string, result: "pass" | "fail", notes?: string): Improvement | null {
  const imp = improvements.find((i) => i.id === improvementId)
  if (!imp) return null
  imp.validationResult = result
  imp.validationNotes = notes || ""
  imp.objectiveScore = scoreImprovement(imp)

  // Auto-approve validated improvements with high scores (like autoresearch promoting winners)
  if (result === "pass" && imp.objectiveScore >= 60 && imp.status === "suggested") {
    imp.status = "approved"
  }
  // Reject failed validations
  if (result === "fail") {
    imp.status = "rejected"
    imp.resolvedAt = new Date().toISOString()
  }

  persistImprovements(improvements)
  return imp
}

/** Refine an improvement (increment iteration count, update description).
 *  Like autoresearch: modify train.py, re-run, keep only improvements. */
export function refineImprovement(improvementId: string, updates: { description?: string; impact?: string }): Improvement | null {
  const imp = improvements.find((i) => i.id === improvementId)
  if (!imp || imp.status === "deployed" || imp.status === "rejected") return null
  imp.iterationCount = (imp.iterationCount || 0) + 1
  if (updates.description) imp.description = updates.description
  if (updates.impact) imp.impact = updates.impact
  // Reset validation on refinement — needs re-evaluation
  imp.validationResult = "pending"
  imp.objectiveScore = scoreImprovement(imp)
  persistImprovements(improvements)
  return imp
}

/** Get improvements ranked by objective score (highest first) */
export function getRankedImprovements(filter?: { status?: Improvement["status"] }): Improvement[] {
  let result = [...improvements]
  if (filter?.status) result = result.filter((i) => i.status === filter.status)
  // Score any unscored improvements
  for (const imp of result) {
    if (imp.objectiveScore === undefined) imp.objectiveScore = scoreImprovement(imp)
  }
  return result.sort((a, b) => (b.objectiveScore || 0) - (a.objectiveScore || 0))
}

/** Agents proactively generate improvements based on usage patterns */
export function runImprovementCycle(): Improvement[] {
  const newSuggestions: Improvement[] = []

  // Maya (Rx) suggests medication-related improvements
  const hasRxImprovement = improvements.some(
    (i) => i.suggestedBy === "rx" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasRxImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "rx",
        category: "feature",
        title: "Drug interaction database expansion",
        description: "Add comprehensive FDA drug-drug interaction checking with severity levels and alternative suggestions.",
        impact: "Prevents adverse drug events for patients on multiple medications",
      })
    )
  }

  // Vera (Billing) suggests billing improvements
  const hasBillingImprovement = improvements.some(
    (i) => i.suggestedBy === "billing" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasBillingImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "billing",
        category: "feature",
        title: "Automated denial pattern detection",
        description: "ML-based detection of claim denial patterns to preemptively fix submissions before they get denied.",
        impact: "Reduces claim denials by an estimated 40%",
      })
    )
  }

  // Cal (Scheduling) suggests scheduling improvements
  const hasCalImprovement = improvements.some(
    (i) => i.suggestedBy === "scheduling" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasCalImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "scheduling",
        category: "ux",
        title: "Smart scheduling with travel time",
        description: "Factor in patient travel time and traffic patterns when suggesting appointment slots.",
        impact: "Reduces no-shows by accounting for commute difficulty",
      })
    )
  }

  // Ivy (Wellness) suggests preventive care improvements
  const hasWellnessImprovement = improvements.some(
    (i) => i.suggestedBy === "wellness" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasWellnessImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "wellness",
        category: "integration",
        title: "Apple Health / Google Fit sync",
        description: "Real-time sync with patient wearables for continuous vitals monitoring and proactive alerts.",
        impact: "Enables early detection of health changes via continuous monitoring",
      })
    )
  }

  // Bolt (DevOps) suggests infrastructure improvements
  const hasDevOpsImprovement = improvements.some(
    (i) => i.suggestedBy === "devops" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasDevOpsImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "devops",
        category: "performance",
        title: "Edge caching for drug prices",
        description: "Cache drug pricing API responses at the edge to reduce latency from 800ms to <50ms.",
        impact: "10x faster drug price lookups for patients",
      })
    )
  }

  // Nova (Triage) suggests triage improvements
  const hasTriageImprovement = improvements.some(
    (i) => i.suggestedBy === "triage" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasTriageImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "triage",
        category: "feature",
        title: "Photo-based symptom assessment",
        description: "Allow patients to upload photos of rashes, wounds, or swelling for visual triage assessment.",
        impact: "More accurate remote triage for visible conditions",
      })
    )
  }

  // Rex (PA) suggests prior auth improvements
  const hasPAImprovement = improvements.some(
    (i) => i.suggestedBy === "prior-auth" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasPAImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "prior-auth",
        category: "feature",
        title: "Predictive PA requirement detection",
        description: "Predict which orders will need prior auth before the physician submits, pre-filling forms proactively.",
        impact: "Eliminates PA-related delays by starting the process early",
      })
    )
  }

  // Quinn (Screening) suggests preventive risk improvements
  const hasScreeningImprovement = improvements.some(
    (i) => i.suggestedBy === "screening" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasScreeningImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "screening",
        category: "feature",
        title: "Personalized risk trajectory forecasting",
        description: "Forecast 90-day risk movement using vitals, labs, and adherence trends.",
        impact: "Helps patients act before risk moves from moderate to high",
      })
    )
  }

  // Orion (Second Opinion) suggests care-plan explainability improvements
  const hasSecondOpinionImprovement = improvements.some(
    (i) => i.suggestedBy === "second-opinion" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasSecondOpinionImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "second-opinion",
        category: "ux",
        title: "Clinician-ready second-opinion brief export",
        description: "Generate concise visit briefs with risks, key questions, and open decisions.",
        impact: "Improves specialist visit efficiency and shared decision-making",
      })
    )
  }

  // Lyra (Trials) suggests enrollment-readiness automation
  const hasTrialsImprovement = improvements.some(
    (i) => i.suggestedBy === "trials" && i.status !== "deployed" && i.status !== "rejected"
  )
  if (!hasTrialsImprovement) {
    newSuggestions.push(
      suggestImprovement({
        agentId: "trials",
        category: "integration",
        title: "Trial eligibility packet automation",
        description: "Auto-assemble medication lists, labs, and diagnosis summaries for trial coordinators.",
        impact: "Cuts trial pre-screening prep time for patients and staff",
      })
    )
  }

  return newSuggestions
}

// ── Default improvements (seeded) ──────────────────────────

function getDefaultImprovements(): Improvement[] {
  const now = new Date()
  return [
    {
      id: "imp-seed-001",
      suggestedBy: "devops" as AgentId,
      category: "performance",
      title: "Optimized API response caching",
      description: "Added edge caching for NPI registry and pharmacy search APIs to reduce latency.",
      priority: "high",
      status: "deployed",
      impact: "API response times reduced by 60%",
      createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
      resolvedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
      votes: ["devops" as AgentId, "coordinator" as AgentId, "scheduling" as AgentId],
    },
    {
      id: "imp-seed-002",
      suggestedBy: "billing" as AgentId,
      category: "feature",
      title: "Claim error pattern library",
      description: "Built a library of 50+ common claim submission errors for pre-screening.",
      priority: "high",
      status: "deployed",
      impact: "Catches billing errors before submission, saving patients money",
      createdAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
      resolvedAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
      votes: ["billing" as AgentId, "coordinator" as AgentId, "rx" as AgentId, "prior-auth" as AgentId],
    },
    {
      id: "imp-seed-003",
      suggestedBy: "rx" as AgentId,
      category: "feature",
      title: "Smart refill coordination",
      description: "Proactive refill requests 7 days before medication runs out with pharmacy confirmation.",
      priority: "medium",
      status: "deployed",
      impact: "Patients never miss a refill window",
      createdAt: new Date(now.getTime() - 21 * 86400000).toISOString(),
      resolvedAt: new Date(now.getTime() - 18 * 86400000).toISOString(),
      votes: ["rx" as AgentId, "coordinator" as AgentId],
    },
    {
      id: "imp-seed-004",
      suggestedBy: "wellness" as AgentId,
      category: "integration",
      title: "USPSTF screening engine v2",
      description: "Updated screening recommendations with 2026 USPSTF guidelines and risk-factor weighting.",
      priority: "medium",
      status: "approved",
      impact: "More accurate preventive care recommendations for all age groups",
      createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
      votes: ["wellness" as AgentId, "triage" as AgentId, "coordinator" as AgentId],
    },
    {
      id: "imp-seed-005",
      suggestedBy: "coordinator" as AgentId,
      category: "ux",
      title: "Multi-agent conversation threading",
      description: "Show patients which agents are collaborating on their request with real-time status.",
      priority: "high",
      status: "in_progress",
      impact: "Transparency into how the AI care team works together",
      createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      votes: ["coordinator" as AgentId, "onboarding" as AgentId],
    },
  ]
}
