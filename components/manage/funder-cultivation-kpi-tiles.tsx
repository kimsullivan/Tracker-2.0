"use client"

import { useId, useMemo } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import type { FunderType, Grant } from "@/lib/manage/types"
import { FUNDER_BREAKDOWN_ORDER } from "@/lib/manage/kpi-bridge"
import { aggregateFunderRows, funderFirstYear } from "@/lib/manage/funder-portfolio"
import { buildCultivationKpiModel } from "@/lib/manage/funder-cultivation"
import {
  AG_KPI_TOKENS,
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

function fmtBoard$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function fmtComma(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

const FUNDER_TYPE_COLOR: Record<FunderType, string> = {
  Federal: AG_KPI_TOKENS.purple600,
  Private: AG_KPI_TOKENS.purple400,
  Corporate: AG_KPI_TOKENS.purple200,
  State: AG_KPI_TOKENS.purple100,
  Local: AG_KPI_TOKENS.purple50,
}

export function PulseStripFunderCultivation(props: {
  grantsKpi: Grant[]
  grantsLifetime: Grant[]
  grantsFull: Grant[]
  anchorYear: number
  now: Date
  selectedFunderType: FunderType | null
  onFunderTypeChange: (next: FunderType | null) => void
}) {
  return (
    <KpiChartMotionProvider>
      <PulseStripFunderCultivationInner {...props} />
    </KpiChartMotionProvider>
  )
}

function PulseStripFunderCultivationInner({
  grantsKpi,
  grantsLifetime,
  grantsFull,
  anchorYear,
  now,
  selectedFunderType,
  onFunderTypeChange,
}: {
  grantsKpi: Grant[]
  grantsLifetime: Grant[]
  grantsFull: Grant[]
  anchorYear: number
  now: Date
  selectedFunderType: FunderType | null
  onFunderTypeChange: (next: FunderType | null) => void
}) {
  const { chartReady, reducedMotion } = useKpiChartMotion()
  const uid = useId().replace(/:/g, "")
  const model = useMemo(
    () => buildCultivationKpiModel(grantsKpi, grantsLifetime, now),
    [grantsKpi, grantsLifetime, now],
  )

  const rows = useMemo(() => aggregateFunderRows(grantsKpi, now), [grantsKpi, now])
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

  const maxLife = model.topLifetime[0]?.total ?? 1

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 font-sans md:grid-cols-2 xl:grid-cols-4">
      <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
        <AllActiveTileHeader
          label="Funder breakdown"
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
                        selectedFunderType === entry.funderType &&
                          "opacity-100 ring-1 ring-primary/45 ring-offset-2 ring-offset-background dark:ring-offset-card",
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
                  onClick={() => onFunderTypeChange(rowAct ? null : entry.funderType)}
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

      <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
        <AllActiveTileHeader
          label="New vs repeat"
          right={<span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>YTD lens</span>}
        />
        <AllActiveTileHero value={fmtComma(returning)} />
        <p className="-mt-1 text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textSecondary, fontFamily: KPI_CHART_FONT }}>
          Returning · {fmtComma(newThisYear)} new in {anchorYear}
        </p>

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
      </AllActiveTileShell>

      <AllActiveTileShell shellClassName={MIXED_ALT_TILE_CHROME}>
        <AllActiveTileHeader
          label="Recent wins to steward"
          right={<span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>90d</span>}
        />
        <AllActiveTileHero value={String(model.stewardCount)} />
        <p className="-mt-1 text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textSecondary, fontFamily: KPI_CHART_FONT }}>
          In the steward window
        </p>

        <div className="mt-2 flex max-h-[120px] min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-[11px]" style={{ fontFamily: KPI_CHART_FONT }}>
          {model.stewardFunders.length === 0 ? (
            <span style={{ color: AG_KPI_TOKENS.textTertiary }}>No recent awards in this period</span>
          ) : (
            model.stewardFunders.map((r) => (
              <div key={r.name} className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate" style={{ color: AG_KPI_TOKENS.textSecondary }}>
                  {r.name}
                </span>
              </div>
            ))
          )}
        </div>
      </AllActiveTileShell>

      <div
        style={{ fontFamily: KPI_CHART_FONT }}
        className={cn(
          "flex h-[220px] w-full flex-col rounded-[12px] border-[0.5px] p-[18px] text-left gap-1.5",
          "border-[rgba(0,0,0,0.08)] bg-[color:#FFFFFF] dark:border-border dark:bg-card",
          MIXED_ALT_TILE_CHROME,
        )}
      >
        <AllActiveTileHeader
          label="Top lifetime supporters"
          right={<span className="text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textTertiary }}>Lifetime $</span>}
        />
        <AllActiveTileHero value={fmtBoard$(model.topLifetimeHero$)} />
        <p className="-mt-1 text-[11px] font-medium" style={{ color: AG_KPI_TOKENS.textSecondary }}>
          Major supporters
        </p>

        <div className="-mt-1 flex min-h-0 flex-1 flex-col justify-center gap-1.5 text-[11px]">
          {model.topLifetime.map((d, idx) => {
            const widthPct = maxLife > 0 ? (d.total / maxLife) * 100 : 0
            const barColors = [
              AG_KPI_TOKENS.purple600,
              AG_KPI_TOKENS.purple400,
              "#7E87E8",
              AG_KPI_TOKENS.purple200,
              "#9B92D4",
            ]
            return (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="line-clamp-1 shrink-0 basis-[100px] overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ color: AG_KPI_TOKENS.textSecondary }}
                >
                  {d.name}
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
                  {fmtBoard$(d.total)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
