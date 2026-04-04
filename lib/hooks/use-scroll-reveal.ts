"use client"

import { useEffect, useRef } from "react"

export function useScrollReveal(threshold = 0.15) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Mark container as JS-ready so CSS can hide .reveal elements
    container.classList.add("reveal-ready")

    const elements = container.querySelectorAll(".reveal")
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed")
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    )

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [threshold])

  return containerRef
}
