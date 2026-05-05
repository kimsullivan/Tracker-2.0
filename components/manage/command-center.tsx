"use client"

import { useMemo, useState } from "react"
import { actionQueue, anomalies, grants, team } from "@/lib/manage/data"
import type { ActionItem, Stage } from "@/lib/manage/types"
import { StagePill } from "./status-pill"
import { OwnerAvatar } from "./owner-avatar"
import { AlertTriangle, ArrowUpDown, ArrowUpRight, Check, Flag, Info, TrendingDown, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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

export function CommandCenter({ onOpenGrant }: { onOpenGrant: (id: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] space-y-7 px-8 py-8 md:px-10">
      <Greeting />
      <PulseStrip />
      <CommandCenterWorkspace onOpenGrant={onOpenGrant} />
    </div>
  )
}

/** Main column layout: queue + right rail. Tasks column ~2/3 width; grid stays fluid with the container. */
export function CommandCenterWorkspace({ onOpenGrant }: { onOpenGrant: (id: string) => void }) {
  return (
    <div className="grid w-full grid-cols-1 gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-7">
        <ActionQueue onOpenGrant={onOpenGrant} />
      </div>
      <div className="min-w-0 space-y-6">
        <AnomaliesPanel />
        <TeamLoad />
      </div>
    </div>
  )
}

export function Greeting() {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const active = grants.filter((g) => g.stage !== "Closed" && g.stage !== "Declined").length
  const dueSoon = grants.filter((g) => g.daysToDeadline <= 14 && g.stage !== "Closed").length
  const blocked = grants.filter((g) => g.blocked).length

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Good morning, <span className="text-primary">Maria</span>
        </h1>
        <span className="text-xs text-muted-foreground">· {date}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {active} active grants · {dueSoon} due in next 14 days · {blocked} blocked — Hartford burn is the one thing
        worth your attention.
      </p>
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
      <CapacityCard />
    </div>
  )
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
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pipeline by stage</div>
          <div className="mt-1 font-heading text-xl font-bold text-card-foreground">
            {pipeline.totalGrants} grants · {fmtMoney(pipeline.totalAward)}
          </div>
        </div>
      </div>
      <div className="flex h-[92px] gap-2">
        {pipeline.stages.map((s) => (
          <div key={s.label} className="flex min-h-0 min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="text-center text-[11px] font-semibold tabular-nums text-card-foreground">{s.count}</div>
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-bold text-card-foreground">{value}</span>
        <span
          className={[
            "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
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

function Sparkline({ accent }: { accent: "primary" | "chart-3" }) {
  const points = "0,18 12,15 24,16 36,12 48,14 60,9 72,11 84,7 96,10 108,5"
  const color = accent === "primary" ? "var(--primary)" : "var(--chart-3)"
  return (
    <svg viewBox="0 0 108 22" className="mt-2 h-6 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function CapacityCard() {
  return (
    <div className={cn(CARD_SHELL, "p-6")}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Capacity heat</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-bold text-card-foreground">81%</span>
        <span className="rounded bg-chart-4/10 px-1.5 py-0.5 text-[10px] font-medium text-chart-4">Maria 142%</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {team.slice(0, 3).map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <span className="w-10 text-[10px] text-muted-foreground">{m.name.split(" ")[0]}</span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.min(m.load, 100)}%`,
                  backgroundColor: m.load > 100 ? "var(--chart-5)" : m.load > 85 ? "var(--chart-4)" : "var(--chart-3)",
                }}
              />
            </div>
            <span className="w-9 text-right text-[10px] tabular-nums text-card-foreground">{m.load}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionQueue({ onOpenGrant }: { onOpenGrant: (id: string) => void }) {
  const [items, setItems] = useState<ActionItem[]>(actionQueue)
  const [hideDone, setHideDone] = useState(false)
  const [dueSort, setDueSort] = useState<"asc" | "desc">("asc")

  const visible = useMemo(() => (hideDone ? items.filter((i) => !i.done) : items), [items, hideDone])
  const sortedVisible = useMemo(() => {
    const arr = [...visible]
    arr.sort((a, b) => (dueSort === "asc" ? a.daysOut - b.daysOut : b.daysOut - a.daysOut))
    return arr
  }, [visible, dueSort])
  const remaining = items.filter((i) => !i.done).length

  function toggle(id: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const done = !i.done
        toast(done ? "Marked done" : "Reopened", {
          description: i.title,
          action: { label: "Undo", onClick: () => toggle(id) },
        })
        return { ...i, done }
      }),
    )
  }

  return (
    <div className={cn(CARD_SHELL, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-bold text-card-foreground">Today's queue</h2>
          <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {remaining} open
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDueSort((d) => (d === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Sort by days to deadline"
          >
            <ArrowUpDown className="h-3.5 w-3.5 opacity-80" />
            <span>Due {dueSort === "asc" ? "soonest" : "latest"}</span>
          </button>
          <button
            onClick={() => setHideDone((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {hideDone ? "Show completed" : "Hide completed"}
          </button>
        </div>
      </div>
      <ul>
        {sortedVisible.map((item) => (
          <ActionRow
            key={item.id}
            item={item}
            onToggle={() => toggle(item.id)}
            onOpen={() => onOpenGrant(item.grantId)}
          />
        ))}
      </ul>
    </div>
  )
}

function ActionRow({ item, onToggle, onOpen }: { item: ActionItem; onToggle: () => void; onOpen: () => void }) {
  const urgency = item.daysOut <= 0 ? "crit" : item.daysOut <= 3 ? "warn" : "info"
  const urgencyColor =
    urgency === "crit"
      ? "text-rose-950 dark:text-rose-100"
      : urgency === "warn"
        ? "text-amber-950 dark:text-amber-100"
        : "text-muted-foreground"

  return (
    <li className={["group grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-6 py-4 hover:bg-muted/40 transition-colors", item.done && "opacity-50"].filter(Boolean).join(" ")}>
      <button
        onClick={onToggle}
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          item.done ? "border-chart-3 bg-chart-3 text-white" : "border-input hover:border-foreground",
        ].join(" ")}
      >
        {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0">
        <div className={["text-sm font-medium text-card-foreground", item.done && "line-through"].filter(Boolean).join(" ")}>
          {item.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <button onClick={onOpen} className="truncate hover:text-foreground hover:underline">
            {item.grantTitle}
          </button>
          <span>·</span>
          <StagePill stage={item.stage} className="!py-0 !text-[10px]" />
        </div>
      </div>
      <div
        className={[
          "min-w-[7rem] max-w-[11rem] shrink-0 text-right text-base font-medium tabular-nums leading-snug sm:min-w-[7.5rem]",
          urgencyColor,
        ].join(" ")}
      >
        {item.due}
      </div>
      <div className="hidden md:block w-20 text-right text-[11px] tabular-nums text-muted-foreground">
        ${(item.award / 1000).toFixed(0)}K
      </div>
      <OwnerAvatar id={item.ownerId} size={22} />
    </li>
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
