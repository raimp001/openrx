/**
 * Hermes Agent API
 * GET  /api/hermes         — list task queue
 * POST /api/hermes         — queue a new task
 * POST /api/hermes/run     — execute a specific task (requires OPENAI_API_KEY)
 */

import { NextRequest, NextResponse } from "next/server"
import {
  queueHermesTask,
  getHermesQueue,
  getHermesTask,
  executeHermesTask,
  type HermesTaskType,
} from "@/lib/hermes/agent"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (id) {
    const task = getHermesTask(id)
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })
    return NextResponse.json(task)
  }

  const queue = getHermesQueue(30)
  return NextResponse.json({
    queue,
    total: queue.length,
    byStatus: {
      queued: queue.filter((t) => t.status === "queued").length,
      running: queue.filter((t) => t.status === "running").length,
      completed: queue.filter((t) => t.status === "completed").length,
      failed: queue.filter((t) => t.status === "failed").length,
    },
  })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  const body = await req.json() as {
    type?: HermesTaskType
    title?: string
    description?: string
    context?: Record<string, unknown>
    priority?: 1 | 2 | 3
    requiresHumanReview?: boolean
    taskId?: string
  }

  // Run a specific task
  if (action === "run") {
    const taskId = body.taskId
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 })

    const task = getHermesTask(taskId)
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 })

    task.status = "running"
    task.startedAt = new Date().toISOString()

    try {
      const result = await executeHermesTask(task, apiKey)
      task.status = result.success
        ? (task.requiresHumanReview ? "review_needed" : "completed")
        : "failed"
      task.result = result.output
      task.completedAt = new Date().toISOString()
      if (!result.success) task.error = result.output

      return NextResponse.json({ task, result })
    } catch (err) {
      task.status = "failed"
      task.error = String(err)
      task.completedAt = new Date().toISOString()
      return NextResponse.json({ task, error: String(err) }, { status: 500 })
    }
  }

  // Queue a new task
  if (!body.type || !body.title || !body.description) {
    return NextResponse.json({ error: "type, title, and description required" }, { status: 400 })
  }

  const task = queueHermesTask({
    type: body.type,
    title: body.title,
    description: body.description,
    context: body.context,
    priority: body.priority ?? 2,
    requiresHumanReview: body.requiresHumanReview ?? true,
  })

  return NextResponse.json({ task, message: "Task queued successfully" }, { status: 201 })
}
