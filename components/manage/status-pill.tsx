import type { Stage, FunderType, Priority } from "@/lib/manage/types"

/** Stage badge colors aligned to portfolio tracker reference (pastel fill + saturated text, AA-friendly) */
const stageStyle: Record<Stage, string> = {
  Researching:
    "bg-amber-200 text-amber-950 dark:bg-amber-700/90 dark:text-amber-50",
  Planned: "bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100",
  "LOI In Progress":
    "bg-fuchsia-50 text-fuchsia-900 dark:bg-fuchsia-950/45 dark:text-fuchsia-100",
  "LOI Submitted":
    "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200/70 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-800",
  "Application In Progress":
    "bg-violet-50 text-violet-950 dark:bg-violet-950/45 dark:text-violet-100",
  "Application Submitted":
    "bg-blue-100 text-blue-800 dark:bg-blue-950/45 dark:text-blue-100",
  "Awarded - Active":
    "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/45 dark:text-emerald-50",
  Closed:
    "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  Declined: "bg-red-50 text-red-950 dark:bg-red-950/45 dark:text-red-100",
}

export function StagePill({ stage, className = "" }: { stage: Stage; className?: string }) {
  return (
    <span
      className={[
        "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        stageStyle[stage],
        className,
      ].join(" ")}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      <span className="min-w-0 truncate">{stage}</span>
    </span>
  )
}

const funderStyle: Record<FunderType, string> = {
  Federal: "border-chart-1/30 text-chart-1",
  Private: "border-chart-3/30 text-chart-3",
  Corporate: "border-chart-4/30 text-chart-4",
  State: "border-chart-5/30 text-chart-5",
  Local: "border-muted-foreground/30 text-muted-foreground",
}

export function FunderPill({ type }: { type: FunderType }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide bg-background",
        funderStyle[type],
      ].join(" ")}
    >
      {type}
    </span>
  )
}

const priorityStyle: Record<Priority, string> = {
  P0: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  P1: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  P2: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  P3: "bg-muted text-muted-foreground border-border",
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-semibold",
        priorityStyle[priority],
      ].join(" ")}
    >
      {priority}
    </span>
  )
}
