"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Shrinkwrap hook — powered by @chenglou/pretext.
 *
 * Uses Pretext's prepare() + layout() for accurate, zero-reflow text
 * measurement that handles CJK, emoji, bidi, Thai, and every script
 * Intl.Segmenter supports. layout() is ~0.0002ms so binary search is free.
 */

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

function computeShrinkwrapWidth(
  text: string,
  font: string,
  maxWidth: number,
  paddingX: number,
  lineHeight: number,
): number {
  if (!text.trim() || !pretextModule) return 0

  const innerMax = maxWidth - paddingX
  if (innerMax <= 0) return maxWidth

  const { prepare, layout } = pretextModule
  const prepared = prepare(text, font)
  const { lineCount: target } = layout(prepared, innerMax, lineHeight)

  if (target <= 1) {
    // Single line: find exact tight width
    let lo = 0
    let hi = innerMax
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2
      const { lineCount } = layout(prepared, mid, lineHeight)
      if (lineCount <= 1) hi = mid
      else lo = mid
    }
    return Math.min(Math.ceil(hi) + paddingX + 2, maxWidth)
  }

  // Multi-line: binary search for tightest width preserving line count
  let lo = 40
  let hi = innerMax
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2
    const { lineCount } = layout(prepared, mid, lineHeight)
    if (lineCount <= target) hi = mid
    else lo = mid
  }

  return Math.ceil(hi) + paddingX
}

export interface ShrinkwrapResult {
  width: number | undefined
  ref: (el: HTMLElement | null) => void
}

export function useShrinkwrap(
  text: string,
  maxWidth: number,
  font: string = '14px "Geist", ui-sans-serif, system-ui, sans-serif',
  paddingX: number = 32,
  lineHeight: number = 22,
): ShrinkwrapResult {
  const [width, setWidth] = useState<number | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const elRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    loadPretext().then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready || !pretextModule) return
    if (!text.trim() || maxWidth <= 0) {
      setWidth(undefined)
      return
    }
    const w = computeShrinkwrapWidth(text, font, maxWidth, paddingX, lineHeight)
    if (w > 0 && w < maxWidth) {
      setWidth(w)
    } else {
      setWidth(undefined)
    }
  }, [text, maxWidth, font, paddingX, lineHeight, ready])

  const ref = useCallback((el: HTMLElement | null) => {
    elRef.current = el
  }, [])

  return { width, ref }
}
