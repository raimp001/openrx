import type { MetadataRoute } from "next"

const PUBLIC_ROUTES = ["/", "/chat", "/demo", "/trust", "/benchmark", "/privacy-explained"] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return PUBLIC_ROUTES.map((route) => ({
    url: `https://openrx.health${route}`,
    lastModified: now,
    changeFrequency: route === "/chat" ? "weekly" : "monthly",
    priority: route === "/" || route === "/chat" ? 1 : route === "/demo" ? 0.9 : 0.6,
  }))
}
