"use client"

import { useId, useMemo } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import type { FunderType, Grant } from "@/lib/manage/types"
import { FUNDER_BREAKDOWN_ORDER } from "@/lib/manage/kpi-bridge"
import {
  aggregateFunderRows,
  classifyRepeatBuckets,
  funderFirstYear,
  funderHasMultiYearRelationship,
  type FunderPortfolioKpiState,
} from "@/lib/manage/funder-portfolio"
import {
  AG_KPI_TOKENS,
  AllActiveDeltaPill,
  AllActiveTileHeader,
  AllActiveTileHero,
  AllActiveTileShell,
  DRILL_ROW_ACTIVE,
  KpiAnimatedBar,
  KpiChartMotionProvider,
  KPI_CHART_ANIMATION_DURATION_MS,
  KPI_CHART_ANIMATION_EASING,
  KPI_CHART_FONT,
  KPI_ROW_IDLE_HOVER,
  MIXED_ALT_TILE_CHROME,
  useKpiChartMotion,
} from "@/components/manage/all-grants-kpi-tiles"

export type { FunderPortfolioKpiState }

function fmtComma(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function fmtBoard$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

const FUNDER_TYPE_COLOR: Record<FunderType, string> = {
  Federal: AG_KPI_TOKENS.purple600,
  Private: AG_KPI_TOKENS.purple400,
  Corporate: AG_KPI_TOKENS.purple200,
  State: AG_KPI_TOKENS.purple100,
  Local: AG_KPI_TOKENS.purple50,
}

function fundersActiveInYear(grantsSource: Grant[], year: number): Set<string> {
  const s = new Set<string>()
  for (const g of grantsSource) {
    const y = parseInt(g.deadline.split("T")[0]?.split("-")[0] ?? "", 10)
    if (y === year) s.add(g.funder.trim())
  }
  return s
}

export function PulseStripFunderPortfolio(props: {
  grantsScoped: Grant[]
  grantsFull: Grant[]
  anchorYear: number
  kpi: FunderPortfolioKpiState
  onKpiChange: (next: FunderPortfolioKpiState) => void
  selectedFunderType: FunderType | null
  onFunderTypeChange: (next: FunderType | null) => void
}) {
  return (
    <KpiChartMotionProvider>
      <PulseStripFunderPortfolioInner {...props} />
    </KpiChartMotionProvider>
  )
}

function PulseStripFunderPortfolioInner({
  grantsScoped,
  grantsFull,
  anchorYear,
  kpi,
  onKpiChange,
  selectedFunderType,
  onFunderTypeChange,
}: {
  grantsScoped: Grant[]
  grantsFull: Grant[]
  anchorYear: number
  kpi: FunderPortfolioKpiState
  onKpiChange: (next: FunderPortfolioKpiState) => void
  selectedFunderType: FunderType | null
  onFunderTypeChange: (next: FunderType | null) => void
}) {
  const { chartReady, reducedMotion } = useKpiChartMotion()
  const now = useMemo(() => new Date(), [])
  const uid = useId().replace(/:/g, "")

  const rows = useMemo(() => aggregateFunderRows(grantsScoped, now), [grantsScoped, now])

  const distinctFunders = rows.length
  const newThisYear = useMemo(() => {
    let n = 0
    for (const r of rows) {
      const fy = funderFirstYear(r.funder, grantsFull)
      if (fy === anchorYear) n++
    }
    return n
  }, [rows, grantsFull, anchorYear])
  const returning = Math.max(0, distinctFunders - newThisYear)

  const priorYearFunders = fundersActiveInYear(grantsFull, anchorYear - 1).size
  const currYearFunders = fundersActiveInYear(grantsFull, anchorYear).size
  const funderYoY = currYearFunders - priorYearFunders
  const funderDeltaDirection = funderYoY >= 0 ? "up" : "down"

  const mixSlices = useMemo(() => {
    const counts: Record<FunderType, number> = {
      Federal: 0,
      Private: 0,
      Corporate: 0,
      State: 0,
      Local: 0,
    }
    for (const r of rows) {
      counts[r.funderType]++
    }
    return FUNDER_BREAKDOWN_ORDER.filter((ft) => counts[ft] > 0).map((ft) => ({
      name: ft,
      value: counts[ft],
      color: FUNDER_TYPE_COLOR[ft],
      funderType: ft,
    }))
  }, [rows])

  const mixTotal = mixSlices.reduce((s, d) => s + d.value, 0)
  const topMix = mixSlices[0]
  const topMixPct = topMix && mixTotal > 0 ? Math.round((100 * topMix.value) / mixTotal) : 0

  const totalAwardedAll = rows.reduce((s, r) => s + r.totalAwarded, 0)
  const top5Rows = [...rows].sort((a, b) => b.totalAwarded - a.totalAwarded).slice(0, 5)
  const top5Sum = top5Rows.reduce((s, r) => s + r.totalAwarded, 0)
  const concentrationPct =
    totalAwardedAll > 0 ? Math.round((100 * top5Sum) / totalAwardedAll) : 0
  const maxBar = top5Rows[0]?.totalAwarded ?? 1

  const repeatBuckets = useMemo(() => classifyRepeatBuckets(grantsScoped, now), [grantsScoped, now])
  const repeatMultiYearCount = rows.filter((r) => funderHasMultiYearRelationship(r.grants)).length

  function clearKpi() {
    onKpiChange({ topFundersOnly: false, multiYearOnly: false })
    onFunderTypeChange(null)
  }

  const barColors = [
    AG_KPI_TOKENS.purple600,
    AG_KPI_TOKENS.purple400,
    "#7E87E8",
    AG_KPI_TOKENS.purple200,
    "#9B92D4",
  ]

  const repeatLegend = [
    { key: "active" as const, label: "Active relationships", count: repeatBuckets.active, fill: AG_KPI_TOKENS.teal600 },
    { key: "due" as const, label: "Renewal due (next 90d)", count: repeatBuckets.due90, fill: "#C9782A" },
    { key: "lapsed" as const, label: "Lapsed (no renewal yet)", count: repeatBuckets.lapsed, fill: AG_KPI_TOKENS.gray400 },
  ]

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 font-sans md:grid-cols-2 xl:grid-cols-4">
      <button
        type="button"
        title="Show full funder portfolio scope"
        onClick={clearKpi}
        style={{ fontFamily: KPI_CHART_FONT }}
        className={cn(
          "flex h-[220px] w-full flex-col rounded-[12px] border-[0.5px] p-[18px] text-left gap-1.5 outline-none",
          "border-[rgba(0,0,0,0.08)] bg-[color:#FFFFFF] dark:border-border dark:bg-card",
          MIXED_ALT_TILE_CHROME,
        )}
      >
        <AllActiveTileHeader
          label="Total funders"
          right={<AllActiveDeltaPill direction={funderDeltaDirection} value={`${Math.abs(funderYoY)}`} />}
        />
        <AllActiveTileHero value={fmtComma(distinctFunders)} />

        <div className="-mt-1 flex min-h-0 flex-1 flex-col justify-center gap-2">
          <div>
            <div className="mb-1 flex justify-between text-[11px]">
              <span style={{ color: AG_KPI_TOKENS.textSecondary }}>Returning</span>
              <span className="font-bold tabular-nums dark:text-card-foreground" style={{ color: AG_KPI_TOKENS.textPrimary }}>
                {fmtComma(returning)}
              </span>
            </div>
            <div className="overflow-hidden rounded-[3px]" style={{ height: 6, background: AG_KPI_TOKENS.bgPage }}>
              <KpiAnimatedBar
                widthPct={distinctFunders > 0 ? (returning / distinctFunders) * 100 : 0}
                background={AG_KPI_TOKENS.purple600}
                className="rounded-[3px]"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px]">
              <span style={{ color: AG_KPI_TOKENS.textSecondary }}>New this year</span>
              <span className="font-bold tabular-nums dark:text-card-foreground" style={{ color: AG_KPI_TOKENS.textPrimary }}>
                {fmtComma(newThisYear)}
              </span>
            </div>
            <div className="overflow-hidden rounded-[3px]" style={{ height: 6, background: AG_KPI_TOKENS.bgPage }}>
              <KpiAnimatedBar
                widthPct={distinctFunders > 0 ? (newThisYear / distinctFunders) * 100 : 0}
                background={AG_KPI_TOKENS.purple50}
                className="rounded-[3px]"
              />
            </div>
          </div>
        </div>
      </button>

      <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
        <AllActiveTileHeader
          label="Funder mix"
          right={<span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>By type</span>}
        />
        <AllActiveTileHero value={`${mixTotal}`} />

        <div className="-mt-1 flex min-h-0 flex-1 items-center gap-2">
          <div className="relative h-20 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart tabIndex={-1}>
                <Pie
                  data={mixSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={26}
                  outerRadius={36}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  stroke="none"
                  style={{ fontFamily: KPI_CHART_FONT }}
                  isAnimationActive={!reducedMotion && chartReady}
                  animationDuration={reducedMotion ? 0 : KPI_CHART_ANIMATION_DURATION_MS}
                  animationEasing={KPI_CHART_ANIMATION_EASING}
                  onClick={(_, index) => {
                    const ft = mixSlices[index]?.funderType
                    if (!ft) return
                    onKpiChange({ topFundersOnly: false, multiYearOnly: false })
                    onFunderTypeChange(selectedFunderType === ft ? null : ft)
                  }}
                >
                  {mixSlices.map((entry, idx) => (
                    <Cell
                      key={`${uid}-mix-${idx}`}
                      fill={entry.color}
                      stroke="none"
                      className={cn(
                        "cursor-pointer outline-none transition-opacity hover:opacity-90",
                        selectedFunderType === entry.funderType && "opacity-100 ring-1 ring-primary/45 ring-offset-2 ring-offset-background dark:ring-offset-card",
                      )}
                    />
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
                {topMixPct}%
              </div>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden text-[11px]" style={{ fontFamily: KPI_CHART_FONT }}>
            {mixSlices.map((entry) => {
              const rowAct = selectedFunderType === entry.funderType
              return (
                <button
                  key={entry.name}
                  type="button"
                  title={`Filter · Funder type · ${entry.name}`}
                  onClick={() => {
                    onKpiChange({ topFundersOnly: false, multiYearOnly: false })
                    onFunderTypeChange(rowAct ? null : entry.funderType)
                  }}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left font-inherit outline-none transition-[background-color,box-shadow]",
                    rowAct ? DRILL_ROW_ACTIVE : KPI_ROW_IDLE_HOVER,
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
                    {entry.value}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </AllActiveTileShell>

      <button
        type="button"
        title="Filter · Top 5 funders by awarded"
        onClick={() =>
          onKpiChange({
            ...kpi,
            topFundersOnly: !kpi.topFundersOnly,
            multiYearOnly: false,
          })
        }
        style={{ fontFamily: KPI_CHART_FONT }}
        className={cn(
          "flex h-[220px] w-full flex-col rounded-[12px] border-[0.5px] p-[18px] text-left gap-1.5 outline-none",
          "border-[rgba(0,0,0,0.08)] bg-[color:#FFFFFF] dark:border-border dark:bg-card",
          MIXED_ALT_TILE_CHROME,
          kpi.topFundersOnly && DRILL_ROW_ACTIVE,
        )}
      >
        <AllActiveTileHeader
          label="Top funder concentration"
          right={<span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>Top 5</span>}
        />
        <AllActiveTileHero value={`${concentrationPct}%`} />

        <div className="-mt-1 flex min-h-0 flex-1 flex-col justify-center gap-1.5 text-[11px]" style={{ fontFamily: KPI_CHART_FONT }}>
          {top5Rows.map((d, idx) => {
            const widthPct = maxBar > 0 ? (d.totalAwarded / maxBar) * 100 : 0
            return (
              <div key={d.key} className="flex items-center gap-2">
                <span
                  className="line-clamp-1 shrink-0 basis-[110px] overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ color: AG_KPI_TOKENS.textSecondary }}
                >
                  {d.funder}
                </span>
                <div className="min-h-px min-w-0 flex-1 overflow-hidden rounded-[3px]" style={{ height: 6, background: AG_KPI_TOKENS.bgPage }}>
                  <KpiAnimatedBar
                    widthPct={widthPct}
                    background={barColors[idx] ?? AG_KPI_TOKENS.purple200}
                    className="rounded-[3px]"
                  />
                </div>
                <span
                  className="shrink-0 basis-[42px] text-right font-bold tabular-nums dark:text-card-foreground"
                  style={{ color: AG_KPI_TOKENS.textPrimary }}
                >
                  {fmtBoard$(d.totalAwarded)}
                </span>
              </div>
            )
          })}
        </div>
      </button>

      <button
        type="button"
        title="Filter · Multi-year relationships"
        onClick={() =>
          onKpiChange({
            ...kpi,
            multiYearOnly: !kpi.multiYearOnly,
            topFundersOnly: false,
          })
        }
        style={{ fontFamily: KPI_CHART_FONT }}
        className={cn(
          "flex h-[220px] w-full flex-col rounded-[12px] border-[0.5px] p-[18px] text-left gap-1.5 outline-none",
          "border-[rgba(0,0,0,0.08)] bg-[color:#FFFFFF] dark:border-border dark:bg-card",
          MIXED_ALT_TILE_CHROME,
          kpi.multiYearOnly && DRILL_ROW_ACTIVE,
        )}
      >
        <AllActiveTileHeader
          label="Repeat funders"
          right={<span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>Multi-year</span>}
        />
        <AllActiveTileHero value={`${fmtComma(repeatMultiYearCount)}`} />

        <div className="-mt-1 flex min-h-0 flex-1 flex-col justify-center gap-2">
          <div className="flex overflow-hidden rounded-[4px]" style={{ height: 8, gap: 1 }}>
            {repeatLegend.map((d) => (
              <div key={d.key} style={{ flex: Math.max(1, d.count), background: d.fill }} aria-hidden />
            ))}
          </div>
          <div className="flex flex-col gap-1 text-[11px]">
            {repeatLegend.map((d, idx) => (
              <div key={d.key} className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: d.fill }} aria-hidden />
                <span style={{ color: AG_KPI_TOKENS.textSecondary }}>{d.label}</span>
                <span
                  className={cn(
                    "ml-auto font-bold tabular-nums",
                    idx === 0 ? "dark:text-card-foreground" : "dark:text-muted-foreground",
                  )}
                  style={{ color: idx === 0 ? AG_KPI_TOKENS.textPrimary : AG_KPI_TOKENS.textTertiary }}
                >
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </button>
    </div>
  )
}
