"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Shrinkwrap hook inspired by @chenglou/pretext.
 *
 * CSS `fit-content` / `max-width` sizes a bubble to the widest wrapped line,
 * leaving dead space on shorter lines. This hook binary-searches for the
 * tightest width that still produces the same number of lines — zero wasted
 * pixels.
 *
 * Uses a hidden canvas to measure text (no DOM reflow in the hot path).
 */

let sharedCanvas: HTMLCanvasElement | null = null
function getCanvas(): HTMLCanvasElement {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas")
  }
  return sharedCanvas
}

/** Measure the width of `text` rendered at `font` via canvas. */
function measureText(text: string, font: string): number {
  const canvas = getCanvas()
  const ctx = canvas.getContext("2d")!
  ctx.font = font
  return ctx.measureText(text).width
}

/**
 * Given a block of text, a font, and a maximum width, compute the minimum
 * width that yields the same line count as `maxWidth` — i.e. shrinkwrap.
 *
 * Algorithm: lay out at `maxWidth` to get `targetLines`, then binary-search
 * downward for the narrowest width that still wraps to `targetLines`.
 */
function computeShrinkwrapWidth(
  text: string,
  font: string,
  maxWidth: number,
  paddingX: number = 0,
): number {
  if (!text.trim()) return 0

  const innerMax = maxWidth - paddingX
  if (innerMax <= 0) return maxWidth

  // Simple word-wrap line counter via canvas
  const words = text.split(/(\s+)/)
  function countLines(width: number): number {
    const canvas = getCanvas()
    const ctx = canvas.getContext("2d")!
    ctx.font = font
    let lines = 1
    let lineWidth = 0
    for (const word of words) {
      if (word === "\n") {
        lines++
        lineWidth = 0
        continue
      }
      const w = ctx.measureText(word).width
      if (lineWidth + w > width && lineWidth > 0) {
        lines++
        lineWidth = w
      } else {
        lineWidth += w
      }
    }
    return lines
  }

  const targetLines = countLines(innerMax)

  // If it fits on one line, return exact fit
  if (targetLines === 1) {
    const singleLineWidth = measureText(text, font)
    return Math.min(Math.ceil(singleLineWidth) + paddingX + 2, maxWidth)
  }

  // Binary search: find the narrowest width that still wraps to targetLines
  let lo = 40 // minimum bubble width
  let hi = innerMax

  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (countLines(mid) <= targetLines) {
      hi = mid
    } else {
      lo = mid
    }
  }

  return Math.ceil(hi) + paddingX
}

export interface ShrinkwrapResult {
  width: number | undefined
  ref: (el: HTMLElement | null) => void
}

/**
 * React hook: measure a chat bubble's text and return the tightest width.
 *
 * Usage:
 *   const { width, ref } = useShrinkwrap(message, maxWidth)
 *   <div ref={ref} style={{ width: width ? `${width}px` : undefined }}>
 */
export function useShrinkwrap(
  text: string,
  maxWidth: number,
  font: string = '14px "Geist", ui-sans-serif, system-ui, sans-serif',
  paddingX: number = 32, // px-4 = 16px * 2
): ShrinkwrapResult {
  const [width, setWidth] = useState<number | undefined>(undefined)
  const elRef = useRef<HTMLElement | null>(null)
  const computedRef = useRef(false)

  useEffect(() => {
    // Reset when text changes
    computedRef.current = false
    if (!text.trim() || maxWidth <= 0) {
      setWidth(undefined)
      return
    }
    const w = computeShrinkwrapWidth(text, font, maxWidth, paddingX)
    if (w > 0 && w < maxWidth) {
      setWidth(w)
    } else {
      setWidth(undefined)
    }
    computedRef.current = true
  }, [text, maxWidth, font, paddingX])

  const ref = useCallback((el: HTMLElement | null) => {
    elRef.current = el
  }, [])

  return { width, ref }
}
