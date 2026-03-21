import CareTeamCommandCenter from "@/components/care-team/care-team-command-center"
import { AppPageHeader } from "@/components/layout/app-page"

export const dynamic = "force-dynamic"

export default function CareTeamCommandCenterPage() {
  return (
    <div className="space-y-4">
      <AppPageHeader
        className="surface-card p-4 sm:p-5"
        title="AI Care Team"
        description="Supervise your AI care team like a terminal. Blue glow means an agent needs human input."
      />

      <CareTeamCommandCenter />
    </div>
  )
}
