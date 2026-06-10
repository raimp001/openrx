// Demo mode hardens the high-stakes demo surface: when active, the
// orchestrator never falls through to a live model call. Seeded cases resolve
// on their deterministic paths, and anything else gets the cached per-agent
// fallback rendering — so the demo is identical whether the model API is up,
// rate-limited, or fully down.
export function isDemoMode(): boolean {
  return process.env.OPENRX_DEMO_MODE === "1" || process.env.OPENRX_DEMO_MODE === "true"
}
