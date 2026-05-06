import type { BoardKpiSlice } from "@/lib/manage/board-report"
import { grantMatchesBoardKpiSlice } from "@/lib/manage/board-report"
import type { FunderType, Grant } from "@/lib/manage/types"

export type { BoardKpiSlice } from "@/lib/manage/board-report"

/** Order of segments in the All grants “Funder breakdown” KPI (matches chart columns). */
export const FUNDER_BREAKDOWN_ORDER: readonly FunderType[] = [
  "Federal",
  "Private",
  "Corporate",
  "State",
  "Local",
] as const

/** Matches the six bars in the pipeline KPI tile (Research … Awarded). */
export type PipelineBucketId = "research" | "planned" | "loi" | "app" | "sub" | "awarded"

export const PIPELINE_BUCKET_META: { id: PipelineBucketId; chartLabel: string; chipLabel: string }[] = [
  { id: "research", chartLabel: "Research", chipLabel: "Research" },
  { id: "planned", chartLabel: "Planned", chipLabel: "Planned" },
  { id: "loi", chartLabel: "LOI", chipLabel: "LOI" },
  { id: "app", chartLabel: "App", chipLabel: "Application in progress" },
  { id: "sub", chartLabel: "Sub", chipLabel: "Submitted" },
  { id: "awarded", chartLabel: "Awarded", chipLabel: "Awarded" },
]

export function grantInPipelineBucket(g: Grant, bucket: PipelineBucketId): boolean {
  switch (bucket) {
    case "research":
      return g.stage === "Researching"
    case "planned":
      return g.stage === "Planned"
    case "loi":
      return g.stage.startsWith("LOI")
    case "app":
      return g.stage === "Application In Progress"
    case "sub":
      return g.stage === "Application Submitted"
    case "awarded":
      return g.stage === "Awarded - Active"
    default:
      return false
  }
}

export function sumAward(list: Grant[]): number {
  return list.reduce((s, g) => s + g.award, 0)
}

export function sumWeighted(list: Grant[]): number {
  return list.reduce((s, g) => s + (g.weighted ?? 0), 0)
}

/** Weighted pipeline tile — active grants with a weighted value */
export function filterWeightedPipelineMember(g: Grant): boolean {
  return (
    g.stage !== "Closed" && g.stage !== "Declined" && g.weighted != null && g.weighted > 0
  )
}

/** Win-rate cohort tile — treat as in-flight outcomes signal */
export function filterWinRateCohort(g: Grant): boolean {
  return (
    g.stage === "Awarded - Active" ||
    g.stage === "Application Submitted" ||
    g.stage === "Closed" ||
    g.stage === "Declined"
  )
}

/** Capacity tile — grants owned by highest-load operator (prototype shorthand) */
export function filterCapacityCohort(g: Grant): boolean {
  return g.ownerId === "maria"
}

export function fmtAwardChip(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n}`
}

/** Four-bar portfolio funnel (Mixed alt KPIs) — mutually exclusive lanes on active-style grants. */
export type FunnelStageId = "considered" | "inProgress" | "submitted" | "awarded"

/**
 * Shown on the “Prospects considered” KPI hero + donut total. Prototype scale (most prospects are not individual seed rows).
 * Segment mix is proportional to real considered-by-funder counts in the table scope, scaled to this total.
 */
export const FUNNEL_DISPLAY_CONSIDERED_COUNT = 1258

export function grantFunnelStage(g: Grant): FunnelStageId {
  switch (g.stage) {
    case "Awarded - Active":
      return "awarded"
    case "Application Submitted":
      return "submitted"
    case "Application In Progress":
      return "inProgress"
    default:
      return "considered"
  }
}

/** Prospects in the “considered” funnel lane (pre-app / early stage), excluding terminal outcomes. */
export function grantIsConsideredProspect(g: Grant): boolean {
  if (g.stage === "Closed" || g.stage === "Declined") return false
  return grantFunnelStage(g) === "considered"
}

export function countConsideredGrantsByFunder(grants: Grant[]): Record<FunderType, number> {
  const out: Record<FunderType, number> = {
    Federal: 0,
    Private: 0,
    Corporate: 0,
    State: 0,
    Local: 0,
  }
  for (const g of grants) {
    if (!grantIsConsideredProspect(g)) continue
    out[g.funderType]++
  }
  return out
}

export function grantMatchesInFlightSlice(g: Grant, slice: "submitted" | "inProgress"): boolean {
  if (g.stage === "Closed" || g.stage === "Declined") return false
  if (slice === "submitted") return g.stage === "Application Submitted"
  return g.stage === "Application In Progress"
}

export function grantMatchesClosedOutcome(g: Grant, outcome: "awarded" | "lost"): boolean {
  if (outcome === "awarded") return g.stage === "Awarded - Active"
  return g.stage === "Closed" || g.stage === "Declined"
}

/** KPI tile drill-in — narrows the grants table + recomputes tile aggregates */
export type KpiDrill =
  | { kind: "funnel"; stage: FunnelStageId }
  | { kind: "inFlight"; slice: "submitted" | "inProgress" }
  | { kind: "closed"; outcome: "awarded" | "lost" }
  | { kind: "winrate" }
  | { kind: "pipeline"; bucket: PipelineBucketId }
  | { kind: "weighted" }
  | { kind: "funder"; funderType: FunderType }
  | { kind: "board"; slice: BoardKpiSlice }

export function passesKpiDrill(d: KpiDrill | null, g: Grant): boolean {
  if (!d) return true
  switch (d.kind) {
    case "funnel":
      if (g.stage === "Closed" || g.stage === "Declined") return false
      return grantFunnelStage(g) === d.stage
    case "inFlight":
      return grantMatchesInFlightSlice(g, d.slice)
    case "closed":
      return grantMatchesClosedOutcome(g, d.outcome)
    case "winrate":
      return filterWinRateCohort(g)
    case "pipeline":
      return grantInPipelineBucket(g, d.bucket)
    case "weighted":
      return filterWeightedPipelineMember(g)
    case "funder":
      return g.funderType === d.funderType
    case "board":
      return grantMatchesBoardKpiSlice(g, d.slice)
    default:
      return true
  }
}

export function drillChipTitle(d: KpiDrill): string {
  switch (d.kind) {
    case "funnel":
      switch (d.stage) {
        case "considered":
          return "Considered funnel"
        case "inProgress":
          return "In progress"
        case "submitted":
          return "Submitted"
        case "awarded":
          return "Awarded"
        default:
          return "Funnel"
      }
    case "inFlight":
      return d.slice === "submitted" ? "Submitted (in flight)" : "Application in progress"
    case "closed":
      return d.outcome === "awarded" ? "Awarded" : "Lost / closed"
    case "pipeline":
      return PIPELINE_BUCKET_META.find((b) => b.id === d.bucket)?.chipLabel ?? "Pipeline"
    case "weighted":
      return "Weighted pipeline"
    case "winrate":
      return "Win-rate cohort"
    case "funder":
      return `${d.funderType} funders`
    case "board":
      switch (d.slice) {
        case "prospects":
          return "Total prospects"
        case "inProgress":
          return "In progress"
        case "submittedPending":
          return "Submitted / pending"
        case "awarded":
          return "Awarded"
        case "declined":
          return "Declined"
        default:
          return "Board KPI"
      }
    default:
      return ""
  }
}
