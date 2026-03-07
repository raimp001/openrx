import type { CareTeamAgent } from "@/lib/care-team/types"

export const CARE_TEAM_CORE_AGENTS: Array<Pick<CareTeamAgent, "id" | "name" | "role">> = [
  { id: "onboarding", name: "Sage", role: "Onboarding Guide" },
  { id: "coordinator", name: "Atlas", role: "Coordinator" },
  { id: "triage", name: "Nova", role: "Triage Nurse" },
  { id: "scheduling", name: "Cal", role: "Scheduler" },
  { id: "billing", name: "Vera", role: "Billing Protector" },
  { id: "rx", name: "Maya", role: "Rx Manager" },
  { id: "prior-auth", name: "Rex", role: "Prior Auth Fighter" },
  { id: "wellness", name: "Ivy", role: "Wellness Coach" },
  { id: "devops", name: "Bolt", role: "DevOps" },
]

export const CARE_TEAM_OPERATOR_ROLES = ["admin", "staff", "service"] as const

export const CARE_TEAM_STORE_VERSION = 1

export const CARE_TEAM_EVENT_CHANNEL = "care_team_event"
