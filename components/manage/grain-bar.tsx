"use client"

import { LayoutDashboard, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type Grain = "command" | "all-grants"

/** My work / All grants segment control — used under the grain bar or below KPIs in the mixed prototype. */
export function GrainNavToggle({
  active,
  onChange,
  className,
  size = "bar",
}: {
  active: Grain
  onChange: (g: Grain) => void
  className?: string
  /** `bar`: compact for GrainBar. `panel`: slightly larger hit area below KPIs. */
  size?: "bar" | "panel"
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1",
        size === "panel" && "gap-1 py-0.5",
        className,
      )}
      role="tablist"
      aria-label="My work and All grants"
    >
      <GrainTab
        size={size}
        icon={<LayoutDashboard className="h-3.5 w-3.5" />}
        label="My work"
        active={active === "command"}
        onClick={() => onChange("command")}
      />
      <span className="mx-1 text-muted-foreground/40">›</span>
      <GrainTab
        size={size}
        icon={<Table2 className="h-3.5 w-3.5" />}
        label="All Grants"
        active={active === "all-grants"}
        onClick={() => onChange("all-grants")}
      />
    </div>
  )
}

export function GrainBar({
  active,
  onChange,
  breadcrumb,
}: {
  active?: Grain
  onChange?: (g: Grain) => void
  breadcrumb?: { label: string; onBack: () => void } | null
}) {
  if (breadcrumb) {
    return (
      <div className="flex h-9 items-center gap-2 border-b border-border bg-background px-4 text-xs">
        <button
          onClick={breadcrumb.onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All grants
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{breadcrumb.label}</span>
      </div>
    )
  }

  return (
    <div className="flex h-9 items-center gap-1 border-b border-border bg-background px-3">
      {active != null && onChange ? <GrainNavToggle active={active} onChange={onChange} size="bar" /> : null}
    </div>
  )
}

function GrainTab({
  icon,
  label,
  sub,
  active,
  onClick,
  size = "bar",
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  active: boolean
  onClick: () => void
  size?: "bar" | "panel"
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors",
        size === "bar" && "px-2.5 py-1",
        size === "panel" && "px-3 py-1.5",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
      {sub ? (
        <span className="hidden text-[11px] text-muted-foreground/80 md:inline">· {sub}</span>
      ) : null}
    </button>
  )
}
