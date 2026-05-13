import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  parseISO,
  startOfDay,
  subDays,
  subHours,
  subMonths,
  subWeeks,
} from "date-fns"
import { awardedSumGrant } from "@/lib/manage/funder-portfolio"
import type { Grant, Stage } from "@/lib/manage/types"

export type RelationshipStage =
  | "Prospect"
  | "Cultivating"
  | "Donor — Active"
  | "Donor — Steward"
  | "Dormant"
  | "Lapsed"

/** Section order in the table (most urgent first). */
export const CULTIVATION_STAGE_DISPLAY_ORDER: RelationshipStage[] = [
  "Dormant",
  "Lapsed",
  "Cultivating",
  "Donor — Active",
  "Donor — Steward",
  "Prospect",
]

const PIPELINE_STAGES: Stage[] = [
  "LOI In Progress",
  "LOI Submitted",
  "Application In Progress",
  "Application Submitted",
]

export function cultivationStageSortIndex(stage: string): number {
  const i = CULTIVATION_STAGE_DISPLAY_ORDER.indexOf(stage as RelationshipStage)
  return i === -1 ? 999 : i
}

/** Parse prototype `lastUpdated` strings into an approximate instant (same clock as `ref`). */
export function parseRelativeLastUpdated(s: string, ref: Date): Date {
  const t = s.trim().toLowerCase()
  if (!t) return ref
  if (t === "today") return startOfDay(ref)
  if (t === "yesterday") return subDays(startOfDay(ref), 1)
  if (t === "recently") return subHours(ref, 3)
  if (t === "last month") return subMonths(startOfDay(ref), 1)

  let m = t.match(/^(\d+)\s+hours?\s+ago$/)
  if (m) return subHours(ref, parseInt(m[1]!, 10))
  m = t.match(/^(\d+)\s+days?\s+ago$/)
  if (m) return subDays(ref, parseInt(m[1]!, 10))
  m = t.match(/^(\d+)\s+weeks?\s+ago$/)
  if (m) return subWeeks(ref, parseInt(m[1]!, 10))
  m = t.match(/^(\d+)\s+months?\s+ago$/)
  if (m) return subMonths(ref, parseInt(m[1]!, 10))

  try {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d
  } catch {
    /* ignore */
  }
  return ref
}

export function funderLastTouchDate(grants: Grant[], ref: Date): Date {
  if (grants.length === 0) return ref
  let bestMs = -Infinity
  let best = ref
  for (const g of grants) {
    const d = parseRelativeLastUpdated(g.lastUpdated, ref)
    const ms = d.getTime()
    if (ms > bestMs) {
      bestMs = ms
      best = d
    }
  }
  return best
}

export function funderLastTouchSortMs(grants: Grant[], ref: Date): number {
  return funderLastTouchDate(grants, ref).getTime()
}

export function touchTypeFromGrant(g: Grant): string {
  const st = g.stage
  if (st === "Closed" || st === "Awarded - Active") return "Grant award"
  if (st === "Application Submitted") return "Application submitted"
  if (st === "LOI Submitted" || st === "LOI In Progress") return "Email"
  if (st === "Application In Progress") return "Phone call"
  if (st === "Declined") return "Email"
  return "Site visit"
}

export function pickLastTouchGrant(grants: Grant[], ref: Date): Grant | null {
  if (grants.length === 0) return null
  return [...grants].sort(
    (a, b) =>
      parseRelativeLastUpdated(b.lastUpdated, ref).getTime() -
      parseRelativeLastUpdated(a.lastUpdated, ref).getTime(),
  )[0]!
}

export function formatFunderLastTouch(
  grants: Grant[],
  now: Date,
): { relative: string; touchType: string } {
  const g = pickLastTouchGrant(grants, now)
  if (!g) return { relative: "—", touchType: "" }
  const d = parseRelativeLastUpdated(g.lastUpdated, now)
  const relative = formatDistanceToNow(d, { addSuffix: true })
  return { relative, touchType: touchTypeFromGrant(g) }
}

export function relationshipStageForFunder(grants: Grant[], now: Date): RelationshipStage {
  const hasAwardedActive = grants.some((g) => g.stage === "Awarded - Active")
  if (hasAwardedActive) return "Donor — Active"

  const inPipeline = grants.some((g) => PIPELINE_STAGES.includes(g.stage))
  if (inPipeline) return "Cultivating"

  const everAwarded = grants.some((g) => awardedSumGrant(g) > 0)
  const lastTouch = funderLastTouchDate(grants, now)
  const daysSince = differenceInCalendarDays(startOfDay(now), startOfDay(lastTouch))

  if (everAwarded) {
    if (daysSince >= 365) return "Lapsed"
    if (daysSince >= 180) return "Dormant"
    return "Donor — Steward"
  }

  return "Prospect"
}

export function groupGrantsByFunder(grants: Grant[]): Map<string, Grant[]> {
  const m = new Map<string, Grant[]>()
  for (const g of grants) {
    const k = g.funder.trim() || "(Unknown funder)"
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(g)
  }
  return m
}

export function relationshipStageForGrant(
  g: Grant,
  funderStageByKey: Map<string, RelationshipStage>,
): RelationshipStage {
  const k = g.funder.trim() || "(Unknown funder)"
  return funderStageByKey.get(k) ?? "Prospect"
}

export function buildFunderRelationshipStageMap(grants: Grant[], now: Date): Map<string, RelationshipStage> {
  const byFunder = groupGrantsByFunder(grants)
  const map = new Map<string, RelationshipStage>()
  for (const [k, gl] of byFunder) {
    map.set(k, relationshipStageForFunder(gl, now))
  }
  return map
}

export type NextStepInfo = { line: string; overdue: boolean }

export function nextStepForFunder(grants: Grant[], now: Date): NextStepInfo | null {
  const open = grants.filter((g) => g.stage !== "Declined" && g.stage !== "Closed")
  const sorted = [...open].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  for (const g of sorted) {
    const action = g.nextAction?.trim()
    if (!action) continue
    let dl: Date
    try {
      dl = parseISO((g.deadline.split("T")[0] ?? g.deadline) as string)
    } catch {
      continue
    }
    if (Number.isNaN(dl.getTime())) continue
    const dueStr = format(dl, "MMM d, yyyy")
    const overdue = differenceInCalendarDays(startOfDay(dl), startOfDay(now)) < 0
    const suffix = overdue ? " — overdue" : ` — due ${dueStr}`
    return { line: `${action}${suffix}`, overdue }
  }
  return null
}

export function lifetimeGivingLabel(grants: Grant[], fmt$: (n: number) => string): string {
  const total = grants.reduce((s, g) => s + awardedSumGrant(g), 0)
  const years = new Set<number>()
  for (const g of grants) {
    if (awardedSumGrant(g) <= 0) continue
    const y = parseInt(g.deadline.split("T")[0]?.split("-")[0] ?? "", 10)
    if (Number.isFinite(y)) years.add(y)
  }
  if (years.size === 0) return `${fmt$(total)} · no awards yet`
  const ymin = Math.min(...years)
  const ymax = Math.max(...years)
  const spanYears = ymax - ymin + 1
  const yearLabel = spanYears <= 1 ? "1 year" : `${spanYears} years`
  return `${fmt$(total)} over ${yearLabel}`
}

export function cadenceLabel(grants: Grant[]): string {
  const awardYears: number[] = []
  for (const g of grants) {
    if (awardedSumGrant(g) <= 0) continue
    const y = parseInt(g.deadline.split("T")[0]?.split("-")[0] ?? "", 10)
    if (Number.isFinite(y)) awardYears.push(y)
  }
  const uniq = [...new Set(awardYears)].sort((a, b) => a - b)
  if (uniq.length === 0) return "Single"
  if (uniq.length === 1) return "Single"
  const gaps: number[] = []
  for (let i = 1; i < uniq.length; i++) gaps.push(uniq[i]! - uniq[i - 1]!)
  const maxGap = Math.max(...gaps)
  const allAnnual = gaps.every((gap) => gap === 1)
  if (allAnnual) return "Annual"
  if (maxGap >= 3) return "Multi-year"
  return "Episodic"
}

export function dominantOwnerId(grants: Grant[]): string | null {
  if (grants.length === 0) return null
  const counts = new Map<string, number>()
  for (const g of grants) {
    counts.set(g.ownerId, (counts.get(g.ownerId) ?? 0) + 1)
  }
  let best = grants[0]!.ownerId
  let n = 0
  for (const [id, c] of counts) {
    if (c > n) {
      n = c
      best = id
    }
  }
  return best
}

export function funderDaysSinceLastTouch(grants: Grant[], now: Date): number {
  const last = funderLastTouchDate(grants, now)
  return differenceInCalendarDays(startOfDay(now), startOfDay(last))
}

export function funderRecentAward(grants: Grant[], now: Date, withinDays: number): boolean {
  for (const g of grants) {
    if (awardedSumGrant(g) <= 0) continue
    if (g.stage !== "Awarded - Active" && g.stage !== "Closed") continue
    const touch = parseRelativeLastUpdated(g.lastUpdated, now)
    const d = differenceInCalendarDays(startOfDay(now), startOfDay(touch))
    if (d >= 0 && d <= withinDays) return true
  }
  return false
}

export type CultivationKpiModel = {
  cultivatingCount: number
  prospectCount: number
  donorActiveCount: number
  cold60Plus: number
  agingBuckets: { id: string; label: string; count: number; fill: string }[]
  stewardFunders: { name: string; sortMs: number }[]
  stewardCount: number
  topLifetime: { name: string; total: number }[]
  topLifetimeHero$: number
}

export function buildCultivationKpiModel(
  grantsKpi: Grant[],
  grantsLifetime: Grant[],
  now: Date,
): CultivationKpiModel {
  const byKpi = groupGrantsByFunder(grantsKpi)
  const byLife = groupGrantsByFunder(grantsLifetime)

  let cultivatingCount = 0
  let prospectCount = 0
  let donorActiveCount = 0

  for (const [, gl] of byKpi) {
    const st = relationshipStageForFunder(gl, now)
    if (st === "Cultivating") cultivatingCount++
    if (st === "Prospect") prospectCount++
    if (st === "Donor — Active") donorActiveCount++
  }

  let cold60Plus = 0
  let b60 = 0
  let b90 = 0
  let b180 = 0
  for (const [, gl] of byKpi) {
    const d = funderDaysSinceLastTouch(gl, now)
    if (d >= 60) {
      cold60Plus++
      if (d >= 180) b180++
      else if (d >= 90) b90++
      else b60++
    }
  }

  const stewardFunders: { name: string; sortMs: number }[] = []
  for (const [name, gl] of byKpi) {
    if (!funderRecentAward(gl, now, 90)) continue
    const touchMs = funderLastTouchSortMs(gl, now)
    stewardFunders.push({ name, sortMs: touchMs })
  }
  stewardFunders.sort((a, b) => b.sortMs - a.sortMs)

  const stewardList = stewardFunders.slice(0, 5)
  const stewardCount = stewardFunders.length

  const lifeRows: { name: string; total: number }[] = []
  for (const [name, gl] of byLife) {
    const total = gl.reduce((s, g) => s + awardedSumGrant(g), 0)
    if (total > 0) lifeRows.push({ name, total })
  }
  lifeRows.sort((a, b) => b.total - a.total)
  const topLifetime = lifeRows.slice(0, 5)
  const topLifetimeHero$ = topLifetime[0]?.total ?? 0

  return {
    cultivatingCount,
    prospectCount,
    donorActiveCount,
    cold60Plus,
    agingBuckets: [
      { id: "60-89", label: "60–89d", count: b60, fill: "#F59E0B" },
      { id: "90-179", label: "90–179d", count: b90, fill: "#EA580C" },
      { id: "180+", label: "180d+", count: b180, fill: "#B91C1C" },
    ],
    stewardFunders: stewardList,
    stewardCount,
    topLifetime,
    topLifetimeHero$,
  }
}
