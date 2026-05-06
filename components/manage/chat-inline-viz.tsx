"use client"

import { useId } from "react"
import { Activity, CircleDot, Scale, Zap, type LucideIcon } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { KPI_CHART_ANIMATION_DURATION_MS, KPI_CHART_ANIMATION_EASING } from "@/components/manage/all-grants-kpi-tiles"
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

export type ChatViz = ChatVizSparkline | ChatVizMetrics | ChatVizTasks

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
              animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
              animationEasing={KPI_CHART_ANIMATION_EASING}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
