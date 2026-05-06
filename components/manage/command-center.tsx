"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { actionQueue, anomalies, grants, team } from "@/lib/manage/data"
import type { ActionItem, FunderType, IssueNavigationContext, Stage, WorkIssueCategory } from "@/lib/manage/types"
import { OwnerAvatar, OwnerCell } from "./owner-avatar"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  Clock,
  DollarSign,
  FileWarning,
  Flag,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FUNDER_BREAKDOWN_ORDER,
  sumAward,
  type KpiDrill,
} from "@/lib/manage/kpi-bridge"
import type { Grant } from "@/lib/manage/types"
import { PulseStripBridgeRecharts } from "./all-grants-kpi-tiles"
import { useMixAltUi } from "@/components/manage/mix-alt-ui-context"
import { countEffectiveUpcoming, isEffectiveUpcoming } from "@/components/manage/mix-alt-agent"

const MIXALT_EMPTY_SNOOZE_IDS = new Set<string>()

/** Column / urgency sort for the operator My work table and toolbar. */
export type QueueSortKey = "urgency" | "item" | "grant" | "owner" | "updated" | "issue"
export type QueueSort = { key: QueueSortKey; dir: "asc" | "desc" }

/** Shared queue state when My work toolbar is lifted beside grain tabs (mixed / mixed-alt). */
export type MyWorkQueueState = {
  items: ActionItem[]
  setItems: Dispatch<SetStateAction<ActionItem[]>>
  hideDone: boolean
  setHideDone: Dispatch<SetStateAction<boolean>>
  queueSort: QueueSort
  setQueueSort: Dispatch<SetStateAction<QueueSort>>
  sortedVisible: ActionItem[]
  toggle: (id: string) => void
}

/** Short labels under funder breakdown bars (five columns). */
const FUNDER_COLUMN_LABEL: Record<FunderType, string> = {
  Federal: "Federal",
  Private: "Private",
  Corporate: "Corp.",
  State: "State",
  Local: "Local",
}

/** Pipeline bars: sequential ramp from theme tokens (--viz-ramp-1 … 6) */
const PIPELINE_RAMP = [
  "var(--viz-ramp-1)",
  "var(--viz-ramp-2)",
  "var(--viz-ramp-3)",
  "var(--viz-ramp-4)",
  "var(--viz-ramp-5)",
  "var(--viz-ramp-6)",
] as const

const CARD_SHELL =
  "rounded-[12px] border border-elevated-stroke bg-transparent shadow-sm dark:border-border dark:bg-card dark:shadow-sm"

/** My work operator table: no card chrome so rows read as a flat list. */
const TASK_QUEUE_SHELL =
  "min-w-0 overflow-visible rounded-none border-0 bg-transparent shadow-none"

function MiniSparkline({ accent }: { accent: "primary" | "chart-3" }) {
  const points = "0,18 12,15 24,16 36,12 48,14 60,9 72,11 84,7 96,10 108,5"
  const color = accent === "primary" ? "var(--primary)" : "var(--chart-3)"
  return (
    <svg viewBox="0 0 108 22" className="mt-2 h-6 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

export function CommandCenter({ onOpenGrant }: { onOpenGrant: (id: string, ctx?: IssueNavigationContext) => void }) {
  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] space-y-7 px-8 py-8 md:px-10">
      <Greeting />
      <PulseStrip />
      <CommandCenterWorkspace onOpenGrant={onOpenGrant} />
    </div>
  )
}

/** Main column layout: queue + right rail. Tasks column ~2/3 width; grid stays fluid with the container. */
export function CommandCenterWorkspace({
  onOpenGrant,
  hideTeamLoad,
  hideAnomaliesPanel,
  operatorTaskQueue,
  myWorkQueue,
  stickyOperatorTableHeader,
}: {
  onOpenGrant: (id: string, ctx?: IssueNavigationContext) => void
  /** Mixed-alt: omit Team load card from the right rail. */
  hideTeamLoad?: boolean
  /** Mixed-alt: omit “Worth your attention” anomalies card from the right rail. */
  hideAnomaliesPanel?: boolean
  /** Mixed-alt only: My work table matches All grants operator density + chips (not used on `?prototype=mixed`). */
  operatorTaskQueue?: boolean
  /** Mixed / mixed-alt: shared queue state when toolbar lives beside grain tabs. */
  myWorkQueue?: MyWorkQueueState
  /** Mixed shells: keep issue queue column headers pinned under the sticky My work / All grants bar while KPIs scroll away. */
  stickyOperatorTableHeader?: boolean
}) {
  const showAnomalies = !hideAnomaliesPanel
  const showTeamLoad = !hideTeamLoad
  const showRightRail = showAnomalies || showTeamLoad

  if (!showRightRail) {
    return (
      <div className="min-w-0 w-full space-y-7">
        <ActionQueue
          onOpenGrant={onOpenGrant}
          operatorShell={operatorTaskQueue}
          myWorkQueue={myWorkQueue}
          stickyOperatorTableHeader={stickyOperatorTableHeader}
        />
      </div>
    )
  }

  return (
    <div className="grid w-full grid-cols-1 gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-7">
        <ActionQueue
          onOpenGrant={onOpenGrant}
          operatorShell={operatorTaskQueue}
          myWorkQueue={myWorkQueue}
          stickyOperatorTableHeader={stickyOperatorTableHeader}
        />
      </div>
      <div className="min-w-0 space-y-6">
        {showAnomalies ? <AnomaliesPanel /> : null}
        {showTeamLoad ? <TeamLoad /> : null}
      </div>
    </div>
  )
}

export function Greeting({
  hideAttentionCallout,
  attentionSummary,
  firstName = "Maria",
  showDate = true,
}: {
  hideAttentionCallout?: boolean
  /** My work (mixed shells): replaces default grants summary line. */
  attentionSummary?: string
  firstName?: string
  showDate?: boolean
}) {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const active = grants.filter((g) => g.stage !== "Closed" && g.stage !== "Declined").length
  const dueSoon = grants.filter((g) => g.daysToDeadline <= 14 && g.stage !== "Closed" && g.stage !== "Declined").length
  const blocked = grants.filter((g) => g.blocked).length

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Good morning, <span className="text-primary">{firstName}</span>
        </h1>
        {showDate ? <span className="text-xs text-muted-foreground">· {date}</span> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {attentionSummary ? (
          attentionSummary
        ) : (
          <>
            {active} active grants · {dueSoon} due in next 14 days · {blocked} blocked
            {hideAttentionCallout ? "." : " — Hartford burn is the one thing worth your attention."}
          </>
        )}
      </p>
    </div>
  )
}

/** Issue-style KPI row for My work (mixed prototypes only — pipeline KPIs stay on All grants). */
export function MyWorkAttentionStrip({ items }: { items: ActionItem[] }) {
  const mix = useMixAltUi()
  const threshold = mix?.upcomingThresholdDays ?? 14
  const snoozedIds = mix?.snoozedIssueIds ?? MIXALT_EMPTY_SNOOZE_IDS

  const counts = useMemo(() => {
    const open = items.filter((i) => !i.done && !(i.snoozed || snoozedIds.has(i.id)))
    const dataGapCats = new Set<WorkIssueCategory>(["missing_data", "setup", "inactive"])
    return {
      overdue: open.filter((i) => i.issueCategory === "overdue").length,
      upcoming: countEffectiveUpcoming(items, threshold, snoozedIds),
      spend: open.filter((i) => i.issueCategory === "spend").length,
      dataGaps: open.filter((i) => dataGapCats.has(i.issueCategory)).length,
    }
  }, [items, threshold, snoozedIds])

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MyWorkAttentionTile
        value={counts.overdue}
        title="Overdue"
        hint="Act today"
        icon={AlertTriangle}
        iconClassName="bg-rose-100 text-rose-700 dark:bg-rose-950/55 dark:text-rose-300"
      />
      <MyWorkAttentionTile
        value={counts.upcoming}
        title="Upcoming"
        hint={`Next ${threshold} days`}
        icon={Clock}
        iconClassName="bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      />
      <MyWorkAttentionTile
        value={counts.spend}
        title="Spend"
        hint="Off-pace this period"
        icon={DollarSign}
        iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-950/45 dark:text-violet-300"
      />
      <MyWorkAttentionTile
        value={counts.dataGaps}
        title="Data gaps"
        hint="Missing fields, setup, inactive"
        icon={FileWarning}
        iconClassName="bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100"
      />
    </div>
  )
}

function MyWorkAttentionTile({
  value,
  title,
  hint,
  icon: Icon,
  iconClassName,
}: {
  value: number
  title: string
  hint: string
  icon: LucideIcon
  iconClassName: string
}) {
  return (
    <div className={cn(CARD_SHELL, "relative p-5")}>
      <div
        className={cn(
          "absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full shadow-inner",
          iconClassName,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </div>
      <div className="pr-12 font-heading text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-2 font-heading text-sm font-semibold text-foreground">{title}</div>
      <p className="mt-0.5 max-w-[14rem] text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  )
}

export function PulseStrip() {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PipelineCard />
      <MetricCard
        label="Weighted pipeline"
        value="$2.91M"
        delta="-4.2%"
        deltaDirection="down"
        sub="vs last week"
        accent="primary"
      />
      <MetricCard
        label="Win rate · trailing 90d"
        value="38%"
        delta="+6 pts"
        deltaDirection="up"
        sub="vs prior 90d"
        accent="chart-3"
      />
      <FunderBreakdownCard />
    </div>
  )
}

/** KPI tiles — Recharts visuals; drills narrow the filtered grants table (`mixed-alt`). */
export function PulseStripBridge(props: {
  baseScope: Grant[]
  drill: KpiDrill | null
  onDrill: (next: KpiDrill | null) => void
}) {
  return <PulseStripBridgeRecharts {...props} />
}

function PipelineCard() {
  const pipeline = useMemo(() => {
    const activeGrants = grants.filter((g) => g.stage !== "Closed" && g.stage !== "Declined")
    const buckets: { label: string; pred: (s: Stage) => boolean }[] = [
      { label: "Research", pred: (s) => s === "Researching" },
      { label: "Planned", pred: (s) => s === "Planned" },
      { label: "LOI", pred: (s) => s.startsWith("LOI") },
      { label: "App", pred: (s) => s === "Application In Progress" },
      { label: "Sub", pred: (s) => s === "Application Submitted" },
      { label: "Awarded", pred: (s) => s === "Awarded - Active" },
    ]
    const stages = buckets.map((b, i) => ({
      label: b.label,
      count: activeGrants.filter((g) => b.pred(g.stage)).length,
      color: PIPELINE_RAMP[i],
    }))
    const max = Math.max(1, ...stages.map((s) => s.count))
    const totalGrants = activeGrants.length
    const totalAward = activeGrants.reduce((acc, g) => acc + g.award, 0)
    const BAR_PX = 52
    const barHeight = (n: number) => (n <= 0 ? 4 : Math.max(8, Math.round((n / max) * BAR_PX)))

    return { stages, totalGrants, totalAward, barHeight }
  }, [])

  const fmtMoney = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1_000).toFixed(0)}K`

  return (
    <div className={cn(CARD_SHELL, "p-6")}>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pipeline by stage</div>
          <div className="mt-1 font-heading text-xl font-bold text-card-foreground">
            {pipeline.totalGrants} grants · {fmtMoney(pipeline.totalAward)}
          </div>
        </div>
      </div>
      <div className="flex h-[92px] gap-2">
        {pipeline.stages.map((s) => (
          <div key={s.label} className="flex min-h-0 min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="text-center text-[11px] font-bold tabular-nums text-card-foreground">{s.count}</div>
            <div className="flex min-h-[52px] flex-1 flex-col justify-end">
              <div
                className="w-full rounded-sm shadow-sm transition-all duration-300"
                style={{
                  height: `${pipeline.barHeight(s.count)}px`,
                  backgroundColor: s.color,
                }}
              />
            </div>
            <div className="text-center text-[10px] leading-tight text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  delta,
  deltaDirection,
  sub,
  accent,
}: {
  label: string
  value: string
  delta: string
  deltaDirection: "up" | "down"
  sub: string
  accent: "primary" | "chart-3"
}) {
  const goodTrend = (accent === "chart-3" && deltaDirection === "up") || (accent === "primary" && deltaDirection === "up")
  const Trend = deltaDirection === "up" ? TrendingUp : TrendingDown
  return (
    <div className={cn(CARD_SHELL, "p-6")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-bold text-card-foreground">{value}</span>
        <span
          className={[
            "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
            goodTrend ? "bg-chart-2/12 text-chart-2" : "bg-chart-4/12 text-chart-4",
          ].join(" ")}
        >
          <Trend className="h-3 w-3" />
          {delta}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      {/* Sparkline */}
      <Sparkline accent={accent} />
    </div>
  )
}

/** Legend for the stacked funder strip: maps colors → categories (counts & share). Optional row drill. */
function FunderBreakdownLegend({
  rows,
  totalGrants,
  drill,
  onPick,
}: {
  rows: { funderType: FunderType; count: number; label: string; color: string }[]
  totalGrants: number
  drill?: KpiDrill | null
  onPick?: (ft: FunderType) => void
}) {
  return (
    <ul
      className="mt-3 grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2"
      aria-label="Funder breakdown legend"
    >
      {rows.map((r) => {
        const pct = Math.round((100 * r.count) / totalGrants)
        const active = drill?.kind === "funder" && drill.funderType === r.funderType
        const rowInner = (
          <>
            <span
              className="mt-[5px] h-2 w-2 shrink-0 rounded-[2px] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              style={{ backgroundColor: r.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-snug text-foreground">{r.funderType}</span>
            <span className="shrink-0 tabular-nums text-[11px] font-semibold text-card-foreground">{r.count}</span>
            <span className="w-9 shrink-0 text-right tabular-nums text-[10px] font-semibold text-muted-foreground">{pct}%</span>
          </>
        )
        if (onPick) {
          return (
            <li key={r.funderType}>
              <button
                type="button"
                onClick={() => onPick(r.funderType)}
                title={`Filter table to ${r.funderType}`}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-primary/40",
                  active && "bg-muted/30 ring-1 ring-primary/35",
                )}
              >
                {rowInner}
              </button>
            </li>
          )
        }
        return (
          <li key={r.funderType} className="flex items-start gap-2 px-1 py-1">
            {rowInner}
          </li>
        )
      })}
    </ul>
  )
}

/** Single stacked strip: segment width = share of grants (linear composition). */
function FunderMixStrip({
  rows,
}: {
  rows: { funderType: FunderType; count: number; color: string }[]
}) {
  return (
    <div
      className="mt-3 flex h-3 w-full flex-row overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/40"
      role="img"
      aria-label="Grants by funder type, proportional bar"
    >
      {rows.map((r) =>
        r.count > 0 ? (
          <div
            key={r.funderType}
            title={`${r.funderType}: ${r.count}`}
            className="h-full min-w-0 border-r border-background/20 last:border-r-0"
            style={{
              flexGrow: r.count,
              flexBasis: 0,
              backgroundColor: r.color,
            }}
          />
        ) : null,
      )}
    </div>
  )
}

function Sparkline({ accent }: { accent: "primary" | "chart-3" }) {
  const points = "0,18 12,15 24,16 36,12 48,14 60,9 72,11 84,7 96,10 108,5"
  const color = accent === "primary" ? "var(--primary)" : "var(--chart-3)"
  return (
    <svg viewBox="0 0 108 22" className="mt-2 h-6 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function FunderBreakdownCard() {
  const breakdown = useMemo(() => {
    const activeGrants = grants.filter((g) => g.stage !== "Closed" && g.stage !== "Declined")
    const stages = FUNDER_BREAKDOWN_ORDER.map((ft, i) => ({
      funderType: ft,
      count: activeGrants.filter((g) => g.funderType === ft).length,
      color: PIPELINE_RAMP[i],
      label: FUNDER_COLUMN_LABEL[ft],
    }))
    const totalGrants = activeGrants.length
    const totalAward = activeGrants.reduce((acc, g) => acc + g.award, 0)
    return { stages, totalGrants, totalAward }
  }, [])

  const fmtMoney = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1_000).toFixed(0)}K`

  return (
    <div className={cn(CARD_SHELL, "p-6")}>
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Funder breakdown</div>
          <div className="mt-1 font-heading text-xl font-bold text-card-foreground">
            {breakdown.totalGrants} grants · {fmtMoney(breakdown.totalAward)}
          </div>
        </div>
      </div>
      <FunderMixStrip rows={breakdown.stages.map((s) => ({ funderType: s.funderType, count: s.count, color: s.color }))} />
      <FunderBreakdownLegend rows={breakdown.stages} totalGrants={Math.max(1, breakdown.totalGrants)} />
    </div>
  )
}

const WORK_ISSUE_CATEGORY_LABEL: Record<WorkIssueCategory, string> = {
  upcoming: "Upcoming",
  spend: "Spend",
  setup: "Set Up",
  inactive: "Inactive",
  overdue: "Overdue",
  missing_data: "Missing Data",
}

function parseTaskLastUpdated(s: string): number {
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

function ownerSortKey(ownerId: string): string {
  return team.find((m) => m.id === ownerId)?.name ?? ""
}

function compareQueueItems(a: ActionItem, b: ActionItem, sort: QueueSort): number {
  let cmp = 0
  switch (sort.key) {
    case "urgency":
      cmp = a.daysOut - b.daysOut
      break
    case "item": {
      const sa = `${a.itemLabel}\u0000${a.detail}`
      const sb = `${b.itemLabel}\u0000${b.detail}`
      cmp = sa.localeCompare(sb, undefined, { sensitivity: "base" })
      break
    }
    case "grant":
      cmp = a.grantTitle.localeCompare(b.grantTitle, undefined, { sensitivity: "base" })
      break
    case "owner":
      cmp = ownerSortKey(a.ownerId).localeCompare(ownerSortKey(b.ownerId), undefined, { sensitivity: "base" })
      break
    case "updated":
      cmp = parseTaskLastUpdated(a.lastUpdatedDisplay) - parseTaskLastUpdated(b.lastUpdatedDisplay)
      break
    case "issue":
      cmp = WORK_ISSUE_CATEGORY_LABEL[a.issueCategory].localeCompare(
        WORK_ISSUE_CATEGORY_LABEL[b.issueCategory],
        undefined,
        { sensitivity: "base" },
      )
      break
    default:
      cmp = 0
  }
  if (cmp !== 0) return sort.dir === "asc" ? cmp : -cmp
  return a.id.localeCompare(b.id)
}

function cycleQueueSort(prev: QueueSort, column: QueueSortKey): QueueSort {
  if (prev.key === column) return { key: column, dir: prev.dir === "asc" ? "desc" : "asc" }
  return { key: column, dir: "asc" }
}

/** Mixed shells: lift queue state so toolbar can sit beside My work / All grants tabs. */
export function useMyWorkQueueState(): MyWorkQueueState {
  const [items, setItems] = useState<ActionItem[]>(() => [...actionQueue])
  const [hideDone, setHideDone] = useState(false)
  const [queueSort, setQueueSort] = useState<QueueSort>({ key: "urgency", dir: "asc" })

  const visible = useMemo(() => (hideDone ? items.filter((i) => !i.done) : items), [items, hideDone])
  const sortedVisible = useMemo(() => {
    const arr = [...visible]
    arr.sort((a, b) => compareQueueItems(a, b, queueSort))
    return arr
  }, [visible, queueSort])

  function toggle(id: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const done = !i.done
        toast(done ? "Marked done" : "Reopened", {
          description: i.itemLabel,
          action: { label: "Undo", onClick: () => toggle(id) },
        })
        return { ...i, done }
      }),
    )
  }

  return {
    items,
    setItems,
    hideDone,
    setHideDone,
    queueSort,
    setQueueSort,
    sortedVisible,
    toggle,
  }
}

/** Toolbar controls for My work — place beside `GrainNavToggle` on mixed prototypes. */
export function MyWorkQueueToolbar({
  queueSort,
  setQueueSort,
  hideDone,
  setHideDone,
}: {
  queueSort: QueueSort
  setQueueSort: Dispatch<SetStateAction<QueueSort>>
  hideDone: boolean
  setHideDone: Dispatch<SetStateAction<boolean>>
}) {
  const dueLabel =
    queueSort.key === "urgency"
      ? queueSort.dir === "asc"
        ? "soonest"
        : "latest"
      : "soonest"

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          setQueueSort((prev) =>
            prev.key === "urgency"
              ? { key: "urgency", dir: prev.dir === "asc" ? "desc" : "asc" }
              : { key: "urgency", dir: "asc" },
          )
        }
        className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Sort by urgency (days to deadline)"
      >
        <ArrowUpDown className="h-3.5 w-3.5 opacity-80" />
        <span>Due {dueLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => setHideDone((v) => !v)}
        className="text-[11px] text-muted-foreground hover:text-foreground"
      >
        {hideDone ? "Show completed" : "Hide completed"}
      </button>
    </div>
  )
}

/** Matches All grants operator row cells (`text-xs` + `px-3 py-2.5` in `all-grants.tsx`). */
const AG_OPERATOR_CELL = "text-xs font-normal leading-normal text-foreground"

const ISSUE_CATEGORY_BADGE: Record<WorkIssueCategory, string> = {
  upcoming:
    "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-900/45 dark:text-slate-100",
  spend: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-50",
  setup: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-50",
  inactive:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-50",
  overdue:
    "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-700 dark:bg-orange-950/45 dark:text-orange-50",
  missing_data:
    "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50",
}

function IssueCategoryBadge({ category }: { category: WorkIssueCategory }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-[10rem] truncate border px-2 py-0.5 text-[11px] font-normal leading-tight shadow-none",
        ISSUE_CATEGORY_BADGE[category],
      )}
    >
      {WORK_ISSUE_CATEGORY_LABEL[category]}
    </Badge>
  )
}

function ActionQueue({
  onOpenGrant,
  operatorShell,
  myWorkQueue,
  stickyOperatorTableHeader,
}: {
  onOpenGrant: (id: string, ctx?: IssueNavigationContext) => void
  operatorShell?: boolean
  myWorkQueue?: MyWorkQueueState
  stickyOperatorTableHeader?: boolean
}) {
  if (myWorkQueue) {
    return (
      <ActionQueueInner
        onOpenGrant={onOpenGrant}
        operatorShell={operatorShell}
        q={myWorkQueue}
        embeddedToolbar={false}
        stickyOperatorTableHeader={stickyOperatorTableHeader}
      />
    )
  }
  return <ActionQueueStandalone onOpenGrant={onOpenGrant} operatorShell={operatorShell} />
}

function ActionQueueStandalone({
  onOpenGrant,
  operatorShell,
}: {
  onOpenGrant: (id: string, ctx?: IssueNavigationContext) => void
  operatorShell?: boolean
}) {
  const q = useMyWorkQueueState()
  return (
    <ActionQueueInner onOpenGrant={onOpenGrant} operatorShell={operatorShell} q={q} embeddedToolbar />
  )
}

function ActionQueueInner({
  onOpenGrant,
  operatorShell,
  q,
  embeddedToolbar,
  stickyOperatorTableHeader,
}: {
  onOpenGrant: (id: string, ctx?: IssueNavigationContext) => void
  operatorShell?: boolean
  q: MyWorkQueueState
  embeddedToolbar: boolean
  stickyOperatorTableHeader?: boolean
}) {
  const { sortedVisible, toggle } = q

  return (
    <div
      className={cn(operatorShell && !embeddedToolbar ? TASK_QUEUE_SHELL : CARD_SHELL, "overflow-visible")}
    >
      {embeddedToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
          <h2 className="font-heading text-base font-bold text-card-foreground">My work</h2>
          <MyWorkQueueToolbar
            queueSort={q.queueSort}
            setQueueSort={q.setQueueSort}
            hideDone={q.hideDone}
            setHideDone={q.setHideDone}
          />
        </div>
      ) : null}
      {operatorShell ? (
        <OperatorTaskTable
          sortedVisible={sortedVisible}
          toggle={toggle}
          onOpenGrant={onOpenGrant}
          queueSort={q.queueSort}
          setQueueSort={q.setQueueSort}
          stickyHeader={stickyOperatorTableHeader}
        />
      ) : (
        <SimpleTaskList sortedVisible={sortedVisible} toggle={toggle} onOpenGrant={onOpenGrant} />
      )}
    </div>
  )
}

function SimpleTaskList({
  sortedVisible,
  toggle,
  onOpenGrant,
}: {
  sortedVisible: ActionItem[]
  toggle: (id: string) => void
  onOpenGrant: (id: string, ctx?: IssueNavigationContext) => void
}) {
  return (
    <ul className="divide-y divide-border">
      {sortedVisible.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-6",
            item.done && "opacity-50",
          )}
        >
          <div className="flex shrink-0 gap-3 sm:pt-0.5">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className={[
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                item.done ? "border-chart-3 bg-chart-3 text-white" : "border-input hover:border-foreground",
              ].join(" ")}
              aria-label={item.done ? "Mark not done" : "Mark done"}
            >
              {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </button>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className={cn(item.done && "line-through")}>
              <span className="font-semibold text-foreground">{item.itemLabel}</span>
              <p className="mt-0.5 text-muted-foreground">{item.detail}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenGrant(item.grantId, {
                  fieldKey: item.highlightFieldKey,
                  fieldLabel: item.highlightFieldLabel,
                  reason: item.highlightReason,
                })
              }
              className="text-left text-sm font-medium text-primary hover:underline"
            >
              {item.grantTitle}
            </button>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
            <OwnerAvatar id={item.ownerId} size={22} />
            <button
              type="button"
              onClick={() =>
                onOpenGrant(item.grantId, {
                  fieldKey: item.highlightFieldKey,
                  fieldLabel: item.highlightFieldLabel,
                  reason: item.highlightReason,
                })
              }
              className="inline-flex h-7 max-w-[11rem] truncate items-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              {item.ctaLabel}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function QueueSortTh({
  label,
  column,
  sort,
  setSort,
  className,
}: {
  label: string
  column: QueueSortKey
  sort: QueueSort
  setSort: Dispatch<SetStateAction<QueueSort>>
  className?: string
}) {
  const active = sort.key === column
  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "group inline-flex w-full min-w-0 cursor-pointer items-center justify-start gap-1 border-0 bg-transparent px-0 py-1 text-left outline-none transition-colors",
          active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          "focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4",
        )}
        onClick={() => setSort((prev) => cycleQueueSort(prev, column))}
      >
        <span className="min-w-0">{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
          )
        ) : (
          <ArrowUpDown
            className="h-3 w-3 shrink-0 opacity-35 transition-opacity group-hover:opacity-60"
            aria-hidden
          />
        )}
      </button>
    </TableHead>
  )
}

function OperatorTaskTable({
  sortedVisible,
  toggle,
  onOpenGrant,
  queueSort,
  setQueueSort,
  stickyHeader,
}: {
  sortedVisible: ActionItem[]
  toggle: (id: string) => void
  onOpenGrant: (id: string, ctx?: IssueNavigationContext) => void
  queueSort: QueueSort
  setQueueSort: Dispatch<SetStateAction<QueueSort>>
  /** Mixed My work: pin column headers under the sticky grain toggle rail when KPIs scroll away. */
  stickyHeader?: boolean
}) {
  return (
    <Table
      containerClassName={cn(
        "px-0 py-0 sm:px-0 sm:py-0",
        /**
         * `Table` defaults to `overflow-x-auto` on the wrapper. That inner scrollport steals
         * `position: sticky` from `thead`, so headers vanish or never pin to the My work column
         * scroller. Let horizontal overflow propagate to the mixed shell’s `overflow-y-auto`
         * region so thead sticks to the same vertical scroll root as the grain toggle bar.
         */
        stickyHeader && "overflow-x-visible",
      )}
      className={cn(
        "min-w-[720px] text-xs font-normal [&_th]:h-auto [&_th]:min-h-0 [&_th]:py-1.5 [&_th]:font-normal [&_th]:leading-tight",
      )}
    >
      <TableHeader
        className={cn(
          "[&_tr]:border-b [&_tr]:border-border/25",
          stickyHeader &&
            "sticky top-[4.5rem] z-[25] border-b border-border/80 bg-background shadow-[0_1px_0_0_hsl(var(--border)/0.35)] dark:bg-background",
        )}
      >
        <TableRow className="border-0 bg-transparent hover:bg-transparent [&>th]:border-0">
          <TableHead
            className={cn(
              AG_OPERATOR_CELL,
              "w-10 px-3 text-muted-foreground sm:px-4 !h-auto !min-h-0",
            )}
          >
            <span className="sr-only">Done</span>
          </TableHead>
          <QueueSortTh
            label="Item"
            column="item"
            sort={queueSort}
            setSort={setQueueSort}
            className={cn(
              AG_OPERATOR_CELL,
              "min-w-[14rem] whitespace-normal px-3 text-muted-foreground !h-auto !min-h-0",
            )}
          />
          <QueueSortTh
            label="Grant name"
            column="grant"
            sort={queueSort}
            setSort={setQueueSort}
            className={cn(AG_OPERATOR_CELL, "min-w-[11rem] px-3 text-muted-foreground !h-auto !min-h-0")}
          />
          <QueueSortTh
            label="Owner"
            column="owner"
            sort={queueSort}
            setSort={setQueueSort}
            className={cn(AG_OPERATOR_CELL, "px-3 text-muted-foreground !h-auto !min-h-0")}
          />
          <QueueSortTh
            label="Last updated"
            column="updated"
            sort={queueSort}
            setSort={setQueueSort}
            className={cn(AG_OPERATOR_CELL, "px-3 text-muted-foreground !h-auto !min-h-0")}
          />
          <QueueSortTh
            label="Issue"
            column="issue"
            sort={queueSort}
            setSort={setQueueSort}
            className={cn(AG_OPERATOR_CELL, "px-3 text-muted-foreground !h-auto !min-h-0")}
          />
          <TableHead
            className={cn(
              AG_OPERATOR_CELL,
              "w-[1%] px-3 pr-4 text-right text-muted-foreground sm:pr-6 !h-auto !min-h-0",
            )}
          >
            <span className="sr-only">Action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="[&_tr]:border-0">
        {sortedVisible.map((item) => (
          <OperatorTaskRow
            key={item.id}
            item={item}
            onToggle={() => toggle(item.id)}
            onOpen={() =>
              onOpenGrant(item.grantId, {
                fieldKey: item.highlightFieldKey,
                fieldLabel: item.highlightFieldLabel,
                reason: item.highlightReason,
              })
            }
          />
        ))}
      </TableBody>
    </Table>
  )
}

function OperatorTaskRow({
  item,
  onToggle,
  onOpen,
}: {
  item: ActionItem
  onToggle: () => void
  onOpen: () => void
}) {
  const mix = useMixAltUi()
  const threshold = mix?.upcomingThresholdDays ?? 14
  const snoozedIds = mix?.snoozedIssueIds ?? MIXALT_EMPTY_SNOOZE_IDS
  const rowSnoozed = Boolean(item.snoozed || snoozedIds.has(item.id))
  const effectiveUp = isEffectiveUpcoming(item, threshold, snoozedIds)
  const upcomingOutsideWindow =
    item.issueCategory === "upcoming" && !item.done && !rowSnoozed && !effectiveUp

  return (
    <TableRow
      className={cn(
        "border-0 bg-transparent transition-none hover:bg-muted/45 dark:hover:bg-muted/35",
        item.done && "opacity-50",
        rowSnoozed && "opacity-60",
      )}
    >
      <TableCell className={cn("px-3 py-3.5 sm:px-4")}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={[
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
            item.done ? "border-chart-3 bg-chart-3 text-white" : "border-input hover:border-foreground",
          ].join(" ")}
          aria-label={item.done ? "Mark not done" : "Mark done"}
        >
          {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
      </TableCell>
      <TableCell className={cn(AG_OPERATOR_CELL, "whitespace-normal px-3 py-3.5")}>
        <div className={cn("flex flex-col gap-0.5", item.done && "line-through")}>
          <span className="font-semibold text-foreground">{item.itemLabel}</span>
          <span className="font-normal text-muted-foreground">{item.detail}</span>
        </div>
      </TableCell>
      <TableCell className={cn(AG_OPERATOR_CELL, "px-3 py-3.5")}>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            AG_OPERATOR_CELL,
            "max-w-[18rem] truncate text-left font-medium text-foreground hover:underline",
          )}
        >
          {item.grantTitle}
        </button>
      </TableCell>
      <TableCell className={cn(AG_OPERATOR_CELL, "whitespace-normal px-3 py-3.5")}>
        <OwnerCell id={item.ownerId} nameClassName={AG_OPERATOR_CELL} />
      </TableCell>
      <TableCell className={cn(AG_OPERATOR_CELL, "px-3 py-3.5 tabular-nums")}>{item.lastUpdatedDisplay}</TableCell>
      <TableCell className="px-3 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <IssueCategoryBadge category={item.issueCategory} />
          {rowSnoozed ? (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              Snoozed
            </Badge>
          ) : null}
          {upcomingOutsideWindow ? (
            <span className="text-[10px] text-muted-foreground">Outside alert window</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="px-3 py-3.5 pr-4 text-right sm:pr-6">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-7 max-w-[11rem] shrink-0 items-center justify-center truncate rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground shadow-xs hover:bg-muted"
        >
          {item.ctaLabel}
        </button>
      </TableCell>
    </TableRow>
  )
}

function AnomaliesPanel() {
  const iconMap = { crit: AlertTriangle, warn: Flag, info: Info } as const
  const colorMap = {
    crit: "text-rose-950 bg-rose-100 dark:text-rose-50 dark:bg-rose-950/55",
    warn: "text-amber-950 bg-amber-100 dark:text-amber-50 dark:bg-amber-950/55",
    info: "text-sky-950 bg-sky-100 dark:text-sky-50 dark:bg-sky-950/55",
  } as const

  return (
    <div className={cn(CARD_SHELL, "overflow-hidden")}>
      <div className="px-6 py-4">
        <h2 className="font-heading text-sm font-bold text-card-foreground">Worth your attention</h2>
        <p className="text-[11px] text-muted-foreground">3 things the system noticed</p>
      </div>
      <ul>
        {anomalies.map((a) => {
          const Icon = iconMap[a.level]
          return (
            <li key={a.id} className="space-y-2 px-6 py-4">
              <div className="flex items-start gap-2">
                <div className={["mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", colorMap[a.level]].join(" ")}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-card-foreground">{a.title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{a.body}</p>
                </div>
              </div>
              <button
                onClick={() => toast(a.cta, { description: a.title })}
                className="ml-8 inline-flex items-center gap-1 rounded-md bg-muted/90 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                {a.cta}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TeamLoad() {
  return (
    <div className={cn(CARD_SHELL, "overflow-hidden")}>
      <div className="px-6 py-4">
        <h2 className="font-heading text-sm font-bold text-card-foreground">Team load · this week</h2>
        <p className="text-[11px] text-muted-foreground">Reassigning Cummings LOI to Grace would even out the week.</p>
      </div>
      <div className="space-y-2 px-6 py-4">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <OwnerAvatar id={m.id} size={20} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-card-foreground truncate">{m.name}</span>
                <span className="tabular-nums text-muted-foreground">{m.load}%</span>
              </div>
              <div className="mt-1 relative h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{
                    width: `${Math.min(m.load, 100)}%`,
                    backgroundColor:
                      m.load > 100 ? "var(--chart-5)" : m.load > 85 ? "var(--chart-4)" : "var(--chart-3)",
                  }}
                />
                {m.load > 100 && (
                  <div
                    className="absolute inset-y-0 right-0 w-1 bg-chart-5 opacity-50"
                    style={{ width: `${Math.min(m.load - 100, 50)}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
