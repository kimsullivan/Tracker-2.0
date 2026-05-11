"use client"

import { useId } from "react"
import { Activity, CircleDot, Download, FileSpreadsheet, FileText, Scale, Zap, type LucideIcon } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  KPI_CHART_ANIMATION_DURATION_MS,
  KPI_CHART_ANIMATION_EASING,
  KPI_CHART_FONT,
  useKpiChartMotion,
} from "@/components/manage/all-grants-kpi-tiles"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Source, SourceContent, SourceTrigger } from "@/components/prompt-kit/source"

export type ChatSource = {
  title: string
  detail: string
  href: string
}

export type ChatVizSparkline = {
  kind: "sparkline"
  title: string
  series: { x: string; y: number }[]
}

/** Spend-pace chart mirroring the grant Opportunity tab treatment — composed Area
 *  ("Actual" cumulative spend) + Line ("Expected" linear pace), with grid, axes,
 *  $K formatting, and a "Now" vertical marker. */
export type ChatVizSpendPace = {
  kind: "spend_pace"
  title: string
  subtitle?: string
  /** Monthly cumulative series. `actual` is `null` for future months. */
  series: { month: string; expected: number; actual: number | null }[]
  /** Optional label of the "now" tick; draws a vertical reference. */
  nowLabel?: string
  /** Y-axis unit suffix (default "K"). */
  yUnit?: "K" | "M"
}

export type ChatVizMetrics = {
  kind: "metrics"
  rows: { label: string; value: string; hint?: string }[]
}

export type ChatVizTasks = {
  kind: "tasks"
  /** Section heading inside the assistant snapshot */
  title?: string
  items: {
    title: string
    subtitle?: string
    badge?: string
    tone?: "decision" | "action" | "signal"
    foot?: string
    actions?: { label: string; href: string }[]
  }[]
}

/** Plain chat actions — no card, no section title (e.g. save-view nudge). */
export type ChatVizInlineActions = {
  kind: "inline_actions"
  actions: { label: string; href: string }[]
}

/** Generated report / export — PDF or CSV with download actions (`mixalt://run-lens-export/...`). */
export type ChatVizReportAsset = {
  kind: "report_asset"
  format: "pdf" | "csv"
  /** Primary line, e.g. audience + “grants report” */
  title: string
  subtitle?: string
}

/** Both PDF and CSV in one card — dual file illustrations + paired downloads. */
export type ChatVizReportBundle = {
  kind: "report_bundle"
  title: string
  subtitle?: string
}

export type ChatViz =
  | ChatVizSparkline
  | ChatVizSpendPace
  | ChatVizMetrics
  | ChatVizTasks
  | ChatVizInlineActions
  | ChatVizReportAsset
  | ChatVizReportBundle

export type ChatTaskAction = { label: string; href: string }

export function ChatSources({ sources }: { sources: ChatSource[] }) {
  if (!sources.length) return null
  return (
    <div className="mt-3 border-t border-border/45 pt-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <Source key={`${s.href}-${s.title}-${i}`} href={s.href}>
            <SourceTrigger
              label={i + 1}
              className="h-5 max-w-[7.5rem] px-1.5 text-[10px] leading-none"
            />
            <SourceContent
              title={s.title}
              description={s.detail}
              className="w-[min(100vw-2rem,17.5rem)] [&_a]:gap-1.5 [&_a]:p-2.5 [&_a_.font-medium]:text-xs [&_a_.text-muted-foreground]:text-[11px] [&_a_.text-muted-foreground]:leading-snug"
            />
          </Source>
        ))}
      </div>
    </div>
  )
}

const TASK_TONE_ICON: Record<NonNullable<ChatVizTasks["items"][number]["tone"]>, LucideIcon> = {
  decision: Scale,
  action: Zap,
  signal: Activity,
}

/** Colored well behind the glyph only */
const TASK_ICON_WELL: Record<NonNullable<ChatVizTasks["items"][number]["tone"]>, string> = {
  decision:
    "bg-amber-100 ring-1 ring-amber-200/70 dark:bg-amber-950/45 dark:ring-amber-800/50",
  action: "bg-primary/15 ring-1 ring-primary/25 dark:bg-primary/20 dark:ring-primary/35",
  signal:
    "bg-emerald-100 ring-1 ring-emerald-200/70 dark:bg-emerald-950/45 dark:ring-emerald-800/50",
}

const TASK_ICON_GLYPH: Record<NonNullable<ChatVizTasks["items"][number]["tone"]>, string> = {
  decision: "text-amber-900 dark:text-amber-100",
  action: "text-primary",
  signal: "text-emerald-800 dark:text-emerald-200",
}

function ReportDocIllustration({
  format,
  uid,
  compact,
}: {
  format: "pdf" | "csv"
  uid: string
  compact?: boolean
}) {
  const isPdf = format === "pdf"
  const gFold = `ra-fold-${uid}`
  const gPage = `ra-page-${uid}`
  return (
    <svg
      viewBox="0 0 72 88"
      className={cn(
        "h-full w-full drop-shadow-sm",
        compact ? "max-h-[4rem] max-w-[3.1rem]" : "max-h-[5.5rem] max-w-[4.25rem]",
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={gFold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isPdf ? "#fecaca" : "#bbf7d0"} stopOpacity="0.95" />
          <stop offset="100%" stopColor={isPdf ? "#f97316" : "#22c55e"} stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={gPage} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="100%" stopColor={isPdf ? "#fff7ed" : "#f0fdf4"} stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="56" height="78" rx="6" fill={`url(#${gPage})`} stroke="currentColor" strokeOpacity="0.12" className="text-foreground" />
      <path d="M46 4 L58 16 L46 16 Z" fill={`url(#${gFold})`} stroke="currentColor" strokeOpacity="0.08" className="text-foreground" />
      <rect x="14" y="28" width="40" height="4" rx="1.5" fill="currentColor" className="text-foreground" opacity="0.14" />
      <rect x="14" y="38" width="32" height="3" rx="1" fill="currentColor" className="text-foreground" opacity="0.1" />
      <rect x="14" y="46" width="36" height="3" rx="1" fill="currentColor" className="text-foreground" opacity="0.1" />
      <rect x="14" y="54" width="28" height="3" rx="1" fill="currentColor" className="text-foreground" opacity="0.08" />
      {isPdf ? (
        <text x="36" y="74" textAnchor="middle" fontSize="11" fontWeight="700" fill="#dc2626" fontFamily="system-ui, sans-serif">
          PDF
        </text>
      ) : (
        <text x="36" y="74" textAnchor="middle" fontSize="10" fontWeight="700" fill="#15803d" fontFamily="system-ui, sans-serif">
          CSV
        </text>
      )}
    </svg>
  )
}

export function ChatInlineViz({
  viz,
  staggerMs = 0,
  onTaskAction,
}: {
  viz: ChatViz
  staggerMs?: number
  /** When set, task buttons run this instead of opening links (prototype follow-through). */
  onTaskAction?: (action: ChatTaskAction) => void
}) {
  const gradId = useId().replace(/:/g, "")
  const reportIllustUid = useId().replace(/:/g, "")
  const { chartReady, reducedMotion } = useKpiChartMotion()

  if (viz.kind === "report_asset") {
    const isPdf = viz.format === "pdf"
    const Icon = isPdf ? FileText : FileSpreadsheet
    const accent =
      isPdf
        ? "from-rose-500/25 via-orange-400/15 to-amber-300/10 dark:from-rose-950/50 dark:via-orange-950/35"
        : "from-emerald-500/25 via-green-400/15 to-teal-300/10 dark:from-emerald-950/50 dark:via-green-950/35"
    const ring = isPdf ? "ring-rose-500/20 dark:ring-rose-400/25" : "ring-emerald-500/20 dark:ring-emerald-400/25"
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/50 bg-card p-0.5 shadow-md",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 fill-mode-both duration-500",
          "ring-1",
          ring,
        )}
        style={{ animationDelay: `${staggerMs}ms` }}
      >
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", accent)} aria-hidden />
        <div className="relative flex gap-4 rounded-[14px] bg-card/85 p-4 backdrop-blur-[2px] dark:bg-card/80">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl p-2",
              isPdf
                ? "bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/30"
                : "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30",
            )}
          >
            <div className="relative flex h-[5.5rem] w-[4.25rem] items-center justify-center">
              <ReportDocIllustration format={viz.format} uid={reportIllustUid} />
              <div
                className={cn(
                  "absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10",
                  isPdf ? "bg-rose-600 text-white" : "bg-emerald-600 text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isPdf ? "PDF report" : "CSV export"}
              </p>
              <p className="mt-1 font-heading text-[15px] font-semibold leading-snug text-foreground">{viz.title}</p>
              {viz.subtitle ? (
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{viz.subtitle}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {onTaskAction ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 rounded-lg px-3 text-[12px] font-semibold shadow-sm",
                      isPdf ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700",
                    )}
                    onClick={() =>
                      onTaskAction({
                        label: isPdf ? "Download PDF" : "Download CSV",
                        href: isPdf ? "mixalt://run-lens-export/pdf" : "mixalt://run-lens-export/csv",
                      })
                    }
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download {isPdf ? "PDF" : "CSV"}
                  </Button>
                  {isPdf ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-border/70 bg-background/80 px-3 text-[11px] font-medium shadow-none"
                      onClick={() =>
                        onTaskAction({ label: "Download CSV", href: "mixalt://run-lens-export/csv" })
                      }
                    >
                      <FileSpreadsheet className="mr-1 h-3 w-3" aria-hidden />
                      CSV instead
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-border/70 bg-background/80 px-3 text-[11px] font-medium shadow-none"
                      onClick={() =>
                        onTaskAction({ label: "Download PDF", href: "mixalt://run-lens-export/pdf" })
                      }
                    >
                      <FileText className="mr-1 h-3 w-3" aria-hidden />
                      PDF instead
                    </Button>
                  )}
                </>
              ) : (
                <Button size="sm" className="h-8 rounded-lg text-[12px] font-semibold" asChild>
                  <a
                    href={isPdf ? "mixalt://run-lens-export/pdf" : "mixalt://run-lens-export/csv"}
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (viz.kind === "report_bundle") {
    const uidPdf = useId().replace(/:/g, "")
    const uidCsv = useId().replace(/:/g, "")
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/50 bg-card p-0.5 shadow-lg",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 fill-mode-both duration-500",
          "ring-1 ring-violet-500/15 dark:ring-violet-400/20",
        )}
        style={{ animationDelay: `${staggerMs}ms` }}
      >
        <div
          className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-rose-400/20 blur-3xl dark:bg-rose-600/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-12 bottom-0 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15"
          aria-hidden
        />
        <div className="relative rounded-[14px] border border-border/30 bg-card/90 p-4 backdrop-blur-[2px] dark:bg-card/85">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Report ready</p>
              <p className="mt-1 font-heading text-[16px] font-bold leading-snug tracking-tight text-foreground">
                {viz.title}
              </p>
              {viz.subtitle ? (
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{viz.subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-end justify-center gap-3 sm:justify-end">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "rounded-xl p-2 shadow-sm ring-1 ring-black/5 dark:ring-white/10",
                    "bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/45 dark:to-orange-950/35",
                  )}
                >
                  <ReportDocIllustration format="pdf" uid={uidPdf} compact />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  PDF
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "rounded-xl p-2 shadow-sm ring-1 ring-black/5 dark:ring-white/10",
                    "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/45 dark:to-teal-950/35",
                  )}
                >
                  <ReportDocIllustration format="csv" uid={uidCsv} compact />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  CSV
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {onTaskAction ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl bg-rose-600 text-[12px] font-semibold shadow-md hover:bg-rose-700"
                  onClick={() =>
                    onTaskAction({ label: "Download PDF", href: "mixalt://run-lens-export/pdf" })
                  }
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-[12px] font-semibold shadow-md hover:bg-emerald-700"
                  onClick={() =>
                    onTaskAction({ label: "Download CSV", href: "mixalt://run-lens-export/csv" })
                  }
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download CSV
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" className="h-9 rounded-xl text-[12px] font-semibold" asChild>
                  <a href="mixalt://run-lens-export/pdf" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download PDF
                  </a>
                </Button>
                <Button size="sm" className="h-9 rounded-xl text-[12px] font-semibold" asChild>
                  <a href="mixalt://run-lens-export/csv" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download CSV
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (viz.kind === "inline_actions") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {viz.actions.map((a, idx) =>
          onTaskAction ? (
            <Button
              key={`${a.label}-${idx}`}
              type="button"
              variant={idx === 0 ? "default" : "outline"}
              size="sm"
              className="h-7 min-h-7 rounded-md px-2.5 py-0 text-[11px] font-medium shadow-none"
              onClick={() => onTaskAction(a)}
            >
              {a.label}
            </Button>
          ) : (
            <Button
              key={`${a.label}-${idx}`}
              variant={idx === 0 ? "default" : "outline"}
              size="sm"
              className="h-7 min-h-7 rounded-md px-2.5 py-0 text-[11px] font-medium shadow-none"
              asChild
            >
              <a href={a.href} target="_blank" rel="noreferrer">
                {a.label}
              </a>
            </Button>
          ),
        )}
      </div>
    )
  }

  if (viz.kind === "tasks") {
    return (
      <div className="space-y-2">
        {viz.title ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{viz.title}</p>
        ) : null}
        <div className="space-y-2">
          {viz.items.map((item, j) => {
            const ToneIcon = item.tone ? TASK_TONE_ICON[item.tone] : CircleDot
            const iconWell = item.tone ? TASK_ICON_WELL[item.tone] : "bg-muted/50 ring-1 ring-border/40"
            const iconGlyph = item.tone ? TASK_ICON_GLYPH[item.tone] : "text-muted-foreground"
            return (
            <div
              key={`${item.title}-${j}`}
              className={cn(
                "flex gap-2.5 rounded-lg border border-border/60 bg-background py-2.5 pl-2.5 pr-3 shadow-xs",
                "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 fill-mode-both duration-500",
              )}
              style={{ animationDelay: `${staggerMs + j * 80}ms` }}
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  iconWell,
                )}
                aria-hidden
              >
                <ToneIcon className={cn("h-3 w-3", iconGlyph)} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold leading-snug text-foreground">{item.title}</p>
                    {item.badge ? (
                      <span className="rounded-full border border-border/60 bg-background/70 px-1.5 py-px text-[11px] font-medium text-muted-foreground dark:bg-background/50">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  {item.subtitle ? (
                    <p className="text-[12px] leading-snug text-muted-foreground">{item.subtitle}</p>
                  ) : null}
                  {item.foot ? (
                    <p className="text-[11px] leading-snug text-muted-foreground/90">{item.foot}</p>
                  ) : null}
              {item.actions?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.actions.map((a, idx) =>
                    onTaskAction ? (
                      <Button
                        key={`${a.label}-${idx}`}
                        type="button"
                        variant={idx === 0 ? "default" : "outline"}
                        size="sm"
                        className="h-6 min-h-6 rounded-md px-2 py-0 !text-[10px] font-medium leading-none shadow-none"
                        onClick={() => onTaskAction(a)}
                      >
                        {a.label}
                      </Button>
                    ) : (
                      <Button
                        key={`${a.label}-${idx}`}
                        variant={idx === 0 ? "default" : "outline"}
                        size="sm"
                        className="h-6 min-h-6 rounded-md px-2 py-0 !text-[10px] font-medium leading-none shadow-none"
                        asChild
                      >
                        <a href={a.href} target="_blank" rel="noreferrer">
                          {a.label}
                        </a>
                      </Button>
                    ),
                  )}
                </div>
              ) : null}
              </div>
            </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (viz.kind === "spend_pace") {
    const unit = viz.yUnit ?? "K"
    const finalActual = [...viz.series].reverse().find((p) => p.actual !== null)?.actual ?? null
    const finalExpected = viz.series.at(-1)?.expected ?? null
    const variance =
      finalActual !== null && finalExpected !== null ? finalActual - finalExpected : null
    return (
      <div
        className={cn(
          "rounded-xl border border-border/55 bg-card/90 p-3 shadow-xs",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 fill-mode-both duration-500",
        )}
        style={{ animationDelay: `${staggerMs}ms` }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {viz.title}
            </p>
            {viz.subtitle ? (
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground/90">
                {viz.subtitle}
              </p>
            ) : null}
          </div>
          {variance !== null ? (
            <div className="text-right">
              <div
                className={cn(
                  "font-heading text-[15px] font-bold tabular-nums leading-none",
                  variance < 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {variance < 0 ? "−" : "+"}${Math.abs(variance)}
                {unit}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {variance < 0 ? "Behind plan" : "Ahead of plan"}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--chart-3)" }}
              aria-hidden
            />
            Actual cumulative spend
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-3 rounded-full bg-muted-foreground/70"
              aria-hidden
            />
            Expected pace
          </span>
        </div>
        <div
          className="mt-2 h-[180px] w-full [&_.recharts-surface]:outline-none"
          style={{ fontFamily: KPI_CHART_FONT }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={viz.series} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.85} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                width={40}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(v) => `$${v}${unit}`}
                domain={[0, "auto"]}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: KPI_CHART_FONT,
                  fontSize: 11,
                  borderRadius: 8,
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  padding: "6px 8px",
                }}
                formatter={(value: number | string, name: string) => {
                  if (value === null || value === undefined) return ["—", name]
                  return [`$${value}${unit}`, name === "actual" ? "Actual" : "Expected"]
                }}
                labelFormatter={(m) => `${m}`}
              />
              {viz.nowLabel ? (
                <ReferenceLine
                  x={viz.nowLabel}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.55}
                  strokeDasharray="2 3"
                  label={{
                    value: "Now",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                  }}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="var(--chart-3)"
                strokeWidth={2}
                fill={`url(#${gradId})`}
                connectNulls={false}
                isAnimationActive={!reducedMotion && chartReady}
                animationDuration={reducedMotion ? 0 : KPI_CHART_ANIMATION_DURATION_MS}
                animationEasing={KPI_CHART_ANIMATION_EASING}
              />
              <Line
                type="monotone"
                dataKey="expected"
                stroke="var(--muted-foreground)"
                strokeOpacity={0.75}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={!reducedMotion && chartReady}
                animationDuration={reducedMotion ? 0 : KPI_CHART_ANIMATION_DURATION_MS}
                animationEasing={KPI_CHART_ANIMATION_EASING}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (viz.kind === "metrics") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {viz.rows.map((row, j) => (
          <div
            key={row.label}
            className={cn(
              "rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2 shadow-xs",
              "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 fill-mode-both duration-500",
            )}
            style={{ animationDelay: `${staggerMs + j * 72}ms` }}
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {row.label}
            </div>
            <div className="mt-0.5 font-heading text-lg font-bold tabular-nums text-foreground">
              {row.value}
            </div>
            {row.hint ? (
              <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{row.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-muted/20 p-2",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
      )}
      style={{ animationDelay: `${staggerMs}ms` }}
    >
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{viz.title}</div>
      <div className={cn("h-[4.5rem] w-full [&_.recharts-surface]:outline-none")}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={viz.series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis hide domain={["auto", "auto"]} />
            <Area
              type="monotone"
              dataKey="y"
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              isAnimationActive={!reducedMotion && chartReady}
              animationDuration={reducedMotion ? 0 : KPI_CHART_ANIMATION_DURATION_MS}
              animationEasing={KPI_CHART_ANIMATION_EASING}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
