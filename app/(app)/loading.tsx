const railCards = ["Priority desk", "Health index", "Current lanes"]
const laneCards = ["Upcoming care", "Risk & prevention"]

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <section className="surface-hero overflow-hidden px-6 py-8 sm:px-8">
        <div className="max-w-3xl">
          <div className="h-7 w-32 rounded-full bg-white/70" />
          <div className="mt-6 h-14 w-3/4 rounded-[22px] bg-white/70" />
          <div className="mt-4 h-5 w-2/3 rounded-xl bg-white/55" />
          <div className="mt-3 h-5 w-1/2 rounded-xl bg-white/45" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.72fr_0.72fr]">
        <div className="surface-card p-5">
          <div className="h-4 w-28 rounded-full bg-border/35" />
          <div className="mt-4 h-16 w-2/3 rounded-[22px] bg-border/45" />
          <div className="mt-5 h-28 rounded-[24px] bg-border/25" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[22px] border border-white/80 bg-white/76 p-4">
                <div className="h-10 w-10 rounded-2xl bg-border/30" />
                <div className="mt-4 h-4 w-20 rounded-lg bg-border/40" />
                <div className="mt-2 h-3 w-full rounded bg-border/20" />
              </div>
            ))}
          </div>
        </div>

        {railCards.slice(1).map((label) => (
          <div key={label} className="surface-card p-5">
            <div className="h-4 w-24 rounded-full bg-border/35" />
            <div className="mt-5 h-44 rounded-[24px] bg-border/25" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-10 rounded-[18px] bg-border/20" />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {laneCards.map((label) => (
          <div key={label} className="surface-card p-5 sm:p-6">
            <div className="h-4 w-32 rounded-full bg-border/35" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[22px] border border-white/80 bg-white/76 p-4">
                  <div className="h-4 w-40 rounded-lg bg-border/35" />
                  <div className="mt-3 h-3 w-5/6 rounded bg-border/20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
