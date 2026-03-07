import CareTeamCommandCenter from "@/components/care-team/care-team-command-center"

export const dynamic = "force-dynamic"

export default function CareTeamCommandCenterPage() {
  return (
    <div className="space-y-4">
      <section className="surface-card p-4">
        <h1 className="text-2xl font-serif text-warm-800">🤖 AI Care Team</h1>
        <p className="mt-1 text-sm text-warm-500">
          Supervise your AI care team like a terminal. Blue glow means an agent needs human input.
        </p>
      </section>

      <CareTeamCommandCenter />
    </div>
  )
}
