import { startOfDay, subDays } from "date-fns"
import type { Stage } from "./types"

/** Jul 1 (N−1) – Jun 30 N, labeled FY N (June year). */
export function fiscalYearWindow(fyJuneYear: number): { start: Date; end: Date } {
  const start = new Date(fyJuneYear - 1, 6, 1)
  const end = new Date(fyJuneYear, 5, 30)
  return { start, end }
}

export type TimeRangePresetId = "all" | "ytd" | "mtd" | "fy2025" | "fy2024" | "t12m" | "t90d" | "custom"

/** Dropdown labels only (logic lives in `grantDeadlineMatchesTimeRange`). */
export const TIME_RANGE_MENU: { id: TimeRangePresetId; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "ytd", label: "This year (YTD)" },
  { id: "mtd", label: "This month" },
  { id: "fy2025", label: "FY 2025" },
  { id: "fy2024", label: "FY 2024" },
  { id: "t12m", label: "Trailing 12 months" },
  { id: "t90d", label: "Trailing 90 days" },
  { id: "custom", label: "Custom range" },
]

export function timeRangeMenuLabel(preset: string | null | undefined): string {
  const p = preset ?? "ytd"
  const hit = TIME_RANGE_MENU.find((x) => x.id === p)
  if (hit) return hit.label
  if (/^fy\d{4}$/.test(p)) return `FY ${p.slice(2)}`
  return p
}

function parseDeadlineLocal(iso: string): Date | null {
  const part = iso.split("T")[0] ?? ""
  const [y, mo, d] = part.split("-").map((x) => parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  const t = new Date(y, mo - 1, d)
  return Number.isNaN(t.getTime()) ? null : t
}

function dayLTE(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() <= startOfDay(b).getTime()
}

function dayGTE(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() >= startOfDay(b).getTime()
}

function inClosedRange(deadlineIso: string, start: Date, end: Date): boolean {
  const t = parseDeadlineLocal(deadlineIso)
  if (!t) return false
  return dayGTE(t, start) && dayLTE(t, end)
}

/** FY N = Jul 1 (N−1) … Jun 30 N */
function inFiscalYear(deadlineIso: string, fyJuneYear: number): boolean {
  const { start, end } = fiscalYearWindow(fyJuneYear)
  return inClosedRange(deadlineIso, start, end)
}

/** Active awards often use a future “next milestone” deadline; strict Jan 1→today would drop them from YTD board KPIs. */
function isAwardedOrClosedStage(stage: Stage | null | undefined): boolean {
  return stage === "Awarded - Active" || stage === "Closed"
}

export function grantDeadlineMatchesTimeRange(
  deadlineIso: string,
  filters: Record<string, string | null>,
  now: Date,
  /** When set, YTD / this-month use a looser window for awarded rows so board metrics stay populated. */
  stage?: Stage | null,
): boolean {
  const preset = filters.timeRangePreset ?? "ytd"

  if (preset === "all") {
    return true
  }

  if (preset === "ytd") {
    const y = now.getFullYear()
    const start = new Date(y, 0, 1)
    if (isAwardedOrClosedStage(stage)) {
      const end = new Date(y, 11, 31)
      return inClosedRange(deadlineIso, start, end)
    }
    return inClosedRange(deadlineIso, start, now)
  }

  if (preset === "mtd") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    if (isAwardedOrClosedStage(stage)) {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return inClosedRange(deadlineIso, start, end)
    }
    return inClosedRange(deadlineIso, start, now)
  }

  if (preset === "fy2025") return inFiscalYear(deadlineIso, 2025)
  if (preset === "fy2024") return inFiscalYear(deadlineIso, 2024)

  if (/^fy\d{4}$/.test(preset)) {
    const fy = parseInt(preset.slice(2), 10)
    if (Number.isFinite(fy)) return inFiscalYear(deadlineIso, fy)
  }

  if (preset === "t12m") {
    const end = startOfDay(now)
    const start = subDays(end, 364)
    return inClosedRange(deadlineIso, start, end)
  }

  if (preset === "t90d") {
    const end = startOfDay(now)
    const start = subDays(end, 89)
    return inClosedRange(deadlineIso, start, end)
  }

  if (preset === "custom") {
    const a = filters.timeRangeCustomStart
    const b = filters.timeRangeCustomEnd
    if (!a || !b) return true
    const start = parseDeadlineLocal(`${a}T12:00:00`)
    const end = parseDeadlineLocal(`${b}T12:00:00`)
    if (!start || !end || start.getTime() > end.getTime()) return true
    return inClosedRange(deadlineIso, start, end)
  }

  return true
}

export function timeRangeExportSuffix(filters: Record<string, string | null>, now: Date): string {
  const preset = filters.timeRangePreset ?? "ytd"
  if (preset === "all") return "All time"
  if (preset === "custom") {
    const a = filters.timeRangeCustomStart
    const b = filters.timeRangeCustomEnd
    if (a && b) return `${a}–${b}`
    return "Custom"
  }
  if (preset === "ytd") {
    const y = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    return `${y}-01-01–${y}-${mm}-${dd}`
  }
  if (preset === "mtd") {
    const y = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    return `${y}-${mm}-01–${y}-${mm}-${dd}`
  }
  return timeRangeMenuLabel(preset)
}

/** Toolbar filter keys for the date-range control. */
export function defaultTimeRangeFilterPatch(): Record<string, string | null> {
  return {
    timeRangePreset: "ytd",
    timeRangeCustomStart: null,
    timeRangeCustomEnd: null,
  }
}

/**
 * Migrate saved / URL-hydrated filter objects that used `fiscalYear` / `periodYtd`.
 */
export function migrateToolbarTimeRangeFilters(f: Record<string, string | null>): Record<string, string | null> {
  const out: Record<string, string | null> = { ...f }
  const fy = out.fiscalYear
  const py = out.periodYtd
  delete out.fiscalYear
  delete out.periodYtd

  if (out.timeRangePreset && out.timeRangePreset !== "") {
    if (!out.timeRangeCustomStart) out.timeRangeCustomStart = null
    if (!out.timeRangeCustomEnd) out.timeRangeCustomEnd = null
    return out
  }

  if (typeof fy === "string" && /^FY\d{4}$/.test(fy.trim())) {
    const n = fy.trim().slice(2)
    out.timeRangePreset = `fy${n}`
    out.timeRangeCustomStart = null
    out.timeRangeCustomEnd = null
    return out
  }

  if (py) {
    out.timeRangePreset = "ytd"
    out.timeRangeCustomStart = null
    out.timeRangeCustomEnd = null
    return out
  }

  out.timeRangePreset = out.timeRangePreset && out.timeRangePreset !== "" ? out.timeRangePreset : "ytd"
  out.timeRangeCustomStart = out.timeRangeCustomStart ?? null
  out.timeRangeCustomEnd = out.timeRangeCustomEnd ?? null
  return out
}
