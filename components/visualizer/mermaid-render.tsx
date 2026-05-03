"use client"

import { useEffect, useState } from "react"

export default function MermaidRender({ code }: { code: string }) {
  const [svg, setSvg] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    async function render() {
      try {
        setError("")
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          themeVariables: {
            primaryColor: "#EFF6FF",
            primaryTextColor: "#07111F",
            primaryBorderColor: "#B9C6D8",
            lineColor: "#1D4ED8",
            secondaryColor: "#F7FAFF",
            tertiaryColor: "#FFFFFF",
            background: "#F7FAFF",
            mainBkg: "#FFFFFF",
            secondBkg: "#EFF6FF",
            tertiaryBkg: "#F7FAFF",
            clusterBkg: "#EFF6FF",
            clusterBorder: "#B9C6D8",
            edgeLabelBackground: "#FFFFFF",
            fontFamily: "var(--font-sans)",
          },
        })

        const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`
        const { svg } = await mermaid.render(id, code)
        if (mounted) setSvg(svg)
      } catch (issue) {
        if (mounted) {
          setSvg("")
          setError(issue instanceof Error ? issue.message : "Failed to render Mermaid diagram")
        }
      }
    }

    void render()

    return () => {
      mounted = false
    }
  }, [code])

  if (error) {
    return (
      <div className="rounded-xl border border-soft-red/30 bg-soft-red/5 p-4 text-xs text-soft-red">
        Mermaid render failed: {error}
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="rounded-xl border border-border bg-surface/30 p-4 text-xs text-muted">
        Rendering Mermaid...
      </div>
    )
  }

  return (
    <div
      className="overflow-auto rounded-[22px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
