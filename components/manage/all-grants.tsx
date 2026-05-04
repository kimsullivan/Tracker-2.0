"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { grants as grantsData, stageOrder, team } from "@/lib/manage/data"
import type { Grant, Stage } from "@/lib/manage/types"
import { cn } from "@/lib/utils"
import { PriorityPill, StagePill } from "./status-pill"
import { OwnerAvatar } from "./owner-avatar"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Columns3,
  Filter,
  Flag,
  GripVertical,
  Inbox,
  Lock,
  Plus,
  Settings2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
type ColKey =
  | "grant"
  | "funder"
  | "status"
  | "deadline"
  | "award"
  | "owner"
  | "cycle"
  | "fundingSource"
  | "fain"
  | "cfda"
  | "period"
  | "indirect"
  | "match"
  | "lastUpdated"
  | "projectGroup"
  | "priority"
  | "renewal"

type ColDef = {
  key: ColKey
  label: string
  width: string
  group: "system" | "custom"
  defaultVisible: boolean
  locked?: boolean
}

/** Fixed / minmax(px,px) widths only — no `fr` tracks, or the grid shrinks to the viewport and horizontal scroll disappears. */
const COLUMNS: ColDef[] = [
  { key: "grant", label: "Grant", width: "320px", group: "system", defaultVisible: true, locked: true },
  { key: "funder", label: "Funder", width: "240px", group: "system", defaultVisible: true },
  { key: "status", label: "Status", width: "260px", group: "system", defaultVisible: true },
  { key: "deadline", label: "Deadline", width: "180px", group: "system", defaultVisible: true },
  { key: "award", label: "Award", width: "132px", group: "system", defaultVisible: true },
  { key: "owner", label: "Owner", width: "144px", group: "system", defaultVisible: true },
  { key: "cycle", label: "Cycle", width: "96px", group: "system", defaultVisible: true },
  { key: "fundingSource", label: "Funding source", width: "220px", group: "system", defaultVisible: true },
  { key: "fain", label: "FAIN", width: "168px", group: "system", defaultVisible: true },
  { key: "cfda", label: "CFDA", width: "100px", group: "system", defaultVisible: true },
  { key: "period", label: "Period", width: "192px", group: "system", defaultVisible: true },
  { key: "indirect", label: "Indirect", width: "96px", group: "system", defaultVisible: true },
  { key: "match", label: "Match", width: "88px", group: "system", defaultVisible: true },
  { key: "lastUpdated", label: "Last updated", width: "132px", group: "system", defaultVisible: true },
  { key: "projectGroup", label: "Project group", width: "160px", group: "custom", defaultVisible: true },
  { key: "priority", label: "Priority", width: "96px", group: "custom", defaultVisible: true },
  { key: "renewal", label: "Renewal", width: "120px", group: "custom", defaultVisible: true },
]

/** All column keys except Grant — Grant stays pinned first; these may be reordered. */
const NON_GRANT_COLUMN_KEYS: ColKey[] = COLUMNS.filter((c) => c.key !== "grant").map((c) => c.key)

const DND_COLUMN_MIME = "application/x-ccn-grant-col"

function reorderColumns(order: ColKey[], from: ColKey, to: ColKey): ColKey[] {
  if (from === to || from === "grant" || to === "grant") return order
  const next = [...order]
  const fromIdx = next.indexOf(from)
  const toIdx = next.indexOf(to)
  if (fromIdx === -1 || toIdx === -1) return order
  next.splice(fromIdx, 1)
  const newToIdx = next.indexOf(to)
  next.splice(newToIdx, 0, from)
  return next
}

type GroupBy = "stage" | "owner" | "funderType" | "projectGroup" | "deadline" | "none"

type SortDir = "asc" | "desc"

const PRIORITY_SORT: Record<Grant["priority"], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
}

const RENEWAL_SORT: Record<Grant["renewalLikelihood"], number> = {
  High: 0,
  Medium: 1,
  Low: 2,
  Unknown: 3,
}

function sortValueForColumn(g: Grant, key: ColKey): string | number {
  switch (key) {
    case "grant":
      return g.title.toLowerCase()
    case "funder":
      return g.funder.toLowerCase()
    case "status": {
      const i = stageOrder.indexOf(g.stage)
      return i === -1 ? 999 : i
    }
    case "deadline":
      return new Date(g.deadline).getTime()
    case "award":
      return g.award
    case "owner":
      return (team.find((t) => t.id === g.ownerId)?.name ?? "").toLowerCase()
    case "cycle":
      return g.cycle.toLowerCase()
    case "fundingSource":
      return g.fundingSource.toLowerCase()
    case "fain":
      return (g.fain ?? "").toLowerCase()
    case "cfda":
      return (g.cfda ?? "").toLowerCase()
    case "period":
      return (g.period ?? "").toLowerCase()
    case "indirect":
      return g.indirect ?? -1
    case "match":
      if (g.matchRequired === true) return 1
      if (g.matchRequired === false) return 0
      return -1
    case "lastUpdated":
      return g.lastUpdated.toLowerCase()
    case "projectGroup":
      return g.projectGroup.toLowerCase()
    case "priority":
      return PRIORITY_SORT[g.priority]
    case "renewal":
      return RENEWAL_SORT[g.renewalLikelihood]
    default:
      return ""
  }
}

function compareGrantRows(a: Grant, b: Grant, key: ColKey, dir: SortDir): number {
  const va = sortValueForColumn(a, key)
  const vb = sortValueForColumn(b, key)
  let cmp = 0
  if (typeof va === "number" && typeof vb === "number") {
    cmp = va - vb
  } else {
    cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" })
  }
  return dir === "asc" ? cmp : -cmp
}

/** Calendar date from ISO `YYYY-MM-DD` in local time (avoids UTC off-by-one). */
function parseGrantDeadline(iso: string): Date {
  const part = iso.split("T")[0] ?? ""
  const [y, mo, d] = part.split("-").map((x) => parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return new Date(NaN)
  return new Date(y, mo - 1, d)
}

/** Fiscal year Jul 1–Jun 30, labeled by the June year (e.g. FY2026 = 2025-07-01 … 2026-06-30). */
function fiscalYearContainingDate(d: Date): number {
  if (Number.isNaN(d.getTime())) return NaN
  const y = d.getFullYear()
  const m = d.getMonth()
  return m >= 6 ? y + 1 : y
}

function formatFiscalYearLabel(fy: number): string {
  return `FY${fy}`
}

function grantFiscalYearLabel(iso: string): string {
  const fy = fiscalYearContainingDate(parseGrantDeadline(iso))
  return Number.isFinite(fy) ? formatFiscalYearLabel(fy) : "—"
}

/** `YYYY-MM` for stable sort / group keys */
function deadlineMonthKey(iso: string): string {
  const d = parseGrantDeadline(iso)
  if (Number.isNaN(d.getTime())) return "unknown"
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, "0")}`
}

function formatDeadlineMonthGroupLabel(key: string): string {
  if (key === "unknown") return "Unknown deadline"
  const [ys, ms] = key.split("-")
  const y = parseInt(ys, 10)
  const m = parseInt(ms, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m)) return key
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

const SAVED_VIEWS = [
  { id: "all", label: "All active" },
  { id: "q2-apps", label: "Q2 applications" },
  { id: "fed-100k", label: "Federal > $100K" },
  { id: "at-risk", label: "At-risk reports" },
  { id: "renewal", label: "Renewal window" },
  { id: "maria", label: "Maria's load" },
]

function applyViewFilters(
  viewId: string,
  prev: Record<string, string | null>,
): Record<string, string | null> {
  if (viewId === "maria") return { ...prev, owner: "maria" }
  if (viewId === "fed-100k") return { ...prev, funderType: "Federal" }
  return { funderType: null, owner: null, fiscalYear: null }
}

type OperatorViewConfig = {
  builtinSlice: string
  groupBy: GroupBy
  visibleColKeys: ColKey[]
  colOrder: ColKey[]
  filters: Record<string, string | null>
}

type OperatorSavedView = { id: string; label: string; config: OperatorViewConfig }

export function AllGrants({
  onOpenGrant,
  variant = "default",
  operatorChatOpen = false,
}: {
  onOpenGrant: (id: string) => void
  variant?: "default" | "operator"
  /** When open, shows a right-edge fade toward the operator chat (operator layout only). */
  operatorChatOpen?: boolean
}) {
  const [selectedViewId, setSelectedViewId] = useState("all")
  const [customViews, setCustomViews] = useState<OperatorSavedView[]>([])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState("")
  const [groupBy, setGroupBy] = useState<GroupBy>("stage")
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)),
  )
  const [grants, setGrants] = useState<Grant[]>(grantsData)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Record<string, string | null>>({
    fiscalYear: null,
    funderType: null,
    owner: null,
  })
  const [filterBaseline, setFilterBaseline] = useState<Record<string, string | null>>({
    fiscalYear: null,
    funderType: null,
    owner: null,
  })
  const [sortKey, setSortKey] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [colOrder, setColOrder] = useState<ColKey[]>(() => [...NON_GRANT_COLUMN_KEYS])
  const [draggingCol, setDraggingCol] = useState<ColKey | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [showPinnedScrollShadow, setShowPinnedScrollShadow] = useState(false)
  const [showStickyHeaderShadow, setShowStickyHeaderShadow] = useState(false)

  const updateTableScrollShadows = useCallback(() => {
    const el = tableScrollRef.current
    if (!el) return
    const { scrollLeft, scrollTop, scrollWidth, clientWidth } = el
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    setShowPinnedScrollShadow(maxScroll > 1 && scrollLeft > 1)
    setShowStickyHeaderShadow(scrollTop > 2)
  }, [])

  const builtinSlice = useMemo(() => {
    if (variant === "operator" && selectedViewId.startsWith("custom-")) {
      return customViews.find((v) => v.id === selectedViewId)?.config.builtinSlice ?? "all"
    }
    return selectedViewId
  }, [variant, selectedViewId, customViews])

  const cols = useMemo(() => {
    const grantDef = COLUMNS.find((c) => c.key === "grant")!
    const tail = colOrder.filter((k) => visibleCols.has(k)).map((k) => COLUMNS.find((c) => c.key === k)!)
    if (visibleCols.has("grant")) return [grantDef, ...tail]
    return tail
  }, [visibleCols, colOrder])
  const gridTemplate = cols.map((c) => c.width).join(" ")

  const fiscalYearOptions = useMemo(() => {
    const set = new Set<number>()
    for (const g of grants) {
      const fy = fiscalYearContainingDate(parseGrantDeadline(g.deadline))
      if (Number.isFinite(fy)) set.add(fy)
    }
    return Array.from(set)
      .sort((a, b) => a - b)
      .map(formatFiscalYearLabel)
  }, [grants])

  const filtered = useMemo(() => {
    let list = grants.filter((g) => {
      if (filters.fiscalYear && grantFiscalYearLabel(g.deadline) !== filters.fiscalYear) return false
      if (filters.funderType && g.funderType !== filters.funderType) return false
      if (filters.owner && g.ownerId !== filters.owner) return false
      return true
    })

    switch (builtinSlice) {
      case "q2-apps":
        list = list.filter((g) =>
          [
            "LOI In Progress",
            "LOI Submitted",
            "Application In Progress",
            "Application Submitted",
          ].includes(g.stage),
        )
        break
      case "fed-100k":
        list = list.filter((g) => g.award >= 100_000)
        break
      case "at-risk":
        list = list.filter(
          (g) =>
            g.blocked ||
            g.flagged ||
            (g.daysToDeadline <= 30 && g.stage !== "Closed" && g.stage !== "Declined"),
        )
        break
      case "renewal":
        list = list.filter((g) => g.renewalLikelihood === "High" || g.renewalLikelihood === "Medium")
        break
      default:
        break
    }

    return list
  }, [grants, filters, builtinSlice])

  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => compareGrantRows(a, b, sortKey, sortDir))
  }, [filtered, sortKey, sortDir])

  const filtersDirty = useMemo(() => {
    return (
      filters.fiscalYear !== filterBaseline.fiscalYear ||
      filters.funderType !== filterBaseline.funderType ||
      filters.owner !== filterBaseline.owner
    )
  }, [filters, filterBaseline])

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "All grants", items: sortedFiltered }]
    const map = new Map<string, Grant[]>()
    if (groupBy === "stage") {
      for (const stage of stageOrder) map.set(stage, [])
    }
    for (const g of sortedFiltered) {
      let key = "—"
      if (groupBy === "stage") key = g.stage
      else if (groupBy === "owner") key = team.find((t) => t.id === g.ownerId)?.name || "Unassigned"
      else if (groupBy === "funderType") key = g.funderType
      else if (groupBy === "projectGroup") key = g.projectGroup
      else if (groupBy === "deadline") key = deadlineMonthKey(g.deadline)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }
    let entries = Array.from(map.entries()).filter(([, items]) => items.length > 0)
    if (groupBy === "deadline") {
      entries = [...entries].sort(([a], [b]) => {
        if (a === "unknown") return 1
        if (b === "unknown") return -1
        return a.localeCompare(b)
      })
    }
    return entries.map(([key, items]) => ({ key, items }))
  }, [sortedFiltered, groupBy])

  useEffect(() => {
    updateTableScrollShadows()
  }, [updateTableScrollShadows, sortedFiltered, cols, gridTemplate])

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => updateTableScrollShadows())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateTableScrollShadows, sortedFiltered, cols])

  function handleSortColumn(key: ColKey) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("asc")
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function updateGrant(id: string, patch: Partial<Grant>, fieldLabel: string) {
    setGrants((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    toast(`${fieldLabel} updated`, { description: "Logged to activity timeline." })
  }

  function toggleColumn(key: ColKey) {
    const def = COLUMNS.find((c) => c.key === key)
    setVisibleCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (def?.locked) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleReorderColumns(from: ColKey, to: ColKey) {
    setColOrder((order) => reorderColumns(order, from, to))
  }

  function applyOperatorViewConfig(c: OperatorViewConfig) {
    setGroupBy(c.groupBy)
    setVisibleCols(new Set(c.visibleColKeys))
    setColOrder(c.colOrder)
    setFilters(c.filters)
    setFilterBaseline({ ...c.filters })
  }

  function handleSaveCustomView() {
    const name = saveViewName.trim()
    if (!name) return
    const baseSlice = selectedViewId.startsWith("custom-")
      ? (customViews.find((v) => v.id === selectedViewId)?.config.builtinSlice ?? "all")
      : selectedViewId
    const id = `custom-${Date.now()}`
    const config: OperatorViewConfig = {
      builtinSlice: baseSlice,
      groupBy,
      visibleColKeys: Array.from(visibleCols),
      colOrder: [...colOrder],
      filters: { ...filters },
    }
    setCustomViews((prev) => [...prev, { id, label: name, config }])
    setSelectedViewId(id)
    setFilterBaseline({ ...config.filters })
    setSaveViewOpen(false)
    setSaveViewName("")
    toast("View saved", { description: `“${name}” is in the View menu.` })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          variant === "operator" &&
            "overflow-hidden rounded-[12px] border border-border/80 bg-background shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        )}
      >
      {/* Toolbar: single row — view, filters, grouping — columns / new grant right */}
      <div
        className={cn(
          "flex flex-nowrap items-center gap-x-2 overflow-x-auto overflow-y-hidden px-6 py-2 scrollbar-thin",
          variant === "operator" ? "border-b-0 bg-background" : "border-b border-border bg-background",
        )}
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-x-2">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">View</span>
          <Select
            value={selectedViewId}
            onValueChange={(id) => {
              setSelectedViewId(id)
              if (variant === "operator" && id.startsWith("custom-")) {
                const cv = customViews.find((v) => v.id === id)
                if (cv) applyOperatorViewConfig(cv.config)
              } else {
                setFilters((prev) => {
                  const next = applyViewFilters(id, prev)
                  setFilterBaseline({ ...next })
                  return next
                })
              }
            }}
          >
            <SelectTrigger size="sm" className="h-7 w-[min(100%,11rem)] text-xs shadow-xs">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {SAVED_VIEWS.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {v.label}
                </SelectItem>
              ))}
              {variant === "operator" &&
                customViews.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    {v.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {variant === "operator" && filtersDirty && (
            <button
              type="button"
              onClick={() => {
                setSaveViewName("")
                setSaveViewOpen(true)
              }}
              title="Save columns, filters & grouping as a reusable view"
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-dashed border-border px-2 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              <Bookmark className="h-3 w-3" />
              Save view
            </button>
          )}

          <div className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />

          <FilterChip
            label="Fiscal year"
            value={filters.fiscalYear}
            options={fiscalYearOptions}
            onChange={(v) => setFilters({ ...filters, fiscalYear: v })}
          />
          <FilterChip
            label="Funder type"
            value={filters.funderType}
            options={["Federal", "Private", "Corporate", "State", "Local"]}
            onChange={(v) => setFilters({ ...filters, funderType: v })}
          />
          <FilterChip
            label="Owner"
            value={filters.owner ? team.find((t) => t.id === filters.owner)?.name || filters.owner : null}
            options={team.map((t) => t.name)}
            onChange={(v) => {
              const member = team.find((t) => t.name === v)
              setFilters({ ...filters, owner: member?.id ?? null })
            }}
          />
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-dashed border-border px-2 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Filter
          </button>

          <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />

          <GroupByPicker value={groupBy} onChange={setGroupBy} />
        </div>

        <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
          <ColumnPicker visible={visibleCols} onToggle={toggleColumn} />
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" />
            New grant
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-border bg-primary/5 px-6 py-2">
          <span className="text-xs font-medium text-foreground">{selected.size} selected</span>
          <button className="rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted">
            Reassign
          </button>
          <button className="rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted">
            Set status
          </button>
          <button className="rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted">
            Add tag
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>
      )}

      {/* Scrollport: fade (operator+chat) is a sibling so it stays viewport-anchored; table scrolls inside. */}
      <div className="relative min-h-0 min-w-0 flex-1">
        <div
          ref={tableScrollRef}
          onScroll={updateTableScrollShadows}
          className="h-full min-h-0 w-full overflow-auto overscroll-contain"
        >
          <div className="flex w-max flex-col">
          {/* Header — row height drives sticky offset below (+1px border-b) */}
          <div
            className={cn(
              "sticky top-0 z-40 grid w-max items-stretch border-b border-border",
              showStickyHeaderShadow && "shadow-sm",
              variant === "operator" && "border-t-0",
              "bg-muted",
            )}
            style={{ gridTemplateColumns: `40px ${gridTemplate}` }}
          >
            <div
              className={cn(
                "sticky left-0 flex min-h-[36px] items-center px-3",
                variant === "operator"
                  ? cn(
                      "border-r-0 bg-muted",
                      showPinnedScrollShadow
                        ? "z-[33] shadow-[3px_0_10px_-2px_rgba(0,0,0,0.07)] dark:shadow-[3px_0_10px_-2px_rgba(0,0,0,0.2)]"
                        : "z-[32] shadow-none",
                    )
                  : "z-[32] border-r border-border/60 bg-muted shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]",
              )}
            >
              <Checkbox
                checked={selected.size > 0 && selected.size === sortedFiltered.length}
                onCheckedChange={(v) => {
                  if (v) setSelected(new Set(sortedFiltered.map((g) => g.id)))
                  else setSelected(new Set())
                }}
              />
            </div>
            {cols.map((c) => (
              <SortableColumnHeader
                key={c.key}
                col={c}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSortColumn}
                onReorder={handleReorderColumns}
                draggingCol={draggingCol}
                onDraggingChange={setDraggingCol}
                variant={variant}
                showPinnedScrollShadow={variant === "operator" && showPinnedScrollShadow}
              />
            ))}
          </div>

          {/* Body */}
          {grouped.map((group) => {
            const collapsed = collapsedGroups.has(group.key)
            const sumAward = group.items.reduce((s, g) => s + g.award, 0)
            const sumWeighted = group.items.reduce((s, g) => s + (g.weighted ?? 0), 0)
            return (
              <div key={group.key}>
                {groupBy !== "none" && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="group/stickyrow sticky top-[37px] z-30 flex w-max min-w-full flex-nowrap items-center gap-2 border-b border-border bg-zinc-50 px-0 py-0 text-left hover:bg-zinc-100 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/45"
                  >
                    <span className="sticky left-[40px] z-[25] ml-[40px] flex shrink-0 items-center gap-2 bg-zinc-50 px-3 py-1.5 group-hover/stickyrow:bg-zinc-100 dark:bg-zinc-900/30 dark:group-hover/stickyrow:bg-zinc-900/45">
                      {collapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      {groupBy === "stage" && <StagePill stage={group.key as Stage} />}
                      {groupBy === "deadline" && (
                        <span className="text-xs font-semibold text-foreground">
                          {formatDeadlineMonthGroupLabel(group.key)}
                        </span>
                      )}
                      {groupBy !== "stage" && groupBy !== "deadline" && (
                        <span className="text-xs font-semibold text-foreground">{group.key}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {group.items.length} {group.items.length === 1 ? "grant" : "grants"}
                      </span>
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-3 px-3 py-1.5 text-[11px] tabular-nums text-muted-foreground">
                      <span>${(sumAward / 1000).toFixed(0)}K unweighted</span>
                      {sumWeighted > 0 && <span>${(sumWeighted / 1000).toFixed(0)}K weighted</span>}
                    </span>
                  </button>
                )}
                {!collapsed &&
                  group.items.map((grant) => (
                    <GrantRow
                      key={grant.id}
                      grant={grant}
                      cols={cols}
                      gridTemplate={gridTemplate}
                      isSelected={selected.has(grant.id)}
                      onToggleSelect={() => toggleSelect(grant.id)}
                      onOpen={() => onOpenGrant(grant.id)}
                      onUpdate={updateGrant}
                      variant={variant}
                      showPinnedScrollShadow={variant === "operator" && showPinnedScrollShadow}
                    />
                  ))}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="flex min-w-full flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No grants match your filters</p>
              <p className="text-xs text-muted-foreground">Try clearing filters or changing the view.</p>
            </div>
          )}
        </div>
        </div>
        {variant === "operator" && operatorChatOpen && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[25] w-16 bg-gradient-to-l from-background from-55% to-transparent"
            aria-hidden
          />
        )}
      </div>

      {/* Footer — grant count + totals */}
      <div className="flex items-center justify-between border-t border-border bg-background px-6 py-2 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          Showing {filtered.length} of {grants.length} grants
        </span>
        <span className="tabular-nums">
          $
          {(filtered.reduce((s, g) => s + g.award, 0) / 1_000_000).toFixed(2)}M unweighted ·{" "}
          $
          {(filtered.reduce((s, g) => s + (g.weighted ?? 0), 0) / 1_000_000).toFixed(2)}M weighted
        </span>
      </div>

      </div>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Saves this table layout: built-in slice, filters, grouping, and visible columns. Pick it anytime from the View
              menu.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="View name"
            value={saveViewName}
            onChange={(e) => setSaveViewName(e.target.value)}
            className="mt-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveCustomView()
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSaveViewOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveCustomView} disabled={!saveViewName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GrantRow({
  grant,
  cols,
  gridTemplate,
  isSelected,
  onToggleSelect,
  onOpen,
  onUpdate,
  variant = "default",
  showPinnedScrollShadow = false,
}: {
  grant: Grant
  cols: ColDef[]
  gridTemplate: string
  isSelected: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onUpdate: (id: string, patch: Partial<Grant>, fieldLabel: string) => void
  variant?: "default" | "operator"
  /** Checkbox + pinned grant column: soft right shadow when scrolled horizontally (operator). */
  showPinnedScrollShadow?: boolean
}) {
  const op = variant === "operator"
  const baseCell =
    !isSelected && !grant.blocked
      ? "bg-card dark:bg-card group-hover:bg-muted dark:group-hover:bg-muted"
      : ""
  const grantColShell = cn(
    "sticky left-[40px] flex min-h-full w-full min-w-[320px] max-w-[320px] flex-col border-r border-border/60",
    op && showPinnedScrollShadow
      ? "z-[33] shadow-[3px_0_10px_-2px_rgba(0,0,0,0.07)] dark:shadow-[3px_0_10px_-2px_rgba(0,0,0,0.2)]"
      : "z-[28]",
    isSelected && "bg-violet-100 dark:bg-violet-950",
    !isSelected && grant.blocked && "bg-amber-50 dark:bg-amber-950",
    !isSelected && !grant.blocked && baseCell,
  )

  return (
    <div
      onClick={onOpen}
      className={[
        "group grid w-max cursor-pointer items-stretch border-b border-border/60 transition-colors hover:bg-muted",
        isSelected && "bg-violet-100 dark:bg-violet-950",
        !isSelected && grant.blocked && "bg-amber-50 dark:bg-amber-950",
        !isSelected && !grant.blocked && "bg-card dark:bg-card group-hover:bg-muted dark:group-hover:bg-muted",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ gridTemplateColumns: `40px ${gridTemplate}` }}
    >
      <div
        className={cn(
          "sticky left-0 z-[32] flex items-center px-3 py-2.5",
          op && showPinnedScrollShadow && "z-[33] shadow-[3px_0_10px_-2px_rgba(0,0,0,0.07)] dark:shadow-[3px_0_10px_-2px_rgba(0,0,0,0.2)]",
          op && !showPinnedScrollShadow && "shadow-none",
          op ? "border-r-0" : "border-r border-border/60",
          isSelected && "bg-violet-100 dark:bg-violet-950",
          !isSelected && grant.blocked && "bg-amber-50 dark:bg-amber-950",
          !isSelected && !grant.blocked && baseCell,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </div>
      {cols.map((c) => (
        <div
          key={c.key}
          className={cn(
            "relative z-0 min-h-full min-w-0",
            c.key === "grant" && grantColShell,
            c.key !== "grant" && "grid grid-cols-[1.75rem_minmax(0,1fr)] items-stretch",
          )}
        >
          {c.key !== "grant" && <span className="block w-7 shrink-0" aria-hidden />}
          <Cell
            col={c}
            grant={grant}
            onUpdate={onUpdate}
            stopPropagation={(e) => e.stopPropagation()}
          />
        </div>
      ))}
    </div>
  )
}

function Cell({
  col,
  grant,
  onUpdate,
  stopPropagation,
}: {
  col: ColDef
  grant: Grant
  onUpdate: (id: string, patch: Partial<Grant>, fieldLabel: string) => void
  stopPropagation: (e: React.MouseEvent) => void
}) {
  const wrap = "min-w-0 flex-1 px-3 py-2.5 text-xs"

  switch (col.key) {
    case "grant":
      return (
        <div className={cn(wrap, "flex min-h-full min-w-0 flex-col justify-center")}>
          <div className="flex min-w-0 items-center gap-2">
            {grant.flagged && <Flag className="h-3 w-3 shrink-0 text-chart-4" />}
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{grant.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{grant.id}</span>
                {grant.blocked && (
                  <span className="rounded bg-chart-5/10 px-1 py-0 text-[10px] font-medium text-chart-5">
                    Blocked
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    case "funder":
      return (
        <div className={wrap}>
          <span className="truncate text-foreground">{grant.funder}</span>
        </div>
      )
    case "status":
      return (
        <div className={wrap} onClick={stopPropagation}>
          <EditablePicker
            menuTitle="Set status"
            value={grant.stage}
            options={[...stageOrder]}
            onChange={(v) => onUpdate(grant.id, { stage: v as Stage }, "Status")}
            renderValue={() => <StagePill stage={grant.stage} className="max-w-full" />}
          />
        </div>
      )
    case "deadline": {
      const urgency = grant.daysToDeadline <= 7 ? "crit" : grant.daysToDeadline <= 21 ? "warn" : "ok"
      const lineClass =
        urgency === "crit"
          ? "text-rose-950 dark:text-rose-100"
          : urgency === "warn"
            ? "text-amber-950 dark:text-amber-100"
            : "text-foreground"
      const suffixClass =
        urgency === "crit"
          ? "text-rose-900/90 dark:text-rose-200/90"
          : urgency === "warn"
            ? "text-amber-900/90 dark:text-amber-200/90"
            : "text-muted-foreground"
      return (
        <div
          className={cn(
            wrap,
            "flex w-full justify-end text-right tabular-nums font-normal leading-normal",
          )}
        >
          <span className={lineClass}>
            {new Date(grant.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            <span className={suffixClass}> · {grant.daysToDeadline}d</span>
          </span>
        </div>
      )
    }
    case "award":
      return (
        <div className={[wrap, "text-right tabular-nums text-foreground"].join(" ")}>
          ${(grant.award / 1000).toFixed(0)}K
        </div>
      )
    case "owner":
      return (
        <div className={wrap} onClick={stopPropagation}>
          <EditablePicker
            value={team.find((t) => t.id === grant.ownerId)?.name || ""}
            options={[...team.map((t) => t.name), "Unassign"]}
            onChange={(v) => {
              const next = team.find((t) => t.name === v)
              onUpdate(grant.id, { ownerId: next?.id ?? grant.ownerId }, "Owner")
            }}
            renderValue={() => (
              <div className="flex items-center gap-1.5 min-w-0">
                <OwnerAvatar id={grant.ownerId} size={20} />
                <span className="truncate">{team.find((t) => t.id === grant.ownerId)?.name.split(" ")[0]}</span>
              </div>
            )}
          />
        </div>
      )
    case "cycle":
      return <div className={wrap}>{grant.cycle}</div>
    case "fundingSource":
      return <div className={wrap + " truncate text-muted-foreground"}>{grant.fundingSource}</div>
    case "fain":
      return (
        <div className={wrap + " font-mono text-[10px] text-muted-foreground"}>
          {grant.fain || <span className="opacity-50">—</span>}
        </div>
      )
    case "cfda":
      return (
        <div className={wrap + " font-mono text-[10px] text-muted-foreground"}>
          {grant.cfda || <span className="opacity-50">—</span>}
        </div>
      )
    case "period":
      return (
        <div className={wrap + " text-[11px] text-muted-foreground"}>
          {grant.period || <span className="opacity-50">—</span>}
        </div>
      )
    case "indirect":
      return (
        <div className={wrap + " tabular-nums text-muted-foreground"}>
          {grant.indirect ? `${(grant.indirect * 100).toFixed(1)}%` : <span className="opacity-50">—</span>}
        </div>
      )
    case "match":
      return (
        <div className={wrap + " text-muted-foreground"}>
          {grant.matchRequired === undefined ? "—" : grant.matchRequired ? "Required" : "—"}
        </div>
      )
    case "lastUpdated":
      return <div className={wrap + " text-muted-foreground"}>{grant.lastUpdated}</div>
    case "projectGroup":
      return (
        <div className={wrap} onClick={stopPropagation}>
          <EditablePicker
            value={grant.projectGroup}
            options={["Health Equity", "Workforce", "General Op", "Capacity", "Research"]}
            onChange={(v) => onUpdate(grant.id, { projectGroup: v as Grant["projectGroup"] }, "Project group")}
            renderValue={() => (
              <span className="rounded border border-border bg-background px-1.5 py-0 text-[10px]">
                {grant.projectGroup}
              </span>
            )}
          />
        </div>
      )
    case "priority":
      return (
        <div className={wrap} onClick={stopPropagation}>
          <EditablePicker
            value={grant.priority}
            options={["P0", "P1", "P2", "P3"]}
            onChange={(v) => onUpdate(grant.id, { priority: v as Grant["priority"] }, "Priority")}
            renderValue={() => <PriorityPill priority={grant.priority} />}
          />
        </div>
      )
    case "renewal":
      return (
        <div className={wrap} onClick={stopPropagation}>
          <EditablePicker
            value={grant.renewalLikelihood}
            options={["High", "Medium", "Low", "Unknown"]}
            onChange={(v) =>
              onUpdate(grant.id, { renewalLikelihood: v as Grant["renewalLikelihood"] }, "Renewal likelihood")
            }
            renderValue={() => <span className="text-foreground">{grant.renewalLikelihood}</span>}
          />
        </div>
      )
    default:
      return <div className={wrap}>—</div>
  }
}

function EditablePicker({
  menuTitle = "Set value",
  value,
  options,
  onChange,
  renderValue,
}: {
  menuTitle?: string
  value: string
  options: string[]
  onChange: (v: string) => void
  renderValue: () => React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex w-full min-w-0 items-center rounded -mx-1 px-1 py-0.5 text-left hover:bg-background hover:ring-1 hover:ring-border">
          {renderValue()}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,18rem)] max-h-72 overflow-y-auto p-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-2 py-1">
          {menuTitle}
        </div>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={[
              "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted",
              opt === value && "bg-muted/60 font-medium",
            ].filter(Boolean).join(" ")}
          >
            {opt}
            {opt === value && <span className="text-primary">✓</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function SortableColumnHeader({
  col,
  sortKey,
  sortDir,
  onSort,
  onReorder,
  draggingCol,
  onDraggingChange,
  variant = "default",
  showPinnedScrollShadow = false,
}: {
  col: ColDef
  sortKey: ColKey | null
  sortDir: SortDir
  onSort: (key: ColKey) => void
  onReorder: (from: ColKey, to: ColKey) => void
  draggingCol: ColKey | null
  onDraggingChange: (key: ColKey | null) => void
  variant?: "default" | "operator"
  showPinnedScrollShadow?: boolean
}) {
  const active = sortKey === col.key
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
  const isGrant = col.key === "grant"
  const rightAlign = col.key === "award" || col.key === "deadline"
  const op = variant === "operator"

  const sortLabelButton = (
    <button
      type="button"
      onClick={() => onSort(col.key)}
      className={cn(
        "flex min-h-[36px] w-full min-w-0 items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:bg-muted/60",
        rightAlign && "justify-end text-right",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      {col.locked && <Lock className="h-2.5 w-2.5 shrink-0" />}
      <span className="min-w-0 truncate">{col.label}</span>
      <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
    </button>
  )

  if (isGrant) {
    return (
      <div
        className={cn(
          "relative sticky left-[40px] flex min-h-[36px] min-w-[320px] max-w-[320px] flex-col justify-center border-r border-border/60",
          op
            ? cn(
                "bg-muted",
                showPinnedScrollShadow
                  ? "z-[33] shadow-[3px_0_10px_-2px_rgba(0,0,0,0.07)] dark:shadow-[3px_0_10px_-2px_rgba(0,0,0,0.2)]"
                  : "z-[28] shadow-none",
              )
            : "z-[28] bg-muted shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]",
        )}
      >
        {sortLabelButton}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative z-0 grid min-h-[36px] min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-stretch",
        draggingCol === col.key && "opacity-60",
      )}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
      }}
      onDrop={(e) => {
        e.preventDefault()
        const from = (e.dataTransfer.getData(DND_COLUMN_MIME) || e.dataTransfer.getData("text/plain")) as ColKey
        if (from && from !== "grant") onReorder(from, col.key)
        onDraggingChange(null)
      }}
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DND_COLUMN_MIME, col.key)
          e.dataTransfer.setData("text/plain", col.key)
          e.dataTransfer.effectAllowed = "move"
          onDraggingChange(col.key)
        }}
        onDragEnd={() => onDraggingChange(null)}
        className="flex h-full w-full cursor-grab touch-none items-center justify-center border-r border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${col.label} column`}
        title="Drag to reorder column"
      >
        <GripVertical className="h-3.5 w-3.5 opacity-70" />
      </button>
      {sortLabelButton}
    </div>
  )
}

function FilterChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: string[]
  onChange: (v: string | null) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[11px]",
            value
              ? "border-primary/30 bg-primary/5 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Filter className="h-3 w-3 shrink-0" />
          <span className="shrink-0 font-medium">{label}</span>
          {value && (
            <>
              <span className="text-muted-foreground/60">:</span>
              <span className="shrink-0 font-medium text-primary">{value}</span>
              <span
                role="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(null)
                }}
                className="ml-0.5 rounded p-0.5 hover:bg-primary/10"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted"
          >
            {opt}
            {opt === value && <span className="text-primary">✓</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function GroupByPicker({ value, onChange }: { value: GroupBy; onChange: (v: GroupBy) => void }) {
  const options: { id: GroupBy; label: string }[] = [
    { id: "stage", label: "Stage" },
    { id: "owner", label: "Owner" },
    { id: "funderType", label: "Funder type" },
    { id: "projectGroup", label: "Project group" },
    { id: "deadline", label: "Deadline" },
    { id: "none", label: "No grouping" },
  ]
  const current = options.find((o) => o.id === value)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background px-2 text-[11px] shadow-xs hover:bg-muted"
        >
          <Settings2 className="h-3 w-3 shrink-0" />
          <span className="shrink-0 text-muted-foreground">Group</span>
          <span className="shrink-0 font-medium text-foreground">{current?.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted"
          >
            {opt.label}
            {opt.id === value && <span className="text-primary">✓</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function ColumnPicker({ visible, onToggle }: { visible: Set<ColKey>; onToggle: (k: ColKey) => void }) {
  const system = COLUMNS.filter((c) => c.group === "system")
  const custom = COLUMNS.filter((c) => c.group === "custom")
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted">
          <Columns3 className="h-3 w-3" />
          Columns
          <span className="rounded bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">
            {visible.size}/{COLUMNS.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1">
          System fields
        </div>
        <div className="space-y-0.5">
          {system.map((c) => (
            <ColumnRow key={c.key} col={c} checked={visible.has(c.key)} onToggle={() => onToggle(c.key)} />
          ))}
        </div>
        <div className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1">
          Custom fields
        </div>
        <div className="space-y-0.5">
          {custom.map((c) => (
            <ColumnRow key={c.key} col={c} checked={visible.has(c.key)} onToggle={() => onToggle(c.key)} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColumnRow({ col, checked, onToggle }: { col: ColDef; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={[
        "flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted",
        col.locked && "cursor-not-allowed opacity-60",
      ].filter(Boolean).join(" ")}
    >
      <span className="flex items-center gap-2">
        <Checkbox checked={checked} disabled={col.locked} onCheckedChange={() => !col.locked && onToggle()} />
        {col.label}
      </span>
      {col.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
    </label>
  )
}
