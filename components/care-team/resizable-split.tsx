"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ResizableSplitProps {
  orientation: "horizontal" | "vertical"
  initialPercent?: number
  minPercent?: number
  maxPercent?: number
  first: ReactNode
  second: ReactNode
  className?: string
}

export default function ResizableSplit({
  orientation,
  initialPercent = 55,
  minPercent = 20,
  maxPercent = 80,
  first,
  second,
  className,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [percent, setPercent] = useState(initialPercent)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return

    function onMove(event: MouseEvent) {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()

      if (orientation === "horizontal") {
        const next = ((event.clientX - rect.left) / rect.width) * 100
        setPercent(Math.min(maxPercent, Math.max(minPercent, next)))
      } else {
        const next = ((event.clientY - rect.top) / rect.height) * 100
        setPercent(Math.min(maxPercent, Math.max(minPercent, next)))
      }
    }

    function onUp() {
      setDragging(false)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)

    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragging, maxPercent, minPercent, orientation])

  const isHorizontal = orientation === "horizontal"

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-0 min-w-0 overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col",
        className
      )}
    >
      <div
        style={isHorizontal ? { width: `${percent}%` } : { height: `${percent}%` }}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {first}
      </div>

      <button
        type="button"
        aria-label="Resize panel"
        onMouseDown={() => setDragging(true)}
        className={cn(
          "group relative shrink-0 bg-transparent transition-colors",
          isHorizontal
            ? "w-2 cursor-col-resize border-x border-border/50 hover:bg-soft-blue/20"
            : "h-2 cursor-row-resize border-y border-border/50 hover:bg-soft-blue/20"
        )}
      >
        <span
          className={cn(
            "absolute rounded-full bg-muted/40 group-hover:bg-soft-blue",
            isHorizontal
              ? "left-1/2 top-1/2 h-8 w-[2px] -translate-x-1/2 -translate-y-1/2"
              : "left-1/2 top-1/2 h-[2px] w-8 -translate-x-1/2 -translate-y-1/2"
          )}
        />
      </button>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  )
}
