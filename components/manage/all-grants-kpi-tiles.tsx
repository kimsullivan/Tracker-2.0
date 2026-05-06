"use client"

import type { ReactNode, SVGProps } from "react"
import { useId, useMemo } from "react"
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import type { FunderType, Grant } from "@/lib/manage/types"
import { grants } from "@/lib/manage/data"
import {
  sumAward,
  sumWeighted,
  grantFunnelStage,
  countConsideredGrantsByFunder,
  FUNNEL_DISPLAY_CONSIDERED_COUNT,
  type FunnelStageId,
  type KpiDrill,
} from "@/lib/manage/kpi-bridge"
import { grantMatchesBoardKpiSlice, type BoardKpiSlice } from "@/lib/manage/board-report"

/** Lato for all KPI numbers & labels (HTML + Recharts SVG — SVG does not inherit CSS font). */
export const KPI_CHART_FONT = "var(--font-lato), Lato, ui-sans-serif, system-ui, sans-serif"

/** Matches Recharts Area/Line defaults so donuts / chat sparks feel consistent with win-rate tiles. */
export const KPI_CHART_ANIMATION_DURATION_MS = 400
export const KPI_CHART_ANIMATION_EASING = "ease" as const

/** Tailwind-friendly class for width-based KPI bars (pairs with {@link KPI_CHART_ANIMATION_DURATION_MS}). */
export const KPI_BAR_WIDTH_TRANSITION_CLASS =
  "transition-[width] duration-[400ms] ease-out motion-reduce:transition-none"

/**
 * Mirrors `tokens` + layout from AllGrantsKPITiles.jsx (purple ramp, semantic, typography).
 * Recharts: BarChart · AreaChart (+ Bar · Area · XAxis · YAxis · Cell · ResponsiveContainer · LabelList).
 */
export const AG_KPI_TOKENS = {
  bgCard: "#FFFFFF",
  bgPage: "#FAFAF7",
  border: "rgba(0,0,0,0.08)",
  textPrimary: "#1A1A1A",
  textSecondary: "#5F5E5A",
  textTertiary: "#8E8D87",
  radiusLg: 12,
  purple50: "#EEEDFE",
  purple100: "#CECBF6",
  purple200: "#AFA9EC",
  purple400: "#7F77DD",
  purple600: "#534AB7",
  purple800: "#3C3489",
  teal600: "#1D9E75",
  teal800: "#0F6E56",
  teal50: "#E1F5EE",
  red600: "#A32D2D",
  red800: "#791F1F",
  red50: "#FCEBEB",
  gray100: "#D3D1C7",
  gray400: "#888780",
} as const

/** Prospects-considered donut: segment order + fills (AllGrantsKPITiles.jsx Tile 1). */
const PROSPECTS_CONSIDERED_FUNDER_ORDER: readonly FunderType[] = ["Private", "Federal", "Corporate", "State", "Local"]
const PROSPECTS_FUNDER_COLOR: Record<FunderType, string> = {
  Private: AG_KPI_TOKENS.purple600,
  Federal: AG_KPI_TOKENS.purple400,
  Corporate: AG_KPI_TOKENS.purple200,
  State: AG_KPI_TOKENS.purple100,
  Local: AG_KPI_TOKENS.purple50,
}

type ProspectsFunderSlice = { name: string; value: number; color: string; funderType: FunderType }

function scaleConsideredByFunderToTotal(
  raw: Record<FunderType, number>,
  target: number,
): ProspectsFunderSlice[] {
  const order = PROSPECTS_CONSIDERED_FUNDER_ORDER
  const sumRaw = order.reduce((s, ft) => s + (raw[ft] ?? 0), 0)
  if (sumRaw === 0) {
    const base = Math.floor(target / order.length)
    let rem = target - base * order.length
    return order.map((ft, i) => ({
      name: ft,
      color: PROSPECTS_FUNDER_COLOR[ft],
      funderType: ft,
      value: base + (i < rem ? 1 : 0),
    }))
  }
  const parts = order.map((ft) => {
    const exact = (target * (raw[ft] ?? 0)) / sumRaw
    return { ft, exact, floor: Math.floor(exact), frac: exact - Math.floor(exact) }
  })
  let assigned = parts.reduce((s, p) => s + p.floor, 0)
  let deficit = target - assigned
  const byFrac = [...parts].sort((a, b) => b.frac - a.frac)
  for (let i = 0; i < deficit && i < byFrac.length; i++) byFrac[i].floor += 1

  return order.map((ft) => {
    const row = parts.find((p) => p.ft === ft)!
    return {
      name: ft,
      funderType: ft,
      color: PROSPECTS_FUNDER_COLOR[ft],
      value: row.floor,
    }
  })
}

const ALL_ACTIVE_WIN_SPARK = [
  { period: "P1", value: 18 },
  { period: "P2", value: 19 },
  { period: "P3", value: 21 },
  { period: "P4", value: 20 },
  { period: "P5", value: 22 },
  { period: "P6", value: 22 },
  { period: "P7", value: 23 },
  { period: "P8", value: 24 },
  { period: "P9", value: 24 },
  { period: "P10", value: 23 },
  { period: "P11", value: 24 },
  { period: "P12", value: 25 },
] as const

function fmtComma(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

export function AllActiveTileShell({ children, shellClassName }: { children: ReactNode; shellClassName?: string }) {
  return (
    <div
      style={{ fontFamily: KPI_CHART_FONT }}
      className={cn(
        "flex h-[260px] flex-col rounded-[12px] border-[0.5px] p-[18px] [gap:10px]",
        "bg-[color:#FFFFFF] dark:bg-card dark:border-border",
        "border-[rgba(0,0,0,0.08)]",
        shellClassName,
      )}
    >
      {children}
    </div>
  )
}


export function AllActiveTileHeader({
  label,
  right,
}: {
  label: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: AG_KPI_TOKENS.textTertiary }}
      >
        {label}
      </span>
      {right}
    </div>
  )
}

export function AllActiveTileHero({
  value,
  caption,
}: {
  value: string
  /** Shown below the headline; omit on most KPI tiles (win rate keeps e.g. “vs prior”). */
  caption?: string
}) {
  return (
    <div>
      <div
        className="text-[26px] font-bold leading-none tracking-[-0.01em] dark:text-card-foreground"
        style={{ color: AG_KPI_TOKENS.textPrimary }}
      >
        {value}
      </div>
      {caption ? (
        <div className="mt-1 text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
          {caption}
        </div>
      ) : null}
    </div>
  )
}

/** Same as JSX `DeltaPill`: 11px, bold weight, padding 2px 6px, gap 3, radius 4 */
export function AllActiveDeltaPill({ direction, value }: { direction: "up" | "down"; value: string }) {
  const up = direction === "up"
  const fg = up ? AG_KPI_TOKENS.teal800 : AG_KPI_TOKENS.red800
  const bg = up ? AG_KPI_TOKENS.teal50 : AG_KPI_TOKENS.red50
  return (
    <span
      className="inline-flex items-center rounded-[4px] text-[11px] font-bold"
      style={{ color: fg, background: bg, padding: "2px 6px", gap: 3, fontFamily: KPI_CHART_FONT }}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
      </svg>
      {value}
    </span>
  )
}

function StaticProspectsConsideredTile({ scope }: { scope: Grant[] }) {
  const slices = useMemo(
    () => scaleConsideredByFunderToTotal(countConsideredGrantsByFunder(scope), FUNNEL_DISPLAY_CONSIDERED_COUNT),
    [scope],
  )

  const total = FUNNEL_DISPLAY_CONSIDERED_COUNT
  const sorted = [...slices].sort((a, b) => b.value - a.value)
  const topPct = Math.round((100 * sorted[0]!.value) / Math.max(1, total))

  const uid = useId().replace(/:/g, "")

  return (
    <AllActiveTileShell>
      <AllActiveTileHeader
        label="Prospects considered"
        right={
          <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
            {PROSPECTS_CONSIDERED_FUNDER_ORDER.length} funder types
          </span>
        }
      />
      <AllActiveTileHero value={fmtComma(total)} />

      <div className="mt-1 flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center gap-[14px]" style={{ marginTop: 4 }}>
          <div className="relative h-24 w-24 shrink-0 overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart tabIndex={-1}>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={46}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  stroke="none"
                  animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
                  animationEasing={KPI_CHART_ANIMATION_EASING}
                >
                  {slices.map((entry, idx) => (
                    <Cell key={`${uid}-c-${idx}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden
            >
              <div
                className="text-[9px] font-bold uppercase leading-none tracking-[0.06em]"
                style={{ color: AG_KPI_TOKENS.textTertiary, fontFamily: KPI_CHART_FONT }}
              >
                Top
              </div>
              <div
                className="mt-0.5 text-[14px] font-bold leading-tight dark:text-card-foreground"
                style={{ color: AG_KPI_TOKENS.textPrimary, fontFamily: KPI_CHART_FONT }}
              >
                {topPct}%
              </div>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden text-[11px]" style={{ fontFamily: KPI_CHART_FONT }}>
            {slices.map((entry) => (
              <div key={entry.name} className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
                  style={{ background: entry.color }}
                  aria-hidden
                />
                <span className="min-w-0 truncate" style={{ color: AG_KPI_TOKENS.textSecondary }}>
                  {entry.name}
                </span>
                <span
                  className="ml-auto shrink-0 font-bold tabular-nums dark:text-card-foreground"
                  style={{ color: AG_KPI_TOKENS.textTertiary }}
                >
                  {entry.value.toLocaleString("en-US")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AllActiveTileShell>
  )
}

function StaticInFlightTile({
  submittedCount,
  inProgressCount,
  submittedDollars,
  inProgressDollars,
}: {
  submittedCount: number
  inProgressCount: number
  submittedDollars: number
  inProgressDollars: number
}) {
  const rows = [
    { type: "Submitted" as const, count: submittedCount, dollars: submittedDollars, fill: AG_KPI_TOKENS.purple600 },
    {
      type: "In progress" as const,
      count: inProgressCount,
      dollars: inProgressDollars,
      fill: AG_KPI_TOKENS.purple200,
    },
  ]
  const denom = submittedDollars + inProgressDollars
  const totalDollarsForHero = denom
  const totalDollars = denom > 0 ? denom : 1

  return (
    <AllActiveTileShell>
      <AllActiveTileHeader
        label="In flight"
        right={
          <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
            {submittedCount + inProgressCount} active
          </span>
        }
      />
      <AllActiveTileHero value={fmtMoney(totalDollarsForHero)} />

      <div className="mt-1 flex min-h-0 flex-1 flex-col justify-center [gap:14px]">
        {rows.map((d) => {
          const widthPct = (d.dollars / totalDollars) * 100
          return (
            <div key={d.type}>
              <div className="mb-[5px] flex justify-between text-[11px]">
                <span style={{ color: AG_KPI_TOKENS.textSecondary }}>
                  {d.type} <span style={{ color: AG_KPI_TOKENS.textTertiary }}>· {d.count}</span>
                </span>
                <span
                  className="font-bold tabular-nums dark:text-card-foreground"
                  style={{ color: AG_KPI_TOKENS.textPrimary }}
                >
                  ${(d.dollars / 1000).toFixed(0)}K
                </span>
              </div>
              <div className="overflow-hidden rounded-[3px]" style={{ height: 6, background: AG_KPI_TOKENS.bgPage }}>
                <div
                  className={cn("h-full rounded-[3px]", KPI_BAR_WIDTH_TRANSITION_CLASS)}
                  style={{ width: `${widthPct}%`, background: d.fill }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </AllActiveTileShell>
  )
}

function StaticAwardedVsLostTile({
  awardedCount,
  lostCount,
  awardedDollars,
  lostDollars,
}: {
  awardedCount: number
  lostCount: number
  awardedDollars: number
  lostDollars: number
}) {
  const sumDl = awardedDollars + lostDollars
  const total = sumDl > 0 ? sumDl : 1

  return (
    <AllActiveTileShell>
      <AllActiveTileHeader
        label="Awarded vs lost"
        right={
          <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
            {awardedCount + lostCount} closed
          </span>
        }
      />
      <AllActiveTileHero
        value={awardedDollars >= 1_000_000 ? `$${(awardedDollars / 1_000_000).toFixed(1)}M` : `$${(awardedDollars / 1000).toFixed(0)}K`}
      />

      <div className="mt-1 flex flex-1 flex-col justify-center gap-[14px]">
        <div
          className="flex overflow-hidden rounded-[4px]"
          style={{ height: 8, gap: 1 }}
        >
          <div style={{ flex: Math.max(0.001, awardedDollars / total), background: AG_KPI_TOKENS.teal600 }} />
          <div style={{ flex: Math.max(0.001, lostDollars / total), background: AG_KPI_TOKENS.gray400 }} />
        </div>

        <div className="flex flex-col text-[11px]" style={{ gap: 8 }}>
          <div className="flex items-center gap-1.5">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
              style={{ background: AG_KPI_TOKENS.teal600 }}
              aria-hidden
            />
            <span style={{ color: AG_KPI_TOKENS.textSecondary }}>Awarded · {fmtComma(awardedCount)}</span>
            <span
              className="ml-auto font-bold tabular-nums dark:text-card-foreground"
              style={{ color: AG_KPI_TOKENS.textPrimary }}
            >
              {awardedDollars >= 1_000_000
                ? `$${(awardedDollars / 1_000_000).toFixed(2)}M`
                : `$${(awardedDollars / 1000).toFixed(0)}K`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
              style={{ background: AG_KPI_TOKENS.gray400 }}
              aria-hidden
            />
            <span style={{ color: AG_KPI_TOKENS.textSecondary }}>Lost · {fmtComma(lostCount)}</span>
            <span
              className="ml-auto font-bold tabular-nums dark:text-muted-foreground"
              style={{ color: AG_KPI_TOKENS.textTertiary }}
            >
              {lostDollars >= 1_000_000
                ? `$${(lostDollars / 1_000_000).toFixed(1)}M`
                : `$${(lostDollars / 1000).toFixed(0)}K`}
            </span>
          </div>
        </div>
      </div>
    </AllActiveTileShell>
  )
}

function StaticWinRateSparkTile({
  winPct,
  priorPct,
}: {
  winPct: number
  priorPct: number
}) {
  const uid = useId().replace(/:/g, "")
  const gradId = `wr-fill-${uid}`

  const deltaPts = winPct - priorPct
  const direction = deltaPts >= 0 ? "up" : "down"
  const deltaAbs = `${Math.abs(Math.round(deltaPts))} pts`

  return (
    <AllActiveTileShell>
      <AllActiveTileHeader label="Win rate" right={<AllActiveDeltaPill direction={direction} value={deltaAbs} />} />
      <AllActiveTileHero value={`${winPct}%`} caption={`vs ${priorPct}% prior period`} />

      <div className="flex min-h-0 w-full flex-1 flex-col" style={{ marginTop: 4, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            style={{ fontFamily: KPI_CHART_FONT }}
            data={[...ALL_ACTIVE_WIN_SPARK]}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0.18} />
                <stop offset="100%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={AG_KPI_TOKENS.teal600}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={false}
              animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
              animationEasing={KPI_CHART_ANIMATION_EASING}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </AllActiveTileShell>
  )
}

function fmtMoney(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1_000).toFixed(0)}K`
}

/** Mixed-alt `PulseStripBridge`: shadow + hover; selection uses muted fills, not rings. */
export const MIXED_ALT_TILE_CHROME = "shadow-sm transition-shadow hover:bg-muted/15 dark:shadow-sm"
export const DRILL_ROW_ACTIVE = "bg-muted/55 dark:bg-muted/45"

/** Board KPI tiles.jsx — compact dollar headline */
function fmtBoardDollar(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

/** Board reference AwardedTile.jsx cumulative curve shape (May→Apr); values scaled to live awarded sum. */
const BOARD_AWARDED_TREND_SHAPE = [
  { month: "May", value: 0 },
  { month: "Jun", value: 80_000 },
  { month: "Jul", value: 80_000 },
  { month: "Aug", value: 200_000 },
  { month: "Sep", value: 200_000 },
  { month: "Oct", value: 350_000 },
  { month: "Nov", value: 420_000 },
  { month: "Dec", value: 600_000 },
  { month: "Jan", value: 720_000 },
  { month: "Feb", value: 820_000 },
  { month: "Mar", value: 910_000 },
  { month: "Apr", value: 1_000_000 },
] as const

/** Board reference WinRateTile.jsx spark shape — scaled to live win % */
const BOARD_WIN_RATE_SHAPE = [
  { period: "P1", value: 14 },
  { period: "P2", value: 15 },
  { period: "P3", value: 16 },
  { period: "P4", value: 17 },
  { period: "P5", value: 17 },
  { period: "P6", value: 18 },
  { period: "P7", value: 18 },
  { period: "P8", value: 19 },
  { period: "P9", value: 19 },
  { period: "P10", value: 19 },
  { period: "P11", value: 20 },
  { period: "P12", value: 20 },
] as const

function scaleBoardAwardedTrend(totalAwarded: number): { month: string; value: number }[] {
  const peak = BOARD_AWARDED_TREND_SHAPE[BOARD_AWARDED_TREND_SHAPE.length - 1]!.value
  const scale = peak > 0 ? totalAwarded / peak : 0
  return BOARD_AWARDED_TREND_SHAPE.map((d) => ({
    month: d.month,
    value: Math.round(d.value * scale),
  }))
}

function scaleBoardWinRateSpark(winPct: number): { period: string; value: number }[] {
  const peak = BOARD_WIN_RATE_SHAPE[BOARD_WIN_RATE_SHAPE.length - 1]!.value
  const scale = peak > 0 ? winPct / peak : 1
  return BOARD_WIN_RATE_SHAPE.map((d) => ({
    period: d.period,
    value: Math.round(d.value * scale * 10) / 10,
  }))
}

/** Split awarded dollars by calendar-month half-year on deadline (board-scope pacing). */
function splitAwardedByDeadlineHalfYear(grants: Grant[]): { h1: number; h2: number } {
  let h1 = 0
  let h2 = 0
  for (const g of grants) {
    const part = g.deadline.split("T")[0] ?? ""
    const mo = parseInt(part.split("-")[1] ?? "", 10)
    if (!Number.isFinite(mo)) continue
    const bucket = mo <= 6 ? "h1" : "h2"
    if (bucket === "h1") h1 += g.award
    else h2 += g.award
  }
  return { h1, h2 }
}

/** Mixed-alt prospects tile: donut + funder mix (AllGrantsKPITiles Tile 1); drills → funnel “considered” or funder row. */
function BridgeProspectsConsideredTile({
  scope,
  drill,
  onDrillFunnelConsidered,
  onDrillFunder,
}: {
  scope: Grant[]
  drill: KpiDrill | null
  onDrillFunnelConsidered: () => void
  onDrillFunder: (ft: FunderType) => void
}) {
  const slices = useMemo(
    () => scaleConsideredByFunderToTotal(countConsideredGrantsByFunder(scope), FUNNEL_DISPLAY_CONSIDERED_COUNT),
    [scope],
  )
  const uid = useId().replace(/:/g, "")
  const total = FUNNEL_DISPLAY_CONSIDERED_COUNT
  const sorted = [...slices].sort((a, b) => b.value - a.value)
  const topPct = Math.round((100 * sorted[0]!.value) / Math.max(1, total))
  const funnelConsideredActive = drill?.kind === "funnel" && drill.stage === "considered"

  return (
    <AllActiveTileShell
      shellClassName={cn(MIXED_ALT_TILE_CHROME, funnelConsideredActive && DRILL_ROW_ACTIVE)}
    >
      <AllActiveTileHeader
        label="Prospects considered"
        right={
          <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
            {PROSPECTS_CONSIDERED_FUNDER_ORDER.length} funder types
          </span>
        }
      />
      <AllActiveTileHero value={fmtComma(total)} />

      <div className="mt-1 flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center gap-[14px]" style={{ marginTop: 4 }}>
          <button
            type="button"
            title='Filter table to "considered" prospects'
            className="relative h-24 w-24 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none"
            onClick={onDrillFunnelConsidered}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={46}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  stroke="none"
                  style={{ fontFamily: KPI_CHART_FONT }}
                  animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
                  animationEasing={KPI_CHART_ANIMATION_EASING}
                >
                  {slices.map((entry, idx) => (
                    <Cell key={`${uid}-bc-${idx}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden
            >
              <div
                className="text-[9px] font-bold uppercase leading-none tracking-[0.06em]"
                style={{ color: AG_KPI_TOKENS.textTertiary, fontFamily: KPI_CHART_FONT }}
              >
                Top
              </div>
              <div
                className="mt-0.5 text-[14px] font-bold leading-tight dark:text-card-foreground"
                style={{ color: AG_KPI_TOKENS.textPrimary, fontFamily: KPI_CHART_FONT }}
              >
                {topPct}%
              </div>
            </div>
          </button>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden text-[11px]" style={{ fontFamily: KPI_CHART_FONT }}>
            {slices.map((entry) => {
              const rowActive = drill?.kind === "funder" && drill.funderType === entry.funderType
              return (
                <button
                  key={entry.name}
                  type="button"
                  title={`Filter table to ${entry.name}`}
                  onClick={() => onDrillFunder(entry.funderType)}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left font-inherit outline-none transition-colors",
                    rowActive ? DRILL_ROW_ACTIVE : "hover:bg-muted/15",
                  )}
                >
                  <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: entry.color }} aria-hidden />
                  <span className="min-w-0 truncate" style={{ color: AG_KPI_TOKENS.textSecondary }}>
                    {entry.name}
                  </span>
                  <span
                    className="ml-auto shrink-0 font-bold tabular-nums dark:text-card-foreground"
                    style={{ color: AG_KPI_TOKENS.textTertiary }}
                  >
                    {entry.value.toLocaleString("en-US")}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </AllActiveTileShell>
  )
}

function BridgeInFlightTile({
  submittedCount,
  inProgressCount,
  submittedDollars,
  inProgressDollars,
  drill,
  onDrillInFlight,
}: {
  submittedCount: number
  inProgressCount: number
  submittedDollars: number
  inProgressDollars: number
  drill: KpiDrill | null
  onDrillInFlight: (slice: "submitted" | "inProgress") => void
}) {
  const rows = [
    { slice: "submitted" as const, type: "Submitted" as const, count: submittedCount, dollars: submittedDollars, fill: AG_KPI_TOKENS.purple600 },
    {
      slice: "inProgress" as const,
      type: "In progress" as const,
      count: inProgressCount,
      dollars: inProgressDollars,
      fill: AG_KPI_TOKENS.purple200,
    },
  ]
  const denom = submittedDollars + inProgressDollars
  const totalDollars = denom > 0 ? denom : 1
  return (
    <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
      <AllActiveTileHeader
        label="In flight"
        right={
          <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
            {submittedCount + inProgressCount} active
          </span>
        }
      />
      <AllActiveTileHero
        value={`$${(denom / 1_000_000).toFixed(1)}M`}
      />

      <div className="mt-1 flex min-h-0 flex-1 flex-col justify-center [gap:14px]">
        {rows.map((d) => {
          const widthPct = (d.dollars / totalDollars) * 100
          const rowActive = drill?.kind === "inFlight" && drill.slice === d.slice
          return (
            <button
              key={d.slice}
              type="button"
              title={`Filter table to ${d.type}`}
              onClick={() => onDrillInFlight(d.slice)}
              className={cn(
                "-mx-1 w-[calc(100%+8px)] rounded-md px-1 text-left font-inherit outline-none transition-colors",
                rowActive ? DRILL_ROW_ACTIVE : "hover:bg-muted/15",
              )}
            >
              <div className="mb-[5px] flex justify-between text-[11px]">
                <span style={{ color: AG_KPI_TOKENS.textSecondary }}>
                  {d.type}{" "}
                  <span style={{ color: AG_KPI_TOKENS.textTertiary }}>· {d.count}</span>
                </span>
                <span
                  className="font-bold tabular-nums dark:text-card-foreground"
                  style={{ color: AG_KPI_TOKENS.textPrimary }}
                >
                  ${(d.dollars / 1000).toFixed(0)}K
                </span>
              </div>
              <div className="overflow-hidden rounded-[3px]" style={{ height: 6, background: AG_KPI_TOKENS.bgPage }}>
                <div
                  className={cn("h-full rounded-[3px]", KPI_BAR_WIDTH_TRANSITION_CLASS)}
                  style={{ width: `${widthPct}%`, background: d.fill }}
                  aria-hidden
                />
              </div>
            </button>
          )
        })}
      </div>
    </AllActiveTileShell>
  )
}

function BridgeAwardedVsLostTile({
  awardedCount,
  lostCount,
  awardedDollars,
  lostDollars,
  drill,
  onDrillClosed,
}: {
  awardedCount: number
  lostCount: number
  awardedDollars: number
  lostDollars: number
  drill: KpiDrill | null
  onDrillClosed: (outcome: "awarded" | "lost") => void
}) {
  const sumDl = awardedDollars + lostDollars
  const total = sumDl > 0 ? sumDl : 1

  const heroAwarded =
    awardedDollars >= 1_000_000 ? `$${(awardedDollars / 1_000_000).toFixed(1)}M` : `$${(awardedDollars / 1000).toFixed(0)}K`

  return (
    <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
      <AllActiveTileHeader
        label="Awarded vs lost"
        right={
          <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
            {awardedCount + lostCount} closed
          </span>
        }
      />
      <AllActiveTileHero value={heroAwarded} />

      <div className="mt-1 flex flex-1 flex-col justify-center gap-[14px]">
        <div className="flex overflow-hidden rounded-[4px]" style={{ height: 8, gap: 1 }}>
          <div style={{ flex: awardedDollars / total, background: AG_KPI_TOKENS.teal600 }} />
          <div style={{ flex: lostDollars / total, background: AG_KPI_TOKENS.gray400 }} />
        </div>

        <div className="flex flex-col text-[11px]" style={{ gap: 8 }}>
          <button
            type="button"
            title="Filter to awarded"
            onClick={() => onDrillClosed("awarded")}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left font-inherit outline-none transition-colors hover:bg-muted/25",
              drill?.kind === "closed" && drill.outcome === "awarded" && DRILL_ROW_ACTIVE,
            )}
          >
            <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: AG_KPI_TOKENS.teal600 }} aria-hidden />
            <span style={{ color: AG_KPI_TOKENS.textSecondary }}>Awarded · {fmtComma(awardedCount)}</span>
            <span
              className="ml-auto font-bold tabular-nums dark:text-card-foreground"
              style={{ color: AG_KPI_TOKENS.textPrimary }}
            >
              {awardedDollars >= 1_000_000 ? `$${(awardedDollars / 1_000_000).toFixed(2)}M` : `$${(awardedDollars / 1000).toFixed(0)}K`}
            </span>
          </button>
          <button
            type="button"
            title="Filter to lost / declined"
            onClick={() => onDrillClosed("lost")}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left font-inherit outline-none transition-colors hover:bg-muted/25",
              drill?.kind === "closed" && drill.outcome === "lost" && DRILL_ROW_ACTIVE,
            )}
          >
            <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: AG_KPI_TOKENS.gray400 }} aria-hidden />
            <span style={{ color: AG_KPI_TOKENS.textSecondary }}>Lost · {fmtComma(lostCount)}</span>
            <span className="ml-auto font-bold tabular-nums dark:text-muted-foreground" style={{ color: AG_KPI_TOKENS.textTertiary }}>
              {lostDollars >= 1_000_000 ? `$${(lostDollars / 1_000_000).toFixed(1)}M` : `$${(lostDollars / 1000).toFixed(0)}K`}
            </span>
          </button>
        </div>
      </div>
    </AllActiveTileShell>
  )
}

function BridgeWinRateSparkTile({
  drill,
  winPct,
  priorPct,
  onDrillWinrate,
}: {
  drill: KpiDrill | null
  winPct: number
  priorPct: number
  onDrillWinrate: () => void
}) {
  const uid = useId().replace(/:/g, "")
  const gradId = `wr-fill-br-${uid}`
  const deltaPts = winPct - priorPct
  const direction = deltaPts >= 0 ? "up" : "down"
  const deltaAbs = `${Math.abs(Math.round(deltaPts))} pts`
  const winrateActive = drill?.kind === "winrate"

  return (
    <button
      type="button"
      title="Filter to win-rate cohort"
      onClick={onDrillWinrate}
      style={{ fontFamily: KPI_CHART_FONT }}
      className={cn(
        "flex h-[260px] w-full flex-col rounded-[12px] border-[0.5px] p-[18px] text-left [gap:10px] outline-none",
        "border-[rgba(0,0,0,0.08)] bg-[color:#FFFFFF] dark:border-border dark:bg-card",
        MIXED_ALT_TILE_CHROME,
        winrateActive && DRILL_ROW_ACTIVE,
      )}
    >
      <AllActiveTileHeader label="Win rate" right={<AllActiveDeltaPill direction={direction} value={deltaAbs} />} />
      <AllActiveTileHero value={`${winPct}%`} caption={`vs ${priorPct}% prior period`} />

      <div className="flex min-h-0 w-full flex-1 flex-col" style={{ marginTop: 4, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            style={{ fontFamily: KPI_CHART_FONT }}
            data={[...ALL_ACTIVE_WIN_SPARK]}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0.18} />
                <stop offset="100%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={AG_KPI_TOKENS.teal600}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={false}
              animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
              animationEasing={KPI_CHART_ANIMATION_EASING}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </button>
  )
}

export function PulseStripBridgeRecharts(props: {
  baseScope: Grant[]
  drill: KpiDrill | null
  onDrill: (next: KpiDrill | null) => void
}) {
  const { baseScope, drill, onDrill } = props

  /**
   * KPI tiles always aggregate the full view-filtered grant set (`baseScope`).
   * The active drill only narrows the table via `kpiBridgeFilter` — if we filtered
   * aggregates by drill too, bars/rows shrink and other segments become hard to hit.
   */
  const aggregateScope = baseScope

  const submittedGrants = useMemo(
    () => aggregateScope.filter((g) => g.stage === "Application Submitted"),
    [aggregateScope],
  )
  const inProgGrants = useMemo(
    () => aggregateScope.filter((g) => g.stage === "Application In Progress"),
    [aggregateScope],
  )
  const submittedDollars = useMemo(() => sumAward(submittedGrants), [submittedGrants])
  const inProgressDollars = useMemo(() => sumAward(inProgGrants), [inProgGrants])

  const awardedClosed = useMemo(() => aggregateScope.filter((g) => g.stage === "Awarded - Active"), [aggregateScope])
  const lostGrants = useMemo(
    () => aggregateScope.filter((g) => g.stage === "Closed" || g.stage === "Declined"),
    [aggregateScope],
  )
  const awardedDollars = useMemo(() => sumAward(awardedClosed), [awardedClosed])
  const lostDollars = useMemo(() => sumAward(lostGrants), [lostGrants])

  const priorWinPct = 22
  const winPct = useMemo(() => {
    const denom = Math.max(
      1,
      aggregateScope.filter((g) => g.stage !== "Closed" && g.stage !== "Declined").length,
    )
    return Math.round((100 * awardedClosed.length) / denom)
  }, [aggregateScope, awardedClosed.length])

  function drillFunnel(stage: FunnelStageId) {
    if (drill?.kind === "funnel" && drill.stage === stage) {
      onDrill(null)
      return
    }
    onDrill({ kind: "funnel", stage })
  }
  function drillInFlight(slice: "submitted" | "inProgress") {
    if (drill?.kind === "inFlight" && drill.slice === slice) {
      onDrill(null)
      return
    }
    onDrill({ kind: "inFlight", slice })
  }
  function drillClosed(outcome: "awarded" | "lost") {
    if (drill?.kind === "closed" && drill.outcome === outcome) {
      onDrill(null)
      return
    }
    onDrill({ kind: "closed", outcome })
  }
  function drillFunder(ft: FunderType) {
    if (drill?.kind === "funder" && drill.funderType === ft) {
      onDrill(null)
      return
    }
    onDrill({ kind: "funder", funderType: ft })
  }
  function drillWinrate() {
    if (drill?.kind === "winrate") {
      onDrill(null)
      return
    }
    onDrill({ kind: "winrate" })
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 font-sans md:grid-cols-2 xl:grid-cols-4">
      <BridgeProspectsConsideredTile
        scope={aggregateScope}
        drill={drill}
        onDrillFunnelConsidered={() => drillFunnel("considered")}
        onDrillFunder={drillFunder}
      />
      <BridgeInFlightTile
        submittedCount={submittedGrants.length}
        inProgressCount={inProgGrants.length}
        submittedDollars={submittedDollars}
        inProgressDollars={inProgressDollars}
        drill={drill}
        onDrillInFlight={drillInFlight}
      />
      <BridgeAwardedVsLostTile
        awardedCount={awardedClosed.length}
        lostCount={lostGrants.length}
        awardedDollars={awardedDollars}
        lostDollars={lostDollars}
        drill={drill}
        onDrillClosed={drillClosed}
      />
      <BridgeWinRateSparkTile
        drill={drill}
        winPct={winPct}
        priorPct={priorWinPct}
        onDrillWinrate={drillWinrate}
      />
    </div>
  )
}

/** Template 2 — Board / Leadership: BoardKPITiles.jsx visuals + live aggregates & board-slice drills. */
export function PulseStripBoardLeadership(props: {
  baseScope: Grant[]
  drill: KpiDrill | null
  onDrill: (next: KpiDrill | null) => void
}) {
  const { baseScope, drill, onDrill } = props
  const aggregateScope = baseScope

  const uidAward = useId().replace(/:/g, "")
  const uidWin = useId().replace(/:/g, "")
  const gradAwarded = `aw-fill-board-${uidAward}`
  const gradWin = `wr-fill-board-${uidWin}`

  const prospects = useMemo(
    () => aggregateScope.filter((g) => grantMatchesBoardKpiSlice(g, "prospects")),
    [aggregateScope],
  )
  const inProg = useMemo(
    () => aggregateScope.filter((g) => grantMatchesBoardKpiSlice(g, "inProgress")),
    [aggregateScope],
  )
  const subPen = useMemo(
    () => aggregateScope.filter((g) => grantMatchesBoardKpiSlice(g, "submittedPending")),
    [aggregateScope],
  )
  const awarded = useMemo(
    () => aggregateScope.filter((g) => grantMatchesBoardKpiSlice(g, "awarded")),
    [aggregateScope],
  )
  const declined = useMemo(
    () => aggregateScope.filter((g) => grantMatchesBoardKpiSlice(g, "declined")),
    [aggregateScope],
  )

  const inProgRequested = useMemo(() => sumWeighted(inProg), [inProg])
  const subPenRequested = useMemo(() => sumWeighted(subPen), [subPen])
  const awardedSum = useMemo(() => sumAward(awarded), [awarded])
  const declinedSum = useMemo(() => sumAward(declined), [declined])

  const pipelineTotal = subPenRequested + inProgRequested
  const pipelineCount = subPen.length + inProg.length
  const pipelineDenom = pipelineTotal > 0 ? pipelineTotal : 1

  const pursuedTotal = awardedSum + declinedSum
  const pursuedDenom = pursuedTotal > 0 ? pursuedTotal : 1

  const awardedTrendData = useMemo(() => scaleBoardAwardedTrend(awardedSum), [awardedSum])

  const { h1, h2 } = useMemo(() => splitAwardedByDeadlineHalfYear(awarded), [awarded])
  const awardedHalfGrowthPct = useMemo(() => {
    if (h1 <= 0 && h2 <= 0) return 0
    if (h1 <= 0) return 100
    return Math.round((100 * (h2 - h1)) / h1)
  }, [h1, h2])
  const awardedGrowthDirection: "up" | "down" = h2 >= h1 ? "up" : "down"

  const winDollarPct = pursuedTotal > 0 ? Math.round((100 * awardedSum) / pursuedTotal) : 0
  const priorWinPct = winDollarPct > 0 ? Math.max(0, Math.round(winDollarPct * 0.92)) : 0
  const winPtsDeltaRaw = winDollarPct - priorWinPct
  const winPtsDelta = Math.abs(winPtsDeltaRaw)
  const winDeltaDirection: "up" | "down" = winPtsDeltaRaw >= 0 ? "up" : "down"
  const winSparkData = useMemo(() => scaleBoardWinRateSpark(winDollarPct), [winDollarPct])

  function drillBoard(slice: BoardKpiSlice) {
    if (drill?.kind === "board" && drill.slice === slice) {
      onDrill(null)
      return
    }
    onDrill({ kind: "board", slice })
  }

  function drillWinrate() {
    if (drill?.kind === "winrate") {
      onDrill(null)
      return
    }
    onDrill({ kind: "winrate" })
  }

  const awardedActive = drill?.kind === "board" && drill.slice === "awarded"
  const winrateActive = drill?.kind === "winrate"

  const pendingReviewActive = drill?.kind === "board" && drill.slice === "submittedPending"
  const beingWrittenActive = drill?.kind === "board" && drill.slice === "inProgress"

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 font-sans md:grid-cols-2 xl:grid-cols-4">
      {/* Tile 1 — Active pipeline (Pending review + Being written) */}
      <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
        <AllActiveTileHeader
          label="Active pipeline"
          right={
            <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
              From {fmtComma(prospects.length)} prospects
            </span>
          }
        />
        <AllActiveTileHero
          value={fmtBoardDollar(pipelineTotal)}
          caption={`Across ${pipelineCount} grants in motion`}
        />

        <div className="mt-1 flex min-h-0 flex-1 flex-col justify-center [gap:14px]" style={{ marginTop: 4 }}>
          {(
            [
              {
                slice: "submittedPending" as const,
                label: "Pending review",
                count: subPen.length,
                dollars: subPenRequested,
                fill: AG_KPI_TOKENS.purple600,
                active: pendingReviewActive,
              },
              {
                slice: "inProgress" as const,
                label: "Being written",
                count: inProg.length,
                dollars: inProgRequested,
                fill: AG_KPI_TOKENS.purple200,
                active: beingWrittenActive,
              },
            ] as const
          ).map((row) => {
            const widthPct = (row.dollars / pipelineDenom) * 100
            return (
              <button
                key={row.slice}
                type="button"
                title={`Filter table — ${row.label}`}
                onClick={() => drillBoard(row.slice)}
                className={cn(
                  "-mx-1 w-[calc(100%+8px)] rounded-md px-1 text-left font-inherit outline-none transition-colors",
                  row.active ? DRILL_ROW_ACTIVE : "hover:bg-muted/15",
                )}
                style={{ fontFamily: KPI_CHART_FONT }}
              >
                <div className="mb-[5px] flex justify-between text-[11px]">
                  <span style={{ color: AG_KPI_TOKENS.textSecondary }}>
                    {row.label}{" "}
                    <span style={{ color: AG_KPI_TOKENS.textTertiary }}>· {row.count}</span>
                  </span>
                  <span
                    className="font-bold tabular-nums dark:text-card-foreground"
                    style={{ color: AG_KPI_TOKENS.textPrimary }}
                  >
                    {fmtBoardDollar(row.dollars)}
                  </span>
                </div>
                <div className="overflow-hidden rounded-[3px]" style={{ height: 6, background: AG_KPI_TOKENS.bgPage }}>
                  <div
                    className={cn("h-full rounded-[3px]", KPI_BAR_WIDTH_TRANSITION_CLASS)}
                    style={{ width: `${widthPct}%`, background: row.fill }}
                    aria-hidden
                  />
                </div>
              </button>
            )
          })}
        </div>
      </AllActiveTileShell>

      {/* Tile 2 — Awarded · YTD */}
      <button
        type="button"
        title="Filter table — Awarded"
        onClick={() => drillBoard("awarded")}
        style={{ fontFamily: KPI_CHART_FONT }}
        className={cn(
          "flex h-[260px] w-full flex-col rounded-[12px] border-[0.5px] p-[18px] text-left [gap:10px] outline-none",
          "border-[rgba(0,0,0,0.08)] bg-[color:#FFFFFF] dark:border-border dark:bg-card",
          MIXED_ALT_TILE_CHROME,
          awardedActive && DRILL_ROW_ACTIVE,
        )}
      >
        <AllActiveTileHeader
          label="Awarded · YTD"
          right={<AllActiveDeltaPill direction={awardedGrowthDirection} value={`${Math.abs(awardedHalfGrowthPct)}%`} />}
        />
        <AllActiveTileHero value={fmtBoardDollar(awardedSum)} caption={`Across ${awarded.length} grants this year`} />

        <div className="flex min-h-0 w-full flex-1 flex-col" style={{ marginTop: 4, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              style={{ fontFamily: KPI_CHART_FONT }}
              data={awardedTrendData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradAwarded} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={AG_KPI_TOKENS.teal600}
                strokeWidth={1.5}
                fill={`url(#${gradAwarded})`}
                dot={false}
                activeDot={false}
                animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
                animationEasing={KPI_CHART_ANIMATION_EASING}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </button>

      {/* Tile 3 — Pursued vs awarded */}
      <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
        <AllActiveTileHeader
          label="Pursued vs awarded"
          right={
            <span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>
              {awarded.length + declined.length} closed
            </span>
          }
        />
        <AllActiveTileHero value={fmtBoardDollar(pursuedTotal)} caption="Total pursued this year" />

        <div className="mt-1 flex flex-1 flex-col justify-center [gap:14px]" style={{ marginTop: 4 }}>
          <div className="flex overflow-hidden rounded-[4px]" style={{ height: 8, gap: 1 }}>
            <div style={{ flex: awardedSum / pursuedDenom, background: AG_KPI_TOKENS.teal600 }} />
            <div style={{ flex: declinedSum / pursuedDenom, background: AG_KPI_TOKENS.gray400 }} />
          </div>

          <div className="flex flex-col text-[11px]" style={{ gap: 8 }}>
            <button
              type="button"
              title="Filter to awarded"
              onClick={() => drillBoard("awarded")}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left font-inherit outline-none transition-colors hover:bg-muted/25",
                drill?.kind === "board" && drill.slice === "awarded" && DRILL_ROW_ACTIVE,
              )}
              style={{ fontFamily: KPI_CHART_FONT }}
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: AG_KPI_TOKENS.teal600 }} aria-hidden />
              <span style={{ color: AG_KPI_TOKENS.textSecondary }}>Awarded · {fmtComma(awarded.length)}</span>
              <span
                className="ml-auto font-bold tabular-nums dark:text-card-foreground"
                style={{ color: AG_KPI_TOKENS.textPrimary }}
              >
                {fmtBoardDollar(awardedSum)}
              </span>
            </button>
            <button
              type="button"
              title="Filter to not funded"
              onClick={() => drillBoard("declined")}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left font-inherit outline-none transition-colors hover:bg-muted/25",
                drill?.kind === "board" && drill.slice === "declined" && DRILL_ROW_ACTIVE,
              )}
              style={{ fontFamily: KPI_CHART_FONT }}
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: AG_KPI_TOKENS.gray400 }} aria-hidden />
              <span style={{ color: AG_KPI_TOKENS.textSecondary }}>Not funded · {fmtComma(declined.length)}</span>
              <span className="ml-auto font-bold tabular-nums dark:text-muted-foreground" style={{ color: AG_KPI_TOKENS.textTertiary }}>
                {fmtBoardDollar(declinedSum)}
              </span>
            </button>
          </div>
        </div>
      </AllActiveTileShell>

      {/* Tile 4 — Win rate · YTD */}
      <button
        type="button"
        title="Filter to win-rate cohort"
        onClick={drillWinrate}
        style={{ fontFamily: KPI_CHART_FONT }}
        className={cn(
          "flex h-[260px] w-full flex-col rounded-[12px] border-[0.5px] p-[18px] text-left [gap:10px] outline-none",
          "border-[rgba(0,0,0,0.08)] bg-[color:#FFFFFF] dark:border-border dark:bg-card",
          MIXED_ALT_TILE_CHROME,
          winrateActive && DRILL_ROW_ACTIVE,
        )}
      >
        <AllActiveTileHeader
          label="Win rate · YTD"
          right={<AllActiveDeltaPill direction={winDeltaDirection} value={`${winPtsDelta} pts`} />}
        />
        <AllActiveTileHero value={`${winDollarPct}%`} caption={`vs ${priorWinPct}% prior period`} />

        <div className="flex min-h-0 w-full flex-1 flex-col" style={{ marginTop: 4, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              style={{ fontFamily: KPI_CHART_FONT }}
              data={winSparkData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradWin} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={AG_KPI_TOKENS.teal600} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={AG_KPI_TOKENS.teal600}
                strokeWidth={1.5}
                fill={`url(#${gradWin})`}
                dot={false}
                activeDot={false}
                animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
                animationEasing={KPI_CHART_ANIMATION_EASING}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </button>
    </div>
  )
}

/** Static All grants KPI row ("All active" Mixed branch) — AllGrants KPI tiles prototype visuals; non-drilling. */
export function PulseStripRechartsStatic() {
  const displayScope = useMemo(
    () => grants.filter((g) => g.stage !== "Closed" && g.stage !== "Declined"),
    [],
  )

  const { inProgressCount, submittedCount } = useMemo(() => {
    let inProgress = 0
    let submitted = 0
    for (const g of displayScope) {
      switch (grantFunnelStage(g)) {
        case "inProgress":
          inProgress++
          break
        case "submitted":
          submitted++
          break
        default:
          break
      }
    }
    return {
      inProgressCount: inProgress,
      submittedCount: submitted,
    }
  }, [displayScope])

  const submittedDollars = useMemo(
    () => sumAward(displayScope.filter((g) => g.stage === "Application Submitted")),
    [displayScope],
  )
  const inProgressDollars = useMemo(
    () => sumAward(displayScope.filter((g) => g.stage === "Application In Progress")),
    [displayScope],
  )

  const awardedActive = useMemo(() => displayScope.filter((g) => g.stage === "Awarded - Active"), [displayScope])
  const awardedActiveCount = awardedActive.length
  const awardedActiveDollars = useMemo(() => sumAward(awardedActive), [awardedActive])

  const lost = useMemo(() => grants.filter((g) => g.stage === "Closed" || g.stage === "Declined"), [])
  const lostCount = lost.length
  const lostDollars = useMemo(() => sumAward(lost), [lost])

  const winPct = useMemo(() => {
    const winDenom = Math.max(1, displayScope.length)
    return Math.round((100 * awardedActiveCount) / winDenom)
  }, [displayScope.length, awardedActiveCount])

  /** Matches prototype “vs 22% prior period” framing (spark remains illustrative). */
  const priorWinPct = 22

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 font-sans md:grid-cols-2 xl:grid-cols-4">
      <StaticProspectsConsideredTile scope={displayScope} />
      <StaticInFlightTile
        submittedCount={submittedCount}
        inProgressCount={inProgressCount}
        submittedDollars={submittedDollars}
        inProgressDollars={inProgressDollars}
      />
      <StaticAwardedVsLostTile
        awardedCount={awardedActiveCount}
        lostCount={lostCount}
        awardedDollars={awardedActiveDollars}
        lostDollars={lostDollars}
      />
      <StaticWinRateSparkTile winPct={winPct} priorPct={priorWinPct} />
    </div>
  )
}
