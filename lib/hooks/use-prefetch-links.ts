"use client"

import { useEffect } from "react"

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.href
  } catch {
    return null
  }
}

export function usePrefetchLinks(urls: Array<string | undefined | null>, scope: string) {
  useEffect(() => {
    if (typeof document === "undefined") return

    const uniqueUrls = Array.from(new Set(urls.map((url) => (url ? safeHttpUrl(url) : null)).filter(Boolean))) as string[]
    const created: HTMLLinkElement[] = []

    uniqueUrls.forEach((href) => {
      const existing = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]'))
        .some((link) => link.href === href)
      if (existing) return

      const link = document.createElement("link")
      link.rel = "prefetch"
      link.href = href
      link.dataset.openrxPrefetch = scope
      document.head.appendChild(link)
      created.push(link)
    })

    return () => {
      created.forEach((link) => link.remove())
    }
  }, [scope, urls])
}
