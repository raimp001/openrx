// Onboarding skeleton + step preview while the chat shell hydrates.
// Avoids a bare spinner so the first paint already shows the journey ahead.
const STEP_PREVIEW = [
  "Primary care",
  "Dentist",
  "Pharmacy",
  "Medications",
  "Devices",
  "Screenings",
]

export default function OnboardingLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <section className="surface-hero overflow-hidden px-6 py-8 sm:px-8">
        <div className="max-w-3xl">
          <div className="h-6 w-40 rounded-full bg-white/70" />
          <div className="mt-5 h-12 w-3/4 rounded-[18px] bg-white/70" />
          <div className="mt-3 h-4 w-2/3 rounded bg-white/55" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {STEP_PREVIEW.map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-primary/80"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="surface-card p-5">
          <div className="h-4 w-28 rounded-full bg-border/35" />
          <ul className="mt-4 space-y-3">
            {STEP_PREVIEW.map((label, idx) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-[14px] border border-border/40 bg-white/70 px-3 py-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal/10 text-[11px] font-bold text-teal-dark">
                  {idx + 1}
                </span>
                <span className="text-sm text-secondary">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="surface-card space-y-4 p-5">
          <div className="h-4 w-32 rounded-full bg-border/35" />
          <div className="space-y-3">
            <div className="h-20 rounded-[16px] bg-border/25" />
            <div className="ml-auto h-12 w-2/3 rounded-[16px] bg-teal/10" />
            <div className="h-16 rounded-[16px] bg-border/25" />
          </div>
          <div className="mt-3 h-12 rounded-[14px] border border-border/60" />
        </div>
      </section>
    </div>
  )
}
