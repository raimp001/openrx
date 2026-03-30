"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { cn } from "@/lib/utils"

/**
 * Shrinkwrap chat bubble — powered by @chenglou/pretext.
 *
 * Uses Pretext's two-phase text measurement to compute the tightest bubble
 * width that preserves line count. prepare() segments + measures text via
 * canvas once; layout() does pure arithmetic per resize (~0.0002ms).
 *
 * Handles CJK, emoji, bidi, Thai, and every script Intl.Segmenter supports.
 */

// Dynamic import for Pretext (browser-only, needs canvas)
let pretextModule: typeof import("@chenglou/pretext") | null = null
let pretextLoading: Promise<typeof import("@chenglou/pretext")> | null = null

function loadPretext(): Promise<typeof import("@chenglou/pretext")> {
  if (pretextModule) return Promise.resolve(pretextModule)
  if (pretextLoading) return pretextLoading
  pretextLoading = import("@chenglou/pretext").then((mod) => {
    pretextModule = mod
    return mod
  })
  return pretextLoading
}

function shrinkwrapWithPretext(
  prepare: typeof import("@chenglou/pretext")["prepare"],
  layout: typeof import("@chenglou/pretext")["layout"],
  text: string,
  font: string,
  maxInner: number,
  lineHeight: number,
): number | null {
  if (!text.trim() || maxInner <= 0) return null

  const prepared = prepare(text, font)
  const { lineCount: target } = layout(prepared, maxInner, lineHeight)

  // Single line: find exact width via binary search down from maxInner
  if (target <= 1) {
    let lo = 0
    let hi = maxInner
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2
      const { lineCount } = layout(prepared, mid, lineHeight)
      if (lineCount <= 1) hi = mid
      else lo = mid
    }
    return Math.ceil(hi)
  }

  // Multi-line: binary search for tightest width preserving line count.
  // layout() is ~0.0002ms so 30 iterations ≈ 0.006ms — effectively free.
  let lo = 40
  let hi = maxInner
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2
    const { lineCount } = layout(prepared, mid, lineHeight)
    if (lineCount <= target) hi = mid
    else lo = mid
  }
  return Math.ceil(hi)
}

interface ShrinkwrapBubbleProps {
  text: string
  className?: string
  children: React.ReactNode
  role: "user" | "agent" | "system"
  /** CSS font shorthand for measurement (must match actual render font) */
  font?: string
  /** Horizontal padding inside the bubble (px-4 = 32) */
  paddingPx?: number
  /** Line height in px for layout calculation */
  lineHeightPx?: number
}

export function ShrinkwrapBubble({
  text,
  className,
  children,
  role,
  font = '14px "Geist", ui-sans-serif, system-ui, sans-serif',
  paddingPx = 32,
  lineHeightPx = 22,
}: ShrinkwrapBubbleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tightWidth, setTightWidth] = useState<number | undefined>()
  const [ready, setReady] = useState(false)

  // Load pretext once on mount
  useEffect(() => {
    loadPretext().then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready || !pretextModule) return
    if (role === "system") return
    const container = containerRef.current?.parentElement
    if (!container) return

    const maxOuter = container.clientWidth * 0.8
    const maxInner = maxOuter - paddingPx
    const inner = shrinkwrapWithPretext(
      pretextModule.prepare,
      pretextModule.layout,
      text,
      font,
      maxInner,
      lineHeightPx,
    )

    if (inner && inner + paddingPx < maxOuter - 4) {
      setTightWidth(inner + paddingPx)
    } else {
      setTightWidth(undefined)
    }
  }, [text, font, paddingPx, lineHeightPx, role, ready])

  return (
    <div
      ref={containerRef}
      className={cn("rounded-2xl border px-4 py-3 transition-all duration-200", className)}
      style={tightWidth ? { width: `${tightWidth}px`, maxWidth: "80%" } : { maxWidth: "80%" }}
    >
      {children}
    </div>
  )
}
