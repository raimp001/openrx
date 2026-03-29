"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Shrinkwrap chat bubble — inspired by @chenglou/pretext.
 *
 * CSS `fit-content` / `max-width: 80%` sizes a container to the widest
 * wrapped line, leaving wasted space on shorter lines. This component
 * binary-searches for the tightest width that still produces the same
 * number of lines — zero wasted pixels, perfectly tight bubbles.
 *
 * Uses a hidden canvas for text measurement (no DOM reflow in the hot path).
 */

let _canvas: HTMLCanvasElement | null = null
function canvas(): HTMLCanvasElement {
  if (!_canvas) _canvas = document.createElement("canvas")
  return _canvas
}

function countLines(text: string, font: string, width: number): number {
  const ctx = canvas().getContext("2d")!
  ctx.font = font
  let lines = 1
  let lineW = 0

  for (const segment of text.split("\n")) {
    if (segment === "" && lineW === 0 && lines > 1) {
      lines++
      continue
    }
    const words = segment.split(/(\s+)/)
    for (const word of words) {
      if (!word) continue
      const w = ctx.measureText(word).width
      if (lineW + w > width && lineW > 0) {
        lines++
        lineW = w
      } else {
        lineW += w
      }
    }
    // After each \n, start a new line
    if (text.includes("\n")) {
      lines++
      lineW = 0
    }
  }
  return lines
}

function shrinkwrap(
  text: string,
  font: string,
  maxInner: number,
): number | null {
  if (!text.trim() || maxInner <= 0) return null

  const target = countLines(text, font, maxInner)

  // Single-line: return exact text width
  if (target <= 1) {
    const ctx = canvas().getContext("2d")!
    ctx.font = font
    return Math.ceil(ctx.measureText(text).width)
  }

  // Binary search for the tightest width
  let lo = 40
  let hi = maxInner
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1
    if (countLines(text, font, mid) <= target) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return hi
}

interface ShrinkwrapBubbleProps {
  text: string
  className?: string
  children: React.ReactNode
  role: "user" | "agent" | "system"
  /** CSS font shorthand for canvas measurement (must match actual render font) */
  font?: string
  /** Horizontal padding inside the bubble (px-4 = 32) */
  paddingPx?: number
}

export function ShrinkwrapBubble({
  text,
  className,
  children,
  role,
  font = '14px "Geist", ui-sans-serif, system-ui, sans-serif',
  paddingPx = 32,
}: ShrinkwrapBubbleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tightWidth, setTightWidth] = useState<number | undefined>()

  useEffect(() => {
    if (role === "system") return
    const container = containerRef.current?.parentElement
    if (!container) return

    // max-width is 80% of the message area
    const maxOuter = container.clientWidth * 0.8
    const maxInner = maxOuter - paddingPx
    const inner = shrinkwrap(text, font, maxInner)

    if (inner && inner + paddingPx < maxOuter - 4) {
      setTightWidth(inner + paddingPx)
    } else {
      setTightWidth(undefined)
    }
  }, [text, font, paddingPx, role])

  return (
    <div
      ref={containerRef}
      className={cn("rounded-xl border px-4 py-3", className)}
      style={tightWidth ? { width: `${tightWidth}px`, maxWidth: "80%" } : { maxWidth: "80%" }}
    >
      {children}
    </div>
  )
}
