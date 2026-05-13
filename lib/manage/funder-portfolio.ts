import { differenceInCalendarDays, parseISO } from "date-fns"
import { grantDeadlineInCalendarYear } from "@/lib/manage/board-report"
import type { FunderType, Grant } from "@/lib/manage/types"

export type FunderPortfolioRow = {
  key: string
  funder: string
  funderType: FunderType
  grants: Grant[]
  grantsCount: number
  totalAwarded: number
  lastActivityLabel: string
  parentRenewalSummary: string
}

/** KPI drill state for the Funder portfolio saved-view lens (All Grants operator). */
export type FunderPortfolioKpiState = {
  topFundersOnly: boolean
  multiYearOnly: boolean
}

export const DEFAULT_FUNDER_PORTFOLIO_KPI: FunderPortfolioKpiState = {
  topFundersOnly: false,
  multiYearOnly: false,
}

export function funderKeyFromGrant(g: Grant): string {
  return g.funder.trim() || "(Unknown funder)"
}

export function filterGrantsByPeriodYtd(source: Grant[], periodYtd: string | null): Grant[] {
  if (!periodYtd) return source
  const y = parseInt(periodYtd, 10)
  if (!Number.isFinite(y)) return source
  return source.filter((g) => grantDeadlineInCalendarYear(g.deadline, y))
}

export function dominantFunderTypeFromGrants(gl: Grant[]): FunderType {
  if (gl.length === 0) return "Federal"
  const counts = new Map<FunderType, number>()
  for (const g of gl) {
    counts.set(g.funderType, (counts.get(g.funderType) ?? 0) + 1)
  }
  let best = gl[0]!.funderType
  let n = 0
  for (const [ft, c] of counts) {
    if (c > n) {
      n = c
      best = ft
    }
  }
  return best
}

export function awardedSumGrant(g: Grant): number {
  if (g.stage === "Awarded - Active" || g.stage === "Closed") return g.award
  return 0
}

/** Latest deadline grants treated as most “recent” for prototype last-activity label */
export function pickLastActivityDisplay(gs: Grant[]): string {
  if (gs.length === 0) return "—"
  const sorted = [...gs].sort((a, b) => (a.deadline < b.deadline ? 1 : -1))
  return sorted[0]!.lastUpdated
}

function parseDeadlineDay(iso: string): Date | null {
  const part = iso.split("T")[0] ?? ""
  try {
    return parseISO(part)
  } catch {
    return null
  }
}

export function renewalStatusForGrant(g: Grant, now: Date): string {
  if (g.stage === "Declined") return "One-time"

  const dl = parseDeadlineDay(g.deadline)
  if (!dl || Number.isNaN(dl.getTime())) return "Active"

  const daysTo = differenceInCalendarDays(dl, now)

  if (g.stage === "Awarded - Active" || g.stage === "Closed") {
    if (g.renewalLikelihood === "Unknown") return "One-time"
    if (g.renewalLikelihood === "Low") {
      if (daysTo < -30) return `Lapsed ${Math.max(1, Math.round(-daysTo / 30))} months ago`
      return "Active"
    }
    if (g.renewalLikelihood === "High" || g.renewalLikelihood === "Medium") {
      if (daysTo >= 0 && daysTo <= 90) return `Renewal due in ${daysTo} days`
      if (daysTo > 90) return "Active"
      return `Lapsed ${Math.max(1, Math.round(-daysTo / 30))} months ago`
    }
    return "Active"
  }

  if (g.renewalLikelihood === "Unknown") return "One-time"
  if ((g.renewalLikelihood === "High" || g.renewalLikelihood === "Medium") && daysTo >= 0 && daysTo <= 90) {
    return `Renewal due in ${daysTo} days`
  }
  return "Active"
}

export function summarizeFunderRenewal(gs: Grant[], now: Date): string {
  if (gs.length === 0) return "—"
  const labels = gs.map((g) => renewalStatusForGrant(g, now))
  if (labels.some((l) => l.startsWith("Renewal due"))) return "Renewal due (see grants)"
  if (labels.some((l) => l.startsWith("Lapsed"))) return "Lapsed (see grants)"
  if (labels.every((l) => l === "One-time")) return "One-time"
  return "Active"
}

export function aggregateFunderRows(grants: Grant[], now: Date): FunderPortfolioRow[] {
  const map = new Map<string, Grant[]>()
  for (const g of grants) {
    const k = g.funder.trim() || "(Unknown funder)"
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(g)
  }
  const rows: FunderPortfolioRow[] = []
  for (const [funder, gl] of map) {
    const totalAwarded = gl.reduce((s, g) => s + awardedSumGrant(g), 0)
    rows.push({
      key: funder,
      funder,
      funderType: dominantFunderTypeFromGrants(gl),
      grants: gl,
      grantsCount: gl.length,
      totalAwarded,
      lastActivityLabel: pickLastActivityDisplay(gl),
      parentRenewalSummary: summarizeFunderRenewal(gl, now),
    })
  }
  return rows.sort((a, b) => b.totalAwarded - a.totalAwarded)
}

export function funderHasMultiYearRelationship(gs: Grant[]): boolean {
  const years = new Set<number>()
  for (const g of gs) {
    const part = g.deadline.split("T")[0] ?? ""
    const y = parseInt(part.split("-")[0] ?? "", 10)
    if (Number.isFinite(y)) years.add(y)
  }
  return years.size >= 2
}

/** Narrow grants after toolbar filters, using portfolio KPI tile drills. */
export function applyFunderPortfolioKpiFilters(grants: Grant[], kpi: FunderPortfolioKpiState, now: Date): Grant[] {
  let list = grants
  let rows = aggregateFunderRows(list, now)
  if (kpi.topFundersOnly) {
    const top = new Set(rows.slice(0, 5).map((row) => row.key))
    list = list.filter((x) => top.has(funderKeyFromGrant(x)))
  }
  if (kpi.multiYearOnly) {
    rows = aggregateFunderRows(list, now)
    const multi = new Set(rows.filter((row) => funderHasMultiYearRelationship(row.grants)).map((row) => row.key))
    list = list.filter((x) => multi.has(funderKeyFromGrant(x)))
  }
  return list
}

/** First calendar year this funder appears in full corpus */
export function funderFirstYear(funder: string, corpus: Grant[]): number | null {
  let minY = Infinity
  for (const g of corpus) {
    if (g.funder.trim() !== funder.trim()) continue
    const part = g.deadline.split("T")[0] ?? ""
    const y = parseInt(part.split("-")[0] ?? "", 10)
    if (Number.isFinite(y)) minY = Math.min(minY, y)
  }
  return Number.isFinite(minY) ? minY : null
}

type RepeatBucketKey = "active" | "due90" | "lapsed"

export function classifyRepeatBuckets(grants: Grant[], now: Date): Record<RepeatBucketKey, number> {
  const byFunder = new Map<string, Grant[]>()
  for (const g of grants) {
    const k = g.funder.trim()
    if (!byFunder.has(k)) byFunder.set(k, [])
    byFunder.get(k)!.push(g)
  }

  let active = 0
  let due90 = 0
  let lapsed = 0

  for (const gs of byFunder.values()) {
    if (!funderHasMultiYearRelationship(gs)) continue
    const statuses = gs.map((g) => renewalStatusForGrant(g, now))
    if (statuses.some((s) => s.startsWith("Lapsed"))) lapsed++
    else if (statuses.some((s) => s.startsWith("Renewal due"))) due90++
    else active++
  }

  return { active, due90, lapsed }
}
