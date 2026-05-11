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
  /** Counties, markets, or “who / where we serve” (shown on grant header & overview). */
  serviceArea?: string
  /** Applicant HQ or prime location line (city, state). */
  geography?: string
  /** 2–4 sentences for Overview; falls back to generated copy when omitted. */
  programSummary?: string
  /** Opportunity tab — applicant / org location (not service territory). */
  opportunityLocation?: string
  /** Where funded project activity occurs (sites, markets, facilities). */
  projectLocation?: string
  /** Applicant or program residency footprint, if applicable. */
  residencyLocation?: string
  /** Form 990 / 990-PF notes for diligence (private); federal uses different public filings. */
  irs990Snapshot?: string
  /** Short 990 highlights for Opportunity overview (optional). */
  irs990Metrics?: { label: string; value: string }[]
  /** Declared exclusions or eligibility barriers. */
  ineligibility?: string
  /** Other compliance / fit notes (match, advocacy limits, etc.). */
  opportunityCompliance?: string
  /** Opportunity overview — narrative bullets (priority focus). */
  opportunityPriorityAreas?: string[]
  /** Opportunity overview — allowable cost / program uses. */
  opportunityFundingUses?: string[]
  /** Opportunity overview — eligible applicant classes. */
  opportunityEligibleApplicants?: string[]
  /** Hard exclusions as list items (optional; falls back to parsing ineligibility copy). */
  ineligibilityBullets?: string[]
  /** 990 giving trend for bar chart (amounts in millions USD). */
  irs990GivingTrend?: { year: number; amount: number }[]
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
