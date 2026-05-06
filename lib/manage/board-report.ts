import type { Grant, Stage } from "@/lib/manage/types"

/**
 * Grant deadline falls in calendar year `year` (Jan 1–Dec 31).
 * Board template uses this instead of strict “YTD to today” so prototype seed data
 * (many mid‑2026 deadlines) stays visible regardless of the machine clock.
 */
export function grantDeadlineInCalendarYear(iso: string, year: number): boolean {
  const part = iso.split("T")[0] ?? ""
  const ys = parseInt(part.split("-")[0] ?? "", 10)
  return Number.isFinite(ys) && ys === year
}

/** Audience-facing stage labels for Board / Leadership reports */
export function boardStageLabel(stage: Stage): string {
  switch (stage) {
    case "Researching":
      return "Identifying"
    case "Planned":
      return "Planning"
    case "LOI In Progress":
      return "Initial Outreach"
    case "LOI Submitted":
      return "Under Review"
    case "Application In Progress":
      return "Proposal Stage"
    case "Application Submitted":
      return "Under Review"
    case "Awarded - Active":
      return "Active Grant"
    case "Closed":
      return "Completed Grant"
    case "Declined":
      return "Not Funded"
    default:
      return stage
  }
}

export type BoardKpiSlice = "prospects" | "inProgress" | "submittedPending" | "awarded" | "declined"

/** KPI buckets for Template 2 — mutually exclusive by stage */
export function grantMatchesBoardKpiSlice(g: Grant, slice: BoardKpiSlice): boolean {
  switch (slice) {
    case "prospects":
      return g.stage === "Researching" || g.stage === "Planned"
    case "inProgress":
      return g.stage === "LOI In Progress" || g.stage === "Application In Progress"
    case "submittedPending":
      return g.stage === "LOI Submitted" || g.stage === "Application Submitted"
    case "awarded":
      return g.stage === "Awarded - Active" || g.stage === "Closed"
    case "declined":
      return g.stage === "Declined"
  }
}
