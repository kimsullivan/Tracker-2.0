export type AppSubmissionStatus = "draft" | "in_progress" | "submitted" | "review"

export type AppDocKind = "LOI" | "Proposal"

export type AppCyclePhase = "current" | "future" | "past"

export type AppCycleRow = {
  id: string
  name: string
  kind: AppDocKind
  status: AppSubmissionStatus
  ownerId: string
  /** ISO calendar date `YYYY-MM-DD`, or em dash when not submitted. */
  submissionDate: string
  lastUpdated: string
}

export type AppCycle = {
  id: string
  title: string
  subtitle: string
  /** Single anchor date for the cycle (YYYY-MM-DD), shown as one date in the table */
  cycleDate: string
  phase: AppCyclePhase
  rows: AppCycleRow[]
}

export type AppCycleFilter = "all" | AppCyclePhase

export type FlatApplicationRow = AppCycleRow & {
  cycleId: string
  cycleTitle: string
  cycleDate: string
  phase: AppCyclePhase
}

export function flattenApplications(cycles: AppCycle[], filter: AppCycleFilter): FlatApplicationRow[] {
  const out: FlatApplicationRow[] = []
  for (const c of cycles) {
    if (filter !== "all" && c.phase !== filter) continue
    for (const r of c.rows) {
      out.push({
        ...r,
        cycleId: c.id,
        cycleTitle: c.title,
        cycleDate: c.cycleDate,
        phase: c.phase,
      })
    }
  }
  return out
}

/** Per-grant overrides so the current cycle's deadline mirrors the matching My-work task.
 *  Demo: Skoll's full-proposal task is May 15, 2026 → the in-progress proposal cycle
 *  uses the same ISO date so the Applications table reflects the same urgency. */
const GRANT_CURRENT_CYCLE_DEADLINE_OVERRIDES: Record<string, string> = {
  "G-2026-SKW": "2026-05-15",
}

export function seedAppCycles(ownerId: string, grantId?: string): AppCycle[] {
  const currentDeadline = (grantId && GRANT_CURRENT_CYCLE_DEADLINE_OVERRIDES[grantId]) || "2026-07-01"
  return [
    {
      id: "cycle-renewal",
      title: "Cohort 3 Renewal · Year 2",
      subtitle: "FY 2026–2027 · Continuation",
      cycleDate: currentDeadline,
      phase: "current",
      rows: [
        {
          id: "row-loi-renew",
          name: "Letter of Intent",
          kind: "LOI",
          status: "submitted",
          ownerId,
          submissionDate: "2026-03-14",
          lastUpdated: "Mar 14, 2026",
        },
        {
          id: "row-budget-renew",
          name: "Full proposal — budget narrative",
          kind: "Proposal",
          status: "in_progress",
          ownerId: "grace",
          submissionDate: "—",
          lastUpdated: "May 2, 2026",
        },
      ],
    },
    {
      id: "cycle-y1",
      title: "Cohort 3 · Year 1 award",
      subtitle: "FY 2025–2026 · Initial application",
      cycleDate: "2025-07-01",
      phase: "past",
      rows: [
        {
          id: "row-proposal-y1",
          name: "Full proposal (Year 1)",
          kind: "Proposal",
          status: "submitted",
          ownerId,
          submissionDate: "2025-06-18",
          lastUpdated: "Jun 20, 2025",
        },
      ],
    },
    {
      id: "cycle-y4",
      title: "Cohort 4 · Anticipated RFP",
      subtitle: "FY 2027–2028",
      cycleDate: "2027-07-01",
      phase: "future",
      rows: [
        {
          id: "row-preapp",
          name: "Letter of intent (pre-cycle)",
          kind: "LOI",
          status: "draft",
          ownerId,
          submissionDate: "—",
          lastUpdated: "Nov 30, 2025",
        },
      ],
    },
  ]
}

/** Demo-fixed "today" so urgency calculations are stable in the prototype. */
const DEMO_TODAY_ISO = "2026-05-11"

export type DeadlineUrgency = "overdue" | "urgent" | "soon" | "normal"

export function deadlineDaysUntil(iso: string, todayIso: string = DEMO_TODAY_ISO): number | null {
  const dm = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const tm = todayIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dm || !tm) return null
  const dueUtc = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]))
  const nowUtc = Date.UTC(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]))
  return Math.round((dueUtc - nowUtc) / 86_400_000)
}

export function deadlineUrgency(iso: string, todayIso?: string): DeadlineUrgency {
  const d = deadlineDaysUntil(iso, todayIso)
  if (d === null) return "normal"
  if (d < 0) return "overdue"
  if (d <= 7) return "urgent"
  if (d <= 21) return "soon"
  return "normal"
}

export function deadlineRelativeLabel(iso: string, todayIso?: string): string | null {
  const d = deadlineDaysUntil(iso, todayIso)
  if (d === null) return null
  if (d < 0) return d === -1 ? "1 day overdue" : `${Math.abs(d)} days overdue`
  if (d === 0) return "Due today"
  if (d === 1) return "Due tomorrow"
  if (d <= 21) return `In ${d} days`
  return null
}

export function patchAppCycleRow(cycles: AppCycle[], cycleId: string, rowId: string, patch: Partial<AppCycleRow>): AppCycle[] {
  return cycles.map((c) =>
    c.id !== cycleId ? c : { ...c, rows: c.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) },
  )
}

export function findInProgressProposalTarget(cycles: AppCycle[]): { cycleId: string; rowId: string } | null {
  for (const c of cycles) {
    const r = c.rows.find((x) => x.kind === "Proposal" && x.status === "in_progress")
    if (r) return { cycleId: c.id, rowId: r.id }
  }
  return null
}

/** Applications table: submission stored as YYYY-MM-DD or legacy prose, or "—". */
export function formatSubmissionDateDisplay(raw: string): string {
  const s = raw.trim()
  if (!s || s === "—") return "—"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (Number.isNaN(d.getTime())) return raw
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }
  const t = Date.parse(s)
  if (Number.isNaN(t)) return raw
  const d = new Date(t)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Value for `<input type="date" />` (YYYY-MM-DD) or "" when unset / em dash. */
export function submissionDateIsoForPicker(raw: string): string {
  const s = raw.trim()
  if (!s || s === "—") return ""
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return s
  const t = Date.parse(s)
  if (Number.isNaN(t)) return ""
  const d = new Date(t)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}
