export type Stage =
  | "Researching"
  | "Planned"
  | "LOI In Progress"
  | "LOI Submitted"
  | "Application In Progress"
  | "Application Submitted"
  | "Awarded - Active"
  | "Closed"
  | "Declined"

export type FunderType = "Federal" | "Private" | "Corporate" | "State" | "Local"
export type Priority = "P0" | "P1" | "P2" | "P3"
export type ProjectGroup = "Health Equity" | "Workforce" | "General Op" | "Capacity" | "Research"
export type RenewalLikelihood = "High" | "Medium" | "Low" | "Unknown"

export type TeamMember = {
  id: string
  name: string
  initials: string
  role: string
  load: number // 0-200%
  color: string
}

export type Grant = {
  id: string
  title: string
  funder: string
  funderType: FunderType
  stage: Stage
  nextAction: string
  deadline: string // ISO
  daysToDeadline: number
  award: number
  weighted?: number
  ownerId: string
  cycle: string
  fundingSource: string
  cfda?: string
  fain?: string
  period?: string
  indirect?: number
  matchRequired?: boolean
  lastUpdated: string
  projectGroup: ProjectGroup
  priority: Priority
  renewalLikelihood: RenewalLikelihood
  blocked?: boolean
  blockedReason?: string
  flagged?: boolean
}

export type ActionItem = {
  id: string
  title: string
  detail: string
  grantTitle: string
  grantId: string
  stage: Stage
  due: string
  daysOut: number
  award: number
  ownerId: string
  done?: boolean
}

export type Anomaly = {
  id: string
  level: "warn" | "crit" | "info"
  title: string
  body: string
  cta: string
}
