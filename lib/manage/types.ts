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

/** Opening My Work issue → grant detail: which field to spotlight */
export type IssueNavigationContext = {
  fieldKey: string
  fieldLabel: string
  reason: string
}

export type IssueKind =
  | "deadline"
  | "missing_data"
  | "compliance"
  | "financial"
  | "relationship"
  | "reporting"
  | "ops"

export type IssueSeverity = "critical" | "high" | "medium" | "low"

/** My Work “Issue” column — categorical chip (matches operator spreadsheet). */
export type WorkIssueCategory =
  | "upcoming"
  | "spend"
  | "setup"
  | "inactive"
  | "overdue"
  | "missing_data"

/** One row in My Work = one issue (same grant may appear more than once). */
export type ActionItem = {
  id: string
  /** Issue column — category chip */
  issueCategory: WorkIssueCategory
  /** Item column — short task label */
  itemLabel: string
  /** Details column — dates, amounts, notes */
  detail: string
  grantTitle: string
  grantId: string
  issueKind: IssueKind
  severity: IssueSeverity
  highlightFieldKey: string
  highlightFieldLabel: string
  highlightReason: string
  stage: Stage
  /** Sort / urgency helper (days until relevant deadline; negative = overdue) */
  due: string
  daysOut: number
  ownerId: string
  /** Last updated column */
  lastUpdatedDisplay: string
  /** Primary row action */
  ctaLabel: string
  done?: boolean
  /** Mix Alt prototype — bulk snooze */
  snoozed?: boolean
}

export type Anomaly = {
  id: string
  level: "warn" | "crit" | "info"
  title: string
  body: string
  cta: string
}
