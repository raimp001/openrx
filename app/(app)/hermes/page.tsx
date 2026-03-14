"use client"

import { useState, useEffect } from "react"
import {
  Bot, Zap, CheckCircle2, XCircle, Clock, Play,
  RefreshCw, ChevronRight, BookOpen, FileCode,
  AlertTriangle, Eye, Users, Cpu, TrendingUp, Telescope,
  FlaskConical, Sparkles, Shield, ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DEMO_PATIENTS, type DemoPatient } from "@/lib/hermes/demo-patients"
import { SCHEDULED_TASKS, type HermesTask, type HermesTaskType } from "@/lib/hermes/agent"

type Tab = "queue" | "demo" | "about"
type TaskStatus = HermesTask["status"]

const TASK_TYPE_LABELS: Record<HermesTaskType, { label: string; icon: React.ElementType; color: string }> = {
  RESEARCH_PAYER_POLICY:    { label: "Payer Policy", icon: Shield, color: "text-blue-400" },
  RESEARCH_FDA_APPROVAL:    { label: "FDA Approval", icon: FlaskConical, color: "text-green-400" },
  RESEARCH_CLINICAL_TRIAL:  { label: "Clinical Trial", icon: Telescope, color: "text-purple-400" },
  UPDATE_PAYER_RULES:       { label: "Rules Update", icon: FileCode, color: "text-amber-400" },
  GENERATE_FEATURE:         { label: "Code Gen", icon: Zap, color: "text-accent" },
  DRAFT_WHITEPAPER_SECTION: { label: "Whitepaper", icon: BookOpen, color: "text-warm-500" },
  GENERATE_PA_APPEAL:       { label: "Appeal Gen", icon: CheckCircle2, color: "text-soft-red" },
  ANALYZE_PA_OUTCOMES:      { label: "PA Analytics", icon: TrendingUp, color: "text-terra" },
  MONITOR_COMPETITOR:       { label: "Competitive Intel", icon: Eye, color: "text-cloudy" },
  BUILD_DEMO_SCENARIO:      { label: "Demo Build", icon: Sparkles, color: "text-yellow-400" },
}

function TaskCard({ task, onRun, running }: { task: HermesTask | typeof SCHEDULED_TASKS[0]; onRun?: (t: HermesTask) => void; running?: string }) {
  const fullTask = task as HermesTask
  const meta = TASK_TYPE_LABELS[task.type]
  const Icon = meta.icon
  const isRunning = "id" in fullTask && running === fullTask.id
  const status: TaskStatus = "status" in fullTask ? fullTask.status : "queued"

  return (
    <div className={cn(
      "bg-pampas rounded-2xl border p-4 transition",
      status === "completed" ? "border-accent/20" : status === "failed" ? "border-soft-red/20" : status === "running" || isRunning ? "border-yellow-700/30 bg-yellow-900/5" : "border-sand"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          status === "completed" ? "bg-accent/10" : status === "failed" ? "bg-soft-red/10" : "bg-sand/60"
        )}>
          {isRunning ? (
            <RefreshCw size={14} className="text-yellow-400 animate-spin" />
          ) : status === "completed" ? (
            <CheckCircle2 size={14} className="text-accent" />
          ) : status === "failed" ? (
            <XCircle size={14} className="text-soft-red" />
          ) : (
            <Icon size={14} className={meta.color} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-warm-800">{task.title}</span>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full bg-sand/60", meta.color)}>
              {meta.label}
            </span>
            {task.requiresHumanReview && (
              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-900/20 px-1.5 py-0.5 rounded-full">
                Needs Review
              </span>
            )}
            <span className={cn(
              "text-[10px] font-bold ml-auto",
              "priority" in task && task.priority === 1 ? "text-soft-red" : "priority" in task && task.priority === 2 ? "text-yellow-400" : "text-warm-500"
            )}>
              {"priority" in task ? `P${task.priority}` : ""}
            </span>
          </div>
          <p className="text-[11px] text-warm-500 mt-1 leading-relaxed line-clamp-2">{task.description}</p>

          {"result" in fullTask && fullTask.result && status === "completed" && (
            <div className="mt-2 p-2.5 bg-accent/5 rounded-lg border border-accent/10 max-h-24 overflow-y-auto">
              <p className="text-[10px] text-warm-600 whitespace-pre-wrap leading-relaxed">{fullTask.result.slice(0, 300)}{fullTask.result.length > 300 ? "..." : ""}</p>
            </div>
          )}

          {"error" in fullTask && fullTask.error && status === "failed" && (
            <div className="mt-2 p-2.5 bg-soft-red/5 rounded-lg border border-soft-red/10">
              <p className="text-[10px] text-soft-red">{fullTask.error}</p>
            </div>
          )}

          {"id" in fullTask && onRun && (status === "queued" || status === "failed") && (
            <button
              onClick={() => onRun(fullTask)}
              disabled={!!running}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-accent hover:text-accent/80 disabled:opacity-40 transition"
            >
              <Play size={10} />
              {running ? "Running another task..." : "Run with GPT-4o"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DemoPatientCard({ patient, expanded, onToggle }: { patient: DemoPatient; expanded: boolean; onToggle: () => void }) {
  const totalTime = patient.paFlow.reduce((s, step) => s + step.timeSeconds, 0)
  return (
    <div className="bg-pampas rounded-2xl border border-sand overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 p-4 hover:bg-sand/20 transition text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-warm-800 flex items-center justify-center shrink-0 text-cream font-bold text-sm">
          {patient.name.charAt(0)}{patient.name.split(" ")[1]?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-warm-800">{patient.name}</span>
            <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {patient.payer}
            </span>
          </div>
          <p className="text-xs text-warm-600 mt-0.5">{patient.diagnosis}</p>
          <p className="text-xs text-warm-500 mt-0.5">{patient.drug}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-warm-400">{patient.paFlow.length} steps</span>
            <span className="text-[10px] text-warm-400">{totalTime}s total</span>
            <span className="text-[10px] font-mono text-warm-400">{patient.hcpcsCode}</span>
          </div>
        </div>
        <ChevronRight size={14} className={cn("text-warm-400 shrink-0 transition-transform mt-1", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="border-t border-sand">
          {/* Wow moment */}
          <div className="px-4 py-3 bg-warm-800/5 border-b border-sand">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={12} className="text-yellow-400" />
              <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide">Wow Moment</span>
            </div>
            <p className="text-xs text-warm-700 italic">&ldquo;{patient.wowMoment}&rdquo;</p>
          </div>

          {/* PA flow steps */}
          <div className="divide-y divide-sand/40">
            {patient.paFlow.map((step) => (
              <div
                key={step.step}
                className={cn(
                  "px-4 py-3 flex items-start gap-3",
                  step.highlight && "bg-accent/3 border-l-2 border-l-accent"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5",
                  step.actor === "rex" ? "bg-terra/10 text-terra" :
                  step.actor === "payer" ? "bg-blue-900/20 text-blue-400" :
                  step.actor === "hermes" ? "bg-purple-900/20 text-purple-400" :
                  "bg-sand/60 text-warm-600"
                )}>
                  {step.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                      step.actor === "rex" ? "text-terra bg-terra/10" :
                      step.actor === "payer" ? "text-blue-400 bg-blue-900/20" :
                      step.actor === "hermes" ? "text-purple-400 bg-purple-900/20" :
                      "text-warm-500 bg-sand/50"
                    )}>
                      {step.actor}
                    </span>
                    <span className="text-xs font-semibold text-warm-800">{step.action}</span>
                    {step.timeSeconds > 0 && (
                      <span className="text-[10px] text-warm-400 ml-auto">{step.timeSeconds}s</span>
                    )}
                    {step.highlight && (
                      <Sparkles size={10} className="text-yellow-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-warm-500 mt-1 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Talking points */}
          <div className="px-4 py-3 bg-sand/20 border-t border-sand">
            <p className="text-[10px] font-bold text-warm-600 uppercase tracking-wide mb-2">Investor Talking Points</p>
            <ul className="space-y-1">
              {patient.talkingPoints.map((pt, i) => (
                <li key={i} className="text-[11px] text-warm-600 flex items-start gap-1.5">
                  <ChevronRight size={10} className="shrink-0 mt-0.5 text-accent" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HermesPage() {
  const [tab, setTab] = useState<Tab>("queue")
  const [queue, setQueue] = useState<HermesTask[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [expandedDemo, setExpandedDemo] = useState<string | null>("demo-mitchell")

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/hermes")
      const data = await res.json() as { queue: HermesTask[] }
      setQueue(data.queue ?? [])
    } catch {
      // silently fail — queue is pre-seeded from static data anyway
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchQueue()
  }, [])

  const runTask = async (task: HermesTask) => {
    setRunning(task.id)
    try {
      const res = await fetch("/api/hermes?action=run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      })
      const data = await res.json() as { task: HermesTask }
      setQueue((prev) => prev.map((t) => t.id === task.id ? data.task : t))
    } catch {
      setQueue((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "failed" as const, error: "Network error" } : t))
    } finally {
      setRunning(null)
    }
  }

  const queueStats = {
    total: queue.length,
    queued: queue.filter((t) => t.status === "queued").length,
    completed: queue.filter((t) => t.status === "completed").length,
    failed: queue.filter((t) => t.status === "failed").length,
    running: queue.filter((t) => t.status === "running").length,
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-serif text-warm-800">Hermes</h1>
            <span className="text-xs font-bold text-purple-400 bg-purple-900/20 border border-purple-700/30 px-2.5 py-1 rounded-full">Autonomous Agent</span>
          </div>
          <p className="text-sm text-warm-500 ml-12">
            Research &amp; build pipeline — payer policy monitoring, FDA approvals, whitepaper generation, and demo scenarios
          </p>
        </div>
        <button
          onClick={() => void fetchQueue()}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-bold text-warm-600 hover:text-warm-800 bg-sand/50 hover:bg-sand px-3 py-2 rounded-xl border border-sand transition"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {([
          { label: "Total Tasks", value: queueStats.total, color: "text-warm-800" },
          { label: "Queued", value: queueStats.queued, color: "text-yellow-400" },
          { label: "Running", value: queueStats.running, color: "text-blue-400" },
          { label: "Completed", value: queueStats.completed, color: "text-accent" },
          { label: "Failed", value: queueStats.failed, color: "text-soft-red" },
        ] as const).map((s) => (
          <div key={s.label} className="bg-pampas rounded-2xl border border-sand p-3 text-center">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-[10px] text-warm-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-sand/30 rounded-xl p-1 border border-sand w-fit">
        {([
          { id: "queue" as Tab, label: "Task Queue", icon: Cpu },
          { id: "demo" as Tab, label: "Demo Scenarios", icon: Users },
          { id: "about" as Tab, label: "Architecture", icon: BookOpen },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === id
                ? "bg-warm-800 text-cream shadow-sm"
                : "text-warm-500 hover:text-warm-700 hover:bg-sand/50"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Task Queue ── */}
      {tab === "queue" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-warm-700">Scheduled &amp; Active Tasks</h2>
            <span className="text-xs text-warm-500">
              {queue.length > 0 ? `${queue.length} tasks loaded from API` : `${SCHEDULED_TASKS.length} pre-scheduled tasks`}
            </span>
          </div>
          {(queue.length > 0 ? queue : SCHEDULED_TASKS.map((t, i) => ({ ...t, id: `static-${i}`, status: "queued" as const, createdAt: new Date().toISOString() }))).map((task, i) => (
            <TaskCard
              key={"id" in task ? task.id : i}
              task={task as HermesTask}
              onRun={queue.length > 0 ? runTask : undefined}
              running={running ?? undefined}
            />
          ))}
          {queue.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-xs text-warm-400">Showing pre-scheduled tasks (static preview)</p>
              <p className="text-[11px] text-warm-400 mt-1">The /api/hermes endpoint will load live tasks with execution capability</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Demo Scenarios ── */}
      {tab === "demo" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-warm-700 mb-1">Investor Demo Scenarios</h2>
            <p className="text-xs text-warm-500">
              Three high-fidelity oncology demos for investor presentations. Each shows the full PA workflow:
              submission → denial → appeal → approval. Script timings are validated against real PA workflows.
            </p>
          </div>
          {DEMO_PATIENTS.map((patient) => (
            <DemoPatientCard
              key={patient.id}
              patient={patient}
              expanded={expandedDemo === patient.id}
              onToggle={() => setExpandedDemo(expandedDemo === patient.id ? null : patient.id)}
            />
          ))}
          <div className="bg-pampas rounded-2xl border border-sand p-4">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink size={13} className="text-accent" />
              <h3 className="text-xs font-bold text-warm-700">API Access</h3>
            </div>
            <div className="space-y-1.5 text-[11px] font-mono text-warm-600">
              <p className="bg-sand/50 px-3 py-1.5 rounded">GET /api/hermes/demo</p>
              <p className="bg-sand/50 px-3 py-1.5 rounded">GET /api/hermes/demo?id=demo-mitchell</p>
              <p className="bg-sand/50 px-3 py-1.5 rounded">GET /api/hermes/demo?id=demo-mitchell&format=script</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Architecture ── */}
      {tab === "about" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-pampas rounded-2xl border border-sand p-5 space-y-4">
            <h2 className="text-sm font-bold text-warm-800">Hermes Architecture</h2>
            <div className="space-y-3 text-xs text-warm-600">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-900/20 flex items-center justify-center shrink-0">
                  <Cpu size={12} className="text-purple-400" />
                </div>
                <div>
                  <p className="font-bold text-warm-700">Task Queue</p>
                  <p className="text-[11px] mt-0.5">In-memory (dev) or Redis (prod). Tasks are dequeued by priority (P1 → P3). Single worker per task type to prevent rate-limiting.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-900/20 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-warm-700">GPT-4o Executor</p>
                  <p className="text-[11px] mt-0.5">Each task runs against a structured system prompt tailored to the task type. Temperature 0.3 for research, 0.7 for creative (whitepaper).</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-green-900/20 flex items-center justify-center shrink-0">
                  <FileCode size={12} className="text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-warm-700">Code Generation</p>
                  <p className="text-[11px] mt-0.5">When output contains TypeScript/TSX blocks, Hermes generates a GitHub PR with the patch. Human-review gate before merge.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-900/20 flex items-center justify-center shrink-0">
                  <AlertTriangle size={12} className="text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-warm-700">Human Review Gate</p>
                  <p className="text-[11px] mt-0.5">Clinical criteria changes always require MD review before engine.ts is updated. Status: <code className="bg-sand/50 px-1 rounded">review_needed</code> until approved.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-pampas rounded-2xl border border-sand p-5 space-y-4">
            <h2 className="text-sm font-bold text-warm-800">Deployment Plan</h2>
            <div className="space-y-3">
              {[
                { env: "Development", runtime: "In-process, TypeScript", queue: "In-memory array", cron: "Manual via API", status: "active" },
                { env: "Production", runtime: "AWS EC2 t3.medium", queue: "Redis + Bull queue", cron: "AWS EventBridge (cron)", status: "planned" },
              ].map((d) => (
                <div key={d.env} className="p-3 bg-white/40 rounded-xl border border-sand">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-warm-800">{d.env}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      d.status === "active" ? "bg-accent/10 text-accent" : "bg-sand/60 text-warm-500"
                    )}>
                      {d.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-warm-500">
                    <p>Runtime: {d.runtime}</p>
                    <p>Queue: {d.queue}</p>
                    <p>Cron: {d.cron}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-purple-900/10 rounded-xl border border-purple-700/20">
              <h3 className="text-xs font-bold text-purple-400 mb-2">Task Types</h3>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(TASK_TYPE_LABELS).map(([type, meta]) => {
                  const Icon = meta.icon
                  return (
                    <div key={type} className="flex items-center gap-1.5">
                      <Icon size={10} className={meta.color} />
                      <span className="text-[10px] text-warm-500">{meta.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="text-[11px] text-warm-400 leading-relaxed">
              Hermes runs as a PM2-managed process on AWS. It wakes every 6 hours (or on webhook trigger)
              to process the highest-priority queued tasks. Results with code changes auto-open GitHub PRs.
              Clinical data changes require MD approval before engine.ts is patched.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
