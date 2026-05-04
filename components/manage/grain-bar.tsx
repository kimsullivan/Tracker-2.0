"use client"

import { LayoutDashboard, Table2 } from "lucide-react"

export type Grain = "command" | "all-grants"

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
      <GrainTab
        icon={<LayoutDashboard className="h-3.5 w-3.5" />}
        label="Command Center"
        active={active === "command"}
        onClick={() => onChange?.("command")}
      />
      <span className="mx-1 text-muted-foreground/40">›</span>
      <GrainTab
        icon={<Table2 className="h-3.5 w-3.5" />}
        label="All Grants"
        active={active === "all-grants"}
        onClick={() => onChange?.("all-grants")}
      />
    </div>
  )
}

function GrainTab({
  icon,
  label,
  sub,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      ].join(" ")}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {sub ? (
        <span className="hidden md:inline text-[11px] text-muted-foreground/80">· {sub}</span>
      ) : null}
    </button>
  )
}
