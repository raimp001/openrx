import CareTeamCommandCenter from "@/components/care-team/care-team-command-center"
import { AppPageHeader } from "@/components/layout/app-page"

export const dynamic = "force-dynamic"

export default function CareTeamCommandCenterPage() {
  return (
    <div className="space-y-4">
      <AppPageHeader
        className="surface-card p-4 sm:p-5"
        title="Care team operations"
        description="See which OpenRx helpers are active, what needs human input, and where the next care task is waiting."
      />

      <CareTeamCommandCenter />
    </div>
  )
}
