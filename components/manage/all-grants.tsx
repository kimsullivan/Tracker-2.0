"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useScrollDockPins } from "@/hooks/use-scroll-dock-pins"
import type { CSSProperties, ReactNode } from "react"
import { grants as grantsData, stageOrder, team } from "@/lib/manage/data"
import type { Grant, Stage, FunderType } from "@/lib/manage/types"
import { format, startOfDay, subDays } from "date-fns"
import {
  defaultTimeRangeFilterPatch,
  grantDeadlineMatchesTimeRange,
  migrateToolbarTimeRangeFilters,
  timeRangeExportSuffix,
  timeRangeMenuLabel,
  TIME_RANGE_MENU,
  type TimeRangePresetId,
} from "@/lib/manage/time-range-filter"
import { grantDisplayTitle } from "@/lib/manage/grant-context"
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
  Download,
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
import {
  applyFunderPortfolioKpiFilters,
  awardedSumGrant,
  DEFAULT_FUNDER_PORTFOLIO_KPI,
  pickLastActivityDisplay,
  renewalStatusForGrant,
  type FunderPortfolioKpiState,
} from "@/lib/manage/funder-portfolio"
import { PulseStripFunderPortfolio } from "@/components/manage/funder-portfolio-kpi-tiles"
import { downloadGrantsCsvReport, downloadGrantsPdfReport } from "@/lib/manage/grants-export"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
export type ColKey =
  | "grant"
  | "funder"
  | "status"
  | "deadline"
  | "award"
  | "amountRequested"
  | "notificationDate"
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
  /** Funder portfolio saved-view lens — grant-backed cells, portfolio column set only */
  | "fpFunder"
  | "fpFunderType"
  | "fpTotalAwarded"
  | "fpLastActivity"
  | "fpRenewalStatus"

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
  { key: "grant", label: "Grant", width: "320px", group: "system", defaultVisible: true },
  { key: "funder", label: "Funder", width: "240px", group: "system", defaultVisible: true },
  { key: "status", label: "Status", width: "260px", group: "system", defaultVisible: true },
  { key: "projectGroup", label: "Project group", width: "160px", group: "custom", defaultVisible: true },
  { key: "deadline", label: "Deadline", width: "180px", group: "system", defaultVisible: true },
  { key: "award", label: "Award", width: "132px", group: "system", defaultVisible: true },
  { key: "amountRequested", label: "Amount requested", width: "132px", group: "system", defaultVisible: false },
  { key: "notificationDate", label: "Notification date", width: "140px", group: "system", defaultVisible: false },
  { key: "owner", label: "Owner", width: "144px", group: "system", defaultVisible: true },
  { key: "cycle", label: "Cycle", width: "96px", group: "system", defaultVisible: true },
  { key: "fundingSource", label: "Funding source", width: "220px", group: "system", defaultVisible: true },
  { key: "fain", label: "FAIN", width: "168px", group: "system", defaultVisible: true },
  { key: "cfda", label: "CFDA", width: "100px", group: "system", defaultVisible: true },
  { key: "period", label: "Period", width: "192px", group: "system", defaultVisible: true },
  { key: "indirect", label: "Indirect", width: "96px", group: "system", defaultVisible: true },
  { key: "match", label: "Match", width: "88px", group: "system", defaultVisible: true },
  { key: "lastUpdated", label: "Last updated", width: "132px", group: "system", defaultVisible: true },
  { key: "priority", label: "Priority", width: "96px", group: "custom", defaultVisible: true },
  { key: "renewal", label: "Renewal", width: "120px", group: "custom", defaultVisible: true },
  { key: "fpFunder", label: "Funder", width: "240px", group: "custom", defaultVisible: false },
  { key: "fpFunderType", label: "Funder type", width: "140px", group: "custom", defaultVisible: false },
  { key: "fpTotalAwarded", label: "Total awarded", width: "140px", group: "custom", defaultVisible: false },
  { key: "fpLastActivity", label: "Last activity", width: "140px", group: "custom", defaultVisible: false },
  { key: "fpRenewalStatus", label: "Renewal status", width: "180px", group: "custom", defaultVisible: false },
]

/** All column keys except Grant — Grant stays pinned first; these may be reordered. */
const NON_GRANT_COLUMN_KEYS: ColKey[] = COLUMNS.filter((c) => c.key !== "grant").map((c) => c.key)

/** All non-grant columns in `COLUMNS` order, excluding rollup-only `fp*` — wide layouts for horizontal scroll. */
const TABLE_SCROLL_FILL_COL_ORDER: ColKey[] = COLUMNS.filter(
  (c) => c.key !== "grant" && !c.key.startsWith("fp"),
).map((c) => c.key)

/**
 * After **Grant**: awarded → last activity → deadline, then remaining fields.
 * **Funder** omitted (name on group row). No renewal columns in this lens for now.
 */
const FUNDER_PORTFOLIO_TABLE_COL_ORDER: ColKey[] = [
  "award",
  "lastUpdated",
  "deadline",
  "status",
  "projectGroup",
  "amountRequested",
  "notificationDate",
  "owner",
  "cycle",
  "fundingSource",
  "fain",
  "cfda",
  "period",
  "indirect",
  "match",
  "priority",
]

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

/** Non-grant column order only. `after: null` inserts at the start (after Grant). */
function placeColumnAfter(order: ColKey[], moved: ColKey, after: ColKey | null): ColKey[] {
  if (moved === "grant") return order
  const tail = order.filter((k) => k !== moved)
  if (after === null) return [moved, ...tail]
  const idx = tail.indexOf(after)
  if (idx === -1) return [...tail, moved]
  return [...tail.slice(0, idx + 1), moved, ...tail.slice(idx + 1)]
}

function placeColumnBeforeKey(order: ColKey[], moved: ColKey, before: ColKey): ColKey[] {
  if (moved === "grant") return order
  const idx = order.indexOf(before)
  if (idx <= 0) return placeColumnAfter(order, moved, null)
  return placeColumnAfter(order, moved, order[idx - 1]!)
}

export type GroupBy = "stage" | "owner" | "funderType" | "funder" | "projectGroup" | "deadline" | "none"

const GROUP_BY_EXPORT_LABEL: Record<GroupBy, string | null> = {
  stage: "Stage",
  owner: "Owner",
  funderType: "Funder type",
  funder: "Funder",
  projectGroup: "Project group",
  deadline: "Deadline month",
  none: null,
}

export type SortDir = "asc" | "desc"

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
      return grantDisplayTitle(g).toLowerCase()
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
    case "amountRequested":
      return g.weighted ?? 0
    case "notificationDate":
      return g.lastUpdated.toLowerCase()
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
    case "fpFunder":
      return g.funder.toLowerCase()
    case "fpFunderType":
      return g.funderType.toLowerCase()
    case "fpTotalAwarded":
      return awardedSumGrant(g)
    case "fpLastActivity":
      return g.lastUpdated.toLowerCase()
    case "fpRenewalStatus":
      return renewalStatusForGrant(g, new Date()).toLowerCase()
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

function fmtBoard$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

/** Calendar date from ISO `YYYY-MM-DD` in local time (avoids UTC off-by-one). */
function parseGrantDeadline(iso: string): Date {
  const part = iso.split("T")[0] ?? ""
  const [y, mo, d] = part.split("-").map((x) => parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return new Date(NaN)
  return new Date(y, mo - 1, d)
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

function formatGroupExportTitle(key: string, by: GroupBy): string {
  if (by === "deadline") return formatDeadlineMonthGroupLabel(key)
  return key
}

const SAVED_VIEWS = [
  { id: "all", label: "All active" },
  { id: "board-leadership", label: "Board / Leadership" },
  { id: "funder-portfolio", label: "Funder portfolio" },
  { id: "q2-apps", label: "Q2 applications" },
  { id: "fed-100k", label: "Federal > $100K" },
  { id: "at-risk", label: "At-risk reports" },
  { id: "renewal", label: "Renewal window" },
  { id: "maria", label: "Maria's load" },
]

/** First three pipeline lenses — prebuilt Instrumentl views (vs. sample rows + user-saved below). */
export const INSTRUMENTL_CANNED_VIEW_IDS = new Set<string>(["all", "board-leadership", "funder-portfolio"])

/** Labels minted by the old ephemeral fork flow — drop from saved pickers (dedupe built-ins). */
const OPERATOR_EPHEMERAL_WORKING_LABELS = new Set(SAVED_VIEWS.map((v) => `Working · ${v.label}`))

function resolveOperatorViewParam(param: string | null): string {
  if (param && SAVED_VIEWS.some((v) => v.id === param)) return param
  return "all"
}

/** Table header overrides — Template 2 (Board / Leadership) */
const BOARD_COLUMN_HEADERS: Partial<Record<ColKey, string>> = {
  grant: "Grant Name",
  status: "Stage",
  amountRequested: "Amount Requested",
  award: "Amount Awarded",
  notificationDate: "Notification Date",
}

function applyViewFilters(
  viewId: string,
  prev: Record<string, string | null>,
): Record<string, string | null> {
  const tr = defaultTimeRangeFilterPatch()
  if (viewId === "maria") {
    return migrateToolbarTimeRangeFilters({ ...prev, ...tr, owner: "maria", funderType: null })
  }
  if (viewId === "fed-100k") {
    return migrateToolbarTimeRangeFilters({ ...prev, ...tr, funderType: "Federal", owner: null })
  }
  return migrateToolbarTimeRangeFilters({ ...prev, ...tr, funderType: null, owner: null })
}

export type OperatorViewConfig = {
  builtinSlice: string
  groupBy: GroupBy
  visibleColKeys: ColKey[]
  colOrder: ColKey[]
  filters: Record<string, string | null>
  /** Present when the saved view lineage is the Funder portfolio lens. */
  funderPortfolioKpi?: FunderPortfolioKpiState
  /** Mixed-alt: fourth pipeline tile on “Where are we?” (`builtinSlice === "all"`). */
  pipelineFourthMetric?: "winrate" | "team_capacity"
}

type OperatorSavedView = { id: string; label: string; config: OperatorViewConfig }

type OperatorColumnLayoutBaseline = { visibleSorted: ColKey[]; order: ColKey[] }

function snapshotOperatorColumnLayout(visible: Set<ColKey>, order: ColKey[]): OperatorColumnLayoutBaseline {
  return { visibleSorted: [...visible].sort(), order: [...order] }
}

function isOperatorColumnLayoutDirty(
  visible: Set<ColKey>,
  order: ColKey[],
  baseline: OperatorColumnLayoutBaseline,
): boolean {
  const cur = snapshotOperatorColumnLayout(visible, order)
  const vs = baseline.visibleSorted
  if (cur.visibleSorted.length !== vs.length) return true
  for (let i = 0; i < cur.visibleSorted.length; i++) {
    if (cur.visibleSorted[i] !== vs[i]) return true
  }
  const bo = baseline.order
  if (cur.order.length !== bo.length) return true
  for (let i = 0; i < cur.order.length; i++) {
    if (cur.order[i] !== bo[i]) return true
  }
  return false
}

export type AllGrantsFilterApi = {
  setFilters: (patch: Partial<Record<string, string | null>>) => void
  /** `silent`: skip toast (e.g. assistant already confirms in chat). */
  saveNamedView: (name: string, opts?: { silent?: boolean }) => void
  setGroupBy: (groupBy: GroupBy) => void
  setSort: (sortKey: ColKey | null, sortDir?: SortDir) => void
  clearToolbarFilters: () => void
  /** Show or hide a column (locked columns ignore hide). */
  setColumnVisible: (key: ColKey, visible: boolean) => void
  /** Move a column to immediately before another (non-grant keys only). */
  moveColumnBefore: (moved: ColKey, before: ColKey) => void
  /** Move a column to immediately after another; `after: null` = first after Grant. */
  moveColumnAfter: (moved: ColKey, after: ColKey | null) => void
  /** Opens the Save view dialog (operator layout). Prefill the name when provided. */
  openSaveViewDialog: (opts?: { suggestedName?: string }) => void
  /** Operator: same export as View menu PDF/CSV; `silent` skips success toasts (e.g. chat card is enough). */
  exportLensReport: (format: "pdf" | "csv", opts?: { silent?: boolean }) => void
}

export function AllGrants({
  onOpenGrant,
  variant = "default",
  showToolbarNewGrant = true,
  flatChrome = false,
  pageScrollMode = false,
  pageScrollParent,
  stickyFilterPrefix,
  /** Rendered below the sticky filter toolbar and above column headers when `pageScrollMode` (e.g. Mixed-alt KPI strip). */
  pageScrollBetweenFiltersAndTable,
  /** Mixed-alt: display label for built-in slice `all` (“Pipeline Overview”). */
  operatorBuiltinAllLabel,
  kpiBridgeFilter,
  onFilteredBaseChange,
  onViewLabelChange,
  /** AND-filter after built-in view + toolbar filters (Mix Alt agent). */
  extraGrantFilter,
  /** Sticky filter band accessory row (e.g. agent chips). */
  filterToolbarAccessory,
  onRegisterFilterApi,
  /** Operator only: notifies parent when built-in view slice changes (e.g. board KPI strip). */
  onOperatorBuiltinSliceChange,
  /** Operator only: View dropdown selection (`all` = Pipeline Overview). */
  onOperatorViewIdChange,
  /** When incremented (e.g. switching back to All grants tab), snap to built-in `all` (“Where are we?”). */
  operatorHomeViewResetKey,
  onOperatorSaveViewCommitted,
  /** Current fourth KPI tile (pipeline overview); stored on save when `builtinSlice` is `all`. */
  operatorPipelineFourthMetric,
  /** After applying a saved/custom view configuration (e.g. restore team capacity tile). */
  onOperatorViewConfigApplied,
}: {
  onOpenGrant: (id: string) => void
  variant?: "default" | "operator"
  /** Set false when “New grant” lives in the app header instead. */
  showToolbarNewGrant?: boolean
  /** Operator layout: omit the outer card shadow (e.g. mixed prototype). */
  flatChrome?: boolean
  /**
   * Use page layout scroll for the grants block (Mixed): KPI/toggle/table share one outer column;
   * filter row stays outside horizontal table scrolling.
   */
  pageScrollMode?: boolean
  /** Mixed grants column `overflow-y-auto` element — sticky + intersection observers need this root. */
  pageScrollParent?: HTMLElement | null
  /** Stuck with filter toolbar + table header (e.g. My work / All grants toggle in mixed prototype). */
  stickyFilterPrefix?: ReactNode
  /** Rendered below sticky filters, above table header rail (scrolls with page). */
  pageScrollBetweenFiltersAndTable?: ReactNode
  /** When set, replaces “All active” for built-in view `all` (operator / mixed-alt). */
  operatorBuiltinAllLabel?: string
  /** KPI drill filter applied after View/chip filters (All grants operator bridge — Mixed alt). */
  kpiBridgeFilter?: ((g: Grant) => boolean) | null
  onFilteredBaseChange?: (grants: Grant[]) => void
  onViewLabelChange?: (label: string) => void
  extraGrantFilter?: ((g: Grant) => boolean) | null
  filterToolbarAccessory?: ReactNode
  onRegisterFilterApi?: (api: AllGrantsFilterApi | null) => void
  onOperatorBuiltinSliceChange?: (sliceId: string) => void
  onOperatorViewIdChange?: (viewId: string) => void
  operatorHomeViewResetKey?: number
  /** Operator: after Save view dialog commits — in-chat ack instead of toast when set (mixed shells). */
  onOperatorSaveViewCommitted?: (name: string) => void
  operatorPipelineFourthMetric?: "winrate" | "team_capacity"
  onOperatorViewConfigApplied?: (config: OperatorViewConfig) => void
}) {
  const [selectedViewId, setSelectedViewId] = useState("all")
  const [customViews, setCustomViews] = useState<OperatorSavedView[]>([])

  useEffect(() => {
    if (variant !== "operator") return
    setCustomViews((prev) => prev.filter((v) => !OPERATOR_EPHEMERAL_WORKING_LABELS.has(v.label)))
  }, [variant])

  useEffect(() => {
    if (variant !== "operator") return
    if (!selectedViewId.startsWith("custom-")) return
    const stillThere = customViews.some((v) => v.id === selectedViewId)
    if (!stillThere) setSelectedViewId("all")
  }, [variant, customViews, selectedViewId])

  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState("")
  const [groupBy, setGroupBy] = useState<GroupBy>("stage")
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)),
  )
  const [grants, setGrants] = useState<Grant[]>(grantsData)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Record<string, string | null>>(() => ({
    ...defaultTimeRangeFilterPatch(),
    funderType: null,
    owner: null,
  }))
  const [filterBaseline, setFilterBaseline] = useState<Record<string, string | null>>(() => ({
    ...defaultTimeRangeFilterPatch(),
    funderType: null,
    owner: null,
  }))
  const [sortKey, setSortKey] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [colOrder, setColOrder] = useState<ColKey[]>(() => [...NON_GRANT_COLUMN_KEYS])
  const [draggingCol, setDraggingCol] = useState<ColKey | null>(null)
  const [fpKpi, setFpKpi] = useState<FunderPortfolioKpiState>(() => ({ ...DEFAULT_FUNDER_PORTFOLIO_KPI }))
  const [fpKpiBaseline, setFpKpiBaseline] = useState<FunderPortfolioKpiState>(() => ({ ...DEFAULT_FUNDER_PORTFOLIO_KPI }))
  const [columnLayoutBaseline, setColumnLayoutBaseline] = useState<OperatorColumnLayoutBaseline>(() =>
    snapshotOperatorColumnLayout(
      new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)),
      [...NON_GRANT_COLUMN_KEYS],
    ),
  )

  const builtinSlice = useMemo(() => {
    if (variant === "operator" && selectedViewId.startsWith("custom-")) {
      return customViews.find((v) => v.id === selectedViewId)?.config.builtinSlice ?? "all"
    }
    return selectedViewId
  }, [variant, selectedViewId, customViews])

  const viewPickerGroups = useMemo(() => {
    const filtered = SAVED_VIEWS.filter(
      (v) =>
        variant === "operator" || (v.id !== "board-leadership" && v.id !== "funder-portfolio"),
    )
    return {
      instrumentl: filtered.filter((v) => INSTRUMENTL_CANNED_VIEW_IDS.has(v.id)),
      customPreset: filtered.filter((v) => !INSTRUMENTL_CANNED_VIEW_IDS.has(v.id)),
    }
  }, [variant])

  const boardAudience = variant === "operator" && builtinSlice === "board-leadership"
  const funderPortfolioLens = variant === "operator" && builtinSlice === "funder-portfolio"

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const portfolioNow = useMemo(() => new Date(), [])

  const applyBoardLeadershipPreset = useCallback(() => {
    setGroupBy("stage")
    setSortKey("amountRequested")
    setSortDir("desc")
    const boardVis = new Set<ColKey>(["grant", ...TABLE_SCROLL_FILL_COL_ORDER])
    const boardOrder = [...TABLE_SCROLL_FILL_COL_ORDER] as ColKey[]
    setVisibleCols(boardVis)
    setColOrder(boardOrder)
    setColumnLayoutBaseline(snapshotOperatorColumnLayout(boardVis, boardOrder))
    const nextFilters: Record<string, string | null> = {
      ...defaultTimeRangeFilterPatch(),
      funderType: null,
      owner: null,
    }
    setFilters(nextFilters)
    setFilterBaseline({ ...nextFilters })
    setFpKpi({ ...DEFAULT_FUNDER_PORTFOLIO_KPI })
    setFpKpiBaseline({ ...DEFAULT_FUNDER_PORTFOLIO_KPI })
  }, [])

  const applyFunderPortfolioPreset = useCallback(() => {
    setGroupBy("funder")
    setSortKey(null)
    setSortDir("desc")
    setFpKpi({ ...DEFAULT_FUNDER_PORTFOLIO_KPI })
    setFpKpiBaseline({ ...DEFAULT_FUNDER_PORTFOLIO_KPI })
    const fpVis = new Set<ColKey>(["grant", ...FUNDER_PORTFOLIO_TABLE_COL_ORDER])
    const fpOrder = [...FUNDER_PORTFOLIO_TABLE_COL_ORDER] as ColKey[]
    setVisibleCols(fpVis)
    setColOrder(fpOrder)
    setColumnLayoutBaseline(snapshotOperatorColumnLayout(fpVis, fpOrder))
    const nextFilters: Record<string, string | null> = {
      ...defaultTimeRangeFilterPatch(),
      funderType: null,
      owner: null,
    }
    setFilters(nextFilters)
    setFilterBaseline({ ...nextFilters })
  }, [])

  const resetOperatorTableDefaults = useCallback(() => {
    setGroupBy("stage")
    setSortKey(null)
    setSortDir("asc")
    const defVis = new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
    const defOrder = [...NON_GRANT_COLUMN_KEYS] as ColKey[]
    setVisibleCols(defVis)
    setColOrder(defOrder)
    setColumnLayoutBaseline(snapshotOperatorColumnLayout(defVis, defOrder))
    setFpKpi({ ...DEFAULT_FUNDER_PORTFOLIO_KPI })
    setFpKpiBaseline({ ...DEFAULT_FUNDER_PORTFOLIO_KPI })
  }, [])

  const tableScrollRef = useRef<HTMLDivElement>(null)
  const tableHeaderHorizRef = useRef<HTMLDivElement>(null)
  const horizSyncLock = useRef(false)
  const toggleStickyMeasRef = useRef<HTMLDivElement>(null)
  const filterStickyMeasRef = useRef<HTMLDivElement>(null)
  const headerRailWrapRef = useRef<HTMLDivElement>(null)
  const [showPinnedScrollShadow, setShowPinnedScrollShadow] = useState(false)
  /** Right-edge gradient when the table is wider than the viewport and more columns sit off-screen. */
  const [showTableRightFade, setShowTableRightFade] = useState(false)
  const [sentinelToggleEl, setSentinelToggleEl] = useState<HTMLDivElement | null>(null)
  const [sentinelFilterEl, setSentinelFilterEl] = useState<HTMLDivElement | null>(null)
  const [sentinelHeaderEl, setSentinelHeaderEl] = useState<HTMLDivElement | null>(null)
  const [toggleStickyH, setToggleStickyH] = useState(0)
  const [filterStickyH, setFilterStickyH] = useState(0)
  const [headerBandH, setHeaderBandH] = useState(40)

  const dockPins = useScrollDockPins(
    pageScrollParent ?? null,
    pageScrollMode,
    stickyFilterPrefix && pageScrollMode ? sentinelToggleEl : null,
    pageScrollMode ? sentinelFilterEl : null,
    pageScrollMode ? sentinelHeaderEl : null,
  )

  const dockFixedStyles = useMemo(() => {
    const dock = dockPins.dockRect
    const dockW = dockPins.dockClientWidth ?? dock?.width
    const pt = dockPins.pinToggle
    const pf = dockPins.pinFilter
    const ph = dockPins.pinHeader
    if (!pageScrollMode || !dock || dockW == null) {
      return {
        toggle: undefined as CSSProperties | undefined,
        filter: undefined as CSSProperties | undefined,
        header: undefined as CSSProperties | undefined,
      }
    }
    /** Keep fixed bands inside the viewport (never extend past the right edge on scroll/resize). */
    const width = Math.min(dockW, typeof window !== "undefined" ? Math.max(0, window.innerWidth - dock.left) : dockW)
    const base = { left: dock.left, width }
    return {
      toggle: pt ? { position: "fixed" as const, ...base, top: dock.top, zIndex: 60 } : undefined,
      filter: pf
        ? {
            position: "fixed" as const,
            ...base,
            top: dock.top + (pt ? toggleStickyH : 0),
            zIndex: 55,
          }
        : undefined,
      header: ph
        ? {
            position: "fixed" as const,
            ...base,
            top: dock.top + (pt ? toggleStickyH : 0) + (pf ? filterStickyH : 0),
            zIndex: 45,
          }
        : undefined,
    }
  }, [pageScrollMode, dockPins, toggleStickyH, filterStickyH])

  const updateTableScrollShadows = useCallback(() => {
    const horiz = tableScrollRef.current
    if (!horiz) {
      setShowTableRightFade(false)
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = horiz
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    setShowPinnedScrollShadow(maxScroll > 1 && scrollLeft > 1)
    setShowTableRightFade(maxScroll > 2 && scrollLeft < maxScroll - 2)
  }, [])

  const syncHorizScroll = useCallback((from: "header" | "body") => {
    const h = tableHeaderHorizRef.current
    const b = tableScrollRef.current
    if (!h || !b || horizSyncLock.current) return
    horizSyncLock.current = true
    if (from === "header") b.scrollLeft = h.scrollLeft
    else h.scrollLeft = b.scrollLeft
    queueMicrotask(() => {
      horizSyncLock.current = false
    })
  }, [])

  const fpAnchorYear = portfolioNow.getFullYear()

  useEffect(() => {
    if (!onOperatorBuiltinSliceChange || variant !== "operator") return
    onOperatorBuiltinSliceChange(builtinSlice)
  }, [variant, builtinSlice, onOperatorBuiltinSliceChange])

  useLayoutEffect(() => {
    if (!onOperatorViewIdChange || variant !== "operator") return
    onOperatorViewIdChange(selectedViewId)
  }, [variant, selectedViewId, onOperatorViewIdChange])

  const cols = useMemo(() => {
    const grantDef = COLUMNS.find((c) => c.key === "grant")!
    const tail = colOrder.filter((k) => visibleCols.has(k)).map((k) => COLUMNS.find((c) => c.key === k)!)
    if (visibleCols.has("grant")) return [grantDef, ...tail]
    return tail
  }, [visibleCols, colOrder])
  const gridTemplate = cols.map((c) => c.width).join(" ")

  const filteredBase = useMemo(() => {
    let list = grants.filter((g) => {
      if (filters.funderType && g.funderType !== filters.funderType) return false
      if (filters.owner && g.ownerId !== filters.owner) return false
      if (!grantDeadlineMatchesTimeRange(g.deadline, filters, portfolioNow, g.stage)) return false
      if (extraGrantFilter && !extraGrantFilter(g)) return false
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
  }, [grants, filters, builtinSlice, extraGrantFilter, portfolioNow])

  const afterBridge = useMemo(() => {
    if (!kpiBridgeFilter) return filteredBase
    return filteredBase.filter((g) => kpiBridgeFilter(g))
  }, [filteredBase, kpiBridgeFilter])

  const fpFiltered = useMemo(() => {
    if (!funderPortfolioLens) return afterBridge
    return applyFunderPortfolioKpiFilters(afterBridge, fpKpi, portfolioNow)
  }, [funderPortfolioLens, afterBridge, fpKpi, portfolioNow])

  useEffect(() => {
    onFilteredBaseChange?.(filteredBase)
  }, [filteredBase, onFilteredBaseChange])

  useEffect(() => {
    if (variant !== "operator" || !onViewLabelChange) return
    let label = operatorBuiltinAllLabel ?? "All active"
    const builtin = SAVED_VIEWS.find((v) => v.id === selectedViewId)
    if (builtin)
      label =
        builtin.id === "all" && operatorBuiltinAllLabel ? operatorBuiltinAllLabel : builtin.label
    else if (selectedViewId.startsWith("custom-")) {
      label = customViews.find((v) => v.id === selectedViewId)?.label ?? "Saved view"
    }
    onViewLabelChange(label)
  }, [variant, selectedViewId, customViews, onViewLabelChange, operatorBuiltinAllLabel])

  const sortedFiltered = useMemo(() => {
    if (funderPortfolioLens) return fpFiltered
    if (!sortKey) return afterBridge
    return [...afterBridge].sort((a, b) => compareGrantRows(a, b, sortKey, sortDir))
  }, [funderPortfolioLens, fpFiltered, afterBridge, sortKey, sortDir])

  useEffect(() => {
    const onScroll = () => updateTableScrollShadows()
    const bodyEl = tableScrollRef.current
    const headerEl = tableHeaderHorizRef.current
    bodyEl?.addEventListener("scroll", onScroll, { passive: true })
    headerEl?.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => {
      bodyEl?.removeEventListener("scroll", onScroll)
      headerEl?.removeEventListener("scroll", onScroll)
    }
  }, [pageScrollMode, updateTableScrollShadows, sortedFiltered])

  const filtersDirty = useMemo(() => {
    return (
      (filters.timeRangePreset ?? null) !== (filterBaseline.timeRangePreset ?? null) ||
      (filters.timeRangeCustomStart ?? null) !== (filterBaseline.timeRangeCustomStart ?? null) ||
      (filters.timeRangeCustomEnd ?? null) !== (filterBaseline.timeRangeCustomEnd ?? null) ||
      filters.funderType !== filterBaseline.funderType ||
      filters.owner !== filterBaseline.owner
    )
  }, [filters, filterBaseline])

  const columnsDirty = useMemo(
    () => variant === "operator" && isOperatorColumnLayoutDirty(visibleCols, colOrder, columnLayoutBaseline),
    [variant, visibleCols, colOrder, columnLayoutBaseline],
  )

  const fpKpiDirty = useMemo(() => {
    if (!funderPortfolioLens) return false
    return (
      fpKpi.topFundersOnly !== fpKpiBaseline.topFundersOnly ||
      fpKpi.multiYearOnly !== fpKpiBaseline.multiYearOnly
    )
  }, [funderPortfolioLens, fpKpi, fpKpiBaseline])

  const showSaveViewChip = variant === "operator" && (filtersDirty || fpKpiDirty || columnsDirty)

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
      else if (groupBy === "funder") key = g.funder.trim() || "(Unknown funder)"
      else if (groupBy === "deadline") key = deadlineMonthKey(g.deadline)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }
    let entries = Array.from(map.entries()).filter(([, items]) => items.length > 0)
    if (groupBy === "funder") {
      entries.sort(([, ga], [, gb]) => {
        const sa = ga.reduce((s, x) => s + awardedSumGrant(x), 0)
        const sb = gb.reduce((s, x) => s + awardedSumGrant(x), 0)
        return sb - sa
      })
      entries = entries.map(([key, items]) => [
        key,
        [...items].sort((a, b) => awardedSumGrant(b) - awardedSumGrant(a)),
      ]) as [string, Grant[]][]
    }
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

  const applyOperatorViewConfig = useCallback(
    (c: OperatorViewConfig) => {
      setGroupBy(c.groupBy)
      const nextVisible = new Set(c.visibleColKeys)
      const nextOrder = [...c.colOrder]
      setVisibleCols(nextVisible)
      setColOrder(nextOrder)
      setColumnLayoutBaseline(snapshotOperatorColumnLayout(nextVisible, nextOrder))
      const fpRaw = c.funderPortfolioKpi ?? DEFAULT_FUNDER_PORTFOLIO_KPI
      const fpNext: FunderPortfolioKpiState = {
        topFundersOnly: Boolean(fpRaw.topFundersOnly),
        multiYearOnly: Boolean(fpRaw.multiYearOnly),
      }
      setFpKpi(fpNext)
      setFpKpiBaseline({ ...fpNext })
      setFilters((prev) => {
        const merged = migrateToolbarTimeRangeFilters({ ...prev, ...c.filters })
        setFilterBaseline({ ...merged })
        return merged
      })
      onOperatorViewConfigApplied?.(c)
    },
    [onOperatorViewConfigApplied],
  )

  const activateOperatorViewFromMenu = useCallback(
    (id: string) => {
      setSelectedViewId(id)
      if (variant !== "operator") return
      if (id.startsWith("custom-")) {
        const cv = customViews.find((v) => v.id === id)
        if (cv) applyOperatorViewConfig(cv.config)
        return
      }
      if (id === "board-leadership") {
        applyBoardLeadershipPreset()
        return
      }
      if (id === "funder-portfolio") {
        applyFunderPortfolioPreset()
        return
      }
      resetOperatorTableDefaults()
      setFilters((prev) => {
        const next = applyViewFilters(id, prev)
        setFilterBaseline({ ...next })
        return next
      })
    },
    [variant, customViews, applyBoardLeadershipPreset, applyFunderPortfolioPreset, resetOperatorTableDefaults, applyOperatorViewConfig],
  )

  const forkIfCannedOperatorEdit = useCallback(() => {
    if (variant !== "operator") return
    // Avoid minting ephemeral "Working · …" rows — those duplicated built-ins (All active, Funder portfolio, etc.).
  }, [variant])

  const operatorUrlHydratedRef = useRef(false)
  useLayoutEffect(() => {
    if (variant !== "operator" || !pageScrollMode || operatorUrlHydratedRef.current) return
    const raw = searchParams.get("view")
    if (raw === null) {
      operatorUrlHydratedRef.current = true
      return
    }
    operatorUrlHydratedRef.current = true
    const v = resolveOperatorViewParam(raw)
    activateOperatorViewFromMenu(v)
  }, [variant, pageScrollMode, searchParams, activateOperatorViewFromMenu])

  const prevOperatorHomeResetKeyRef = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (variant !== "operator") return
    if (operatorHomeViewResetKey === undefined) return
    if (prevOperatorHomeResetKeyRef.current === operatorHomeViewResetKey) return
    prevOperatorHomeResetKeyRef.current = operatorHomeViewResetKey
    activateOperatorViewFromMenu("all")
  }, [variant, operatorHomeViewResetKey, activateOperatorViewFromMenu])

  useEffect(() => {
    if (variant !== "operator" || !pageScrollMode) return
    const params = new URLSearchParams(searchParams.toString())
    if (params.get("view") === selectedViewId) return
    params.set("view", selectedViewId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [variant, pageScrollMode, selectedViewId, pathname, router, searchParams])

  const footerGrantScope = useMemo(
    () => (funderPortfolioLens ? fpFiltered : afterBridge),
    [funderPortfolioLens, fpFiltered, afterBridge],
  )

  function handleSortColumn(key: ColKey) {
    if (funderPortfolioLens) return
    forkIfCannedOperatorEdit()
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
    forkIfCannedOperatorEdit()
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
    forkIfCannedOperatorEdit()
    setColOrder((order) => reorderColumns(order, from, to))
  }

  const setColumnVisibleApi = useCallback(
    (key: ColKey, visible: boolean) => {
      forkIfCannedOperatorEdit()
      const def = COLUMNS.find((c) => c.key === key)
      setVisibleCols((prev) => {
        const next = new Set(prev)
        if (visible) next.add(key)
        else {
          if (def?.locked) return prev
          next.delete(key)
        }
        return next
      })
    },
    [forkIfCannedOperatorEdit],
  )

  const moveColumnBeforeApi = useCallback(
    (moved: ColKey, before: ColKey) => {
      forkIfCannedOperatorEdit()
      setColOrder((order) => placeColumnBeforeKey(order, moved, before))
    },
    [forkIfCannedOperatorEdit],
  )

  const moveColumnAfterApi = useCallback(
    (moved: ColKey, after: ColKey | null) => {
      forkIfCannedOperatorEdit()
      setColOrder((order) => placeColumnAfter(order, moved, after))
    },
    [forkIfCannedOperatorEdit],
  )

  const commitSavedView = useCallback(
    (name: string, opts?: { silent?: boolean }) => {
      const trimmed = name.trim()
      if (!trimmed) return
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
        funderPortfolioKpi: baseSlice === "funder-portfolio" ? { ...fpKpi } : undefined,
        pipelineFourthMetric:
          baseSlice === "all" ? (operatorPipelineFourthMetric ?? "winrate") : undefined,
      }
      setCustomViews((prev) => [...prev, { id, label: trimmed, config }])
      setFilterBaseline({ ...config.filters })
      setFpKpiBaseline({ ...fpKpi })
      setColumnLayoutBaseline(snapshotOperatorColumnLayout(visibleCols, colOrder))
      if (!opts?.silent) {
        toast("View saved", {
          description: `“${trimmed}” is in the View menu — you’re still on the current view.`,
        })
      }
    },
    [selectedViewId, customViews, groupBy, visibleCols, colOrder, filters, fpKpi, operatorPipelineFourthMetric],
  )

  /** Operator: export (PDF/CSV) on pipeline “Where are we?” (`all`) plus Board & Funder built-ins. */
  const showOperatorExport =
    variant === "operator" && (boardAudience || funderPortfolioLens || selectedViewId === "all")

  const queueLensExport = useCallback(
    (format: "pdf" | "csv", opts?: { silent?: boolean }) => {
      let base: string
      const periodLabel = timeRangeExportSuffix(filters, portfolioNow)
      if (boardAudience) {
        base = `Board / Leadership · ${periodLabel}`
      } else if (funderPortfolioLens) {
        base = `Funder portfolio · ${periodLabel}`
      } else {
        const viewName = operatorBuiltinAllLabel ?? "All active"
        base = `${viewName} · ${periodLabel}`
      }

      const tableColumns = cols.map((c) => ({
        key: c.key,
        label:
          boardAudience && BOARD_COLUMN_HEADERS[c.key] ? BOARD_COLUMN_HEADERS[c.key]! : c.label,
      }))
      const filenameBase = base.replace(/\s*·\s*/g, "-")

      const sumAwardTotal = sortedFiltered.reduce((s, g) => s + g.award, 0)
      const sumWeightedTotal = sortedFiltered.reduce((s, g) => s + (g.weighted ?? 0), 0)
      const exportGroups =
        groupBy === "none"
          ? undefined
          : grouped.map((g) => ({
              title: formatGroupExportTitle(g.key, groupBy),
              items: g.items,
            }))
      const pdfMetrics = {
        groupedByLabel: groupBy === "none" ? undefined : GROUP_BY_EXPORT_LABEL[groupBy] ?? undefined,
        totalGrants: sortedFiltered.length,
        groupCount: groupBy === "none" ? undefined : grouped.length,
        sumAwardTotal,
        sumWeightedTotal,
      }

      try {
        if (format === "pdf") {
          const title = base.split(" · ")[0]?.trim() ?? "Grants export"
          const subtitle =
            (base.includes(" · ") ? base.split(" · ").slice(1).join(" · ") : "") +
            ` · ${sortedFiltered.length} grants`
          downloadGrantsPdfReport({
            grants: sortedFiltered,
            columns: tableColumns,
            title,
            subtitle,
            filenameBase,
            groups: exportGroups,
            metrics: pdfMetrics,
          })
          if (!opts?.silent) toast.success("PDF report downloaded", { description: `${base}` })
        } else {
          downloadGrantsCsvReport({
            grants: sortedFiltered,
            columns: tableColumns,
            filenameBase,
            groups: exportGroups,
            includeGroupColumn: groupBy !== "none",
          })
          if (!opts?.silent) toast.success("CSV downloaded", { description: `${base}` })
        }
      } catch (err) {
        console.error(err)
        toast.error("Export failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        })
      }
    },
    [
      boardAudience,
      funderPortfolioLens,
      filters,
      portfolioNow,
      operatorBuiltinAllLabel,
      cols,
      sortedFiltered,
      grouped,
      groupBy,
    ],
  )

  useEffect(() => {
    if (!onRegisterFilterApi) return
    const api: AllGrantsFilterApi = {
      setFilters: (patch) => {
        forkIfCannedOperatorEdit()
        setFilters((prev) => {
          const next: Record<string, string | null> = { ...prev }
          for (const [k, v] of Object.entries(patch)) {
            if (v !== undefined) next[k] = v
          }
          return next
        })
      },
      saveNamedView: (name, opts) => commitSavedView(name, opts),
      setGroupBy: (gb) => {
        forkIfCannedOperatorEdit()
        setGroupBy(gb)
      },
      setSort: (key, dir) => {
        forkIfCannedOperatorEdit()
        setSortKey(key)
        if (dir) setSortDir(dir)
      },
      clearToolbarFilters: () => {
        forkIfCannedOperatorEdit()
        setFilters((prev) => ({
          ...prev,
          ...defaultTimeRangeFilterPatch(),
          funderType: null,
          owner: null,
        }))
      },
      setColumnVisible: setColumnVisibleApi,
      moveColumnBefore: moveColumnBeforeApi,
      moveColumnAfter: moveColumnAfterApi,
      openSaveViewDialog: (opts) => {
        setSaveViewName(opts?.suggestedName ?? "")
        setSaveViewOpen(true)
      },
      exportLensReport: (format, opts) => queueLensExport(format, opts),
    }
    onRegisterFilterApi(api)
    return () => onRegisterFilterApi(null)
  }, [
    onRegisterFilterApi,
    commitSavedView,
    forkIfCannedOperatorEdit,
    setColumnVisibleApi,
    moveColumnBeforeApi,
    moveColumnAfterApi,
    queueLensExport,
  ])

  function handleSaveCustomView() {
    const trimmed = saveViewName.trim()
    if (!trimmed) return
    const chatAck = variant === "operator" && onOperatorSaveViewCommitted
    commitSavedView(trimmed, { silent: !!chatAck })
    if (chatAck) onOperatorSaveViewCommitted(trimmed)
    setSaveViewOpen(false)
    setSaveViewName("")
  }

  /** Funder portfolio KPI strip only for the built-in Instrumentl lens — not sample or user-saved views. */
  const funderPortfolioKpiInner =
    variant === "operator" && funderPortfolioLens && selectedViewId === "funder-portfolio" ? (
      <PulseStripFunderPortfolio
        grantsScoped={filteredBase}
        grantsFull={grantsData}
        anchorYear={fpAnchorYear}
        kpi={fpKpi}
        onKpiChange={(next) => {
          forkIfCannedOperatorEdit()
          setFpKpi(next)
        }}
        selectedFunderType={(filters.funderType as FunderType | null) ?? null}
        onFunderTypeChange={(ft) => {
          forkIfCannedOperatorEdit()
          setFilters((prev) => ({ ...prev, funderType: ft }))
        }}
      />
    ) : null

  /** Page scroll (Mixed-alt): same slot as Board / Bridge KPI strips — scrolls with the column. */
  const funderPortfolioKpiPageBetween =
    funderPortfolioKpiInner && pageScrollMode ? (
      <div className="w-full shrink-0 self-stretch px-2 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
        <div className="min-w-0 space-y-2">{funderPortfolioKpiInner}</div>
      </div>
    ) : null

  /** Non-page-scroll operator layout: KPI sits above the table scrollport. */
  const funderPortfolioKpiBelowToolbar =
    funderPortfolioKpiInner && !pageScrollMode ? (
      <div className="min-w-0 shrink-0 space-y-2 px-2 pb-3 pt-2 sm:px-4">
        {funderPortfolioKpiInner}
      </div>
    ) : null

  /** Inner row scrolls horizontally when needed; avoid `min-w-full` on pinned parents (uses viewport %). */
  const filterToolbarRow = (
    <div className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-thin">
      <div className="flex min-w-full w-max max-w-none flex-nowrap items-center gap-x-3">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">View</span>
          <Select
            value={selectedViewId}
            onValueChange={(id) => activateOperatorViewFromMenu(id)}
          >
            <SelectTrigger size="sm" className="h-7 w-[min(100%,11rem)] text-xs shadow-xs">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {viewPickerGroups.instrumentl.length > 0 ? (
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Instrumentl views
                  </SelectLabel>
                  {viewPickerGroups.instrumentl.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {variant === "operator" && operatorBuiltinAllLabel && v.id === "all"
                        ? operatorBuiltinAllLabel
                        : v.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {viewPickerGroups.instrumentl.length > 0 &&
              (viewPickerGroups.customPreset.length > 0 || (variant === "operator" && customViews.length > 0)) ? (
                <SelectSeparator />
              ) : null}
              {viewPickerGroups.customPreset.length > 0 || (variant === "operator" && customViews.length > 0) ? (
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {variant === "operator" ? "Custom & saved views" : "Custom views"}
                  </SelectLabel>
                  {viewPickerGroups.customPreset.map((v) => (
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
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
          {showSaveViewChip && (
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

          <TimeRangeFilterChip
            filters={filters}
            now={portfolioNow}
            onPatch={(patch) => {
              forkIfCannedOperatorEdit()
              setFilters((prev) => ({ ...prev, ...patch }))
            }}
          />
          <FilterChip
            label="Funder type"
            value={filters.funderType}
            options={["Federal", "Private", "Corporate", "State", "Local"]}
            onChange={(v) => {
              forkIfCannedOperatorEdit()
              setFilters({ ...filters, funderType: v })
            }}
          />
          <FilterChip
            label="Owner"
            value={filters.owner ? team.find((t) => t.id === filters.owner)?.name || filters.owner : null}
            options={team.map((t) => t.name)}
            onChange={(v) => {
              forkIfCannedOperatorEdit()
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

          <GroupByPicker
            value={groupBy}
            onChange={(v) => {
              forkIfCannedOperatorEdit()
              setGroupBy(v)
            }}
          />
        </div>

        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
        {showOperatorExport ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2.5 text-[11px] font-medium shadow-xs"
              >
                <Download className="h-3 w-3 shrink-0" aria-hidden />
                Export
                <ChevronDown className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12.5rem]">
              <DropdownMenuItem className="text-xs font-medium" onSelect={() => queueLensExport("pdf")}>
                Export as PDF report
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-medium" onSelect={() => queueLensExport("csv")}>
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <ColumnPicker visible={visibleCols} onToggle={toggleColumn} />
        {showToolbarNewGrant ? (
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" />
            New grant
          </button>
        ) : null}
      </div>
      </div>
    </div>
  )

  const bulkBar =
    selected.size > 0 ? (
      <div
        className={cn(
          "flex items-center gap-3 border-b border-border bg-primary/5 py-2",
          variant === "operator" ? "px-3" : "px-6",
        )}
      >
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
    ) : null

  useLayoutEffect(() => {
    if (!pageScrollMode || !stickyFilterPrefix) {
      setToggleStickyH(0)
      return
    }
    const el = toggleStickyMeasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setToggleStickyH(el.getBoundingClientRect().height))
    ro.observe(el)
    setToggleStickyH(el.getBoundingClientRect().height)
    return () => ro.disconnect()
  }, [pageScrollMode, stickyFilterPrefix, selected.size])

  useLayoutEffect(() => {
    if (!pageScrollMode) {
      setFilterStickyH(0)
      return
    }
    const el = filterStickyMeasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFilterStickyH(el.getBoundingClientRect().height))
    ro.observe(el)
    setFilterStickyH(el.getBoundingClientRect().height)
    return () => ro.disconnect()
  }, [pageScrollMode, funderPortfolioLens])

  useLayoutEffect(() => {
    if (!pageScrollMode) {
      setHeaderBandH(40)
      return
    }
    const el = headerRailWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderBandH(Math.max(36, Math.ceil(el.getBoundingClientRect().height))))
    ro.observe(el)
    setHeaderBandH(Math.max(36, Math.ceil(el.getBoundingClientRect().height)))
    return () => ro.disconnect()
  }, [pageScrollMode, cols, gridTemplate, sortedFiltered.length, dockPins.pinHeader, funderPortfolioLens])

  const columnHeaderRow = (pageStickyBands?: { topPx?: number; stuck: boolean; railMount?: boolean }) => {
    return (
    <div
      className={cn(
        "grid w-max items-stretch",
        pageStickyBands
          ?         pageStickyBands.railMount
            ? cn(
                "min-w-full w-max shrink-0 self-start border-b-0",
                variant === "operator" && "border-t-0 bg-transparent dark:bg-transparent",
              )
            : cn(
                "sticky z-[45] min-w-full w-max shrink-0 self-start transition-[background-color,border-color]",
                pageStickyBands.stuck
                  ? "border-b border-border bg-background/95 backdrop-blur-sm dark:bg-background/95"
                  : "border-b border-transparent bg-transparent dark:bg-transparent",
              )
          : cn(
              "z-40 border-b border-border",
              variant === "operator" && "border-t-0",
              variant === "operator" ? "bg-transparent dark:bg-card/40" : "bg-muted",
            ),
      )}
      style={{
        gridTemplateColumns: `40px ${gridTemplate}`,
        ...(pageStickyBands && !pageStickyBands.railMount ? { top: pageStickyBands.topPx } : {}),
      }}
    >
      <div
        className={cn(
          "sticky left-0 flex min-h-[36px] items-center px-3",
          variant === "operator"
            ? cn(
                "border-r-0",
                pageStickyBands
                  ? pageStickyBands.stuck
                    ? "bg-background/95 dark:bg-background/95"
                    : "bg-background dark:bg-background"
                  : "bg-background dark:bg-background",
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
          headerLabel={boardAudience ? BOARD_COLUMN_HEADERS[c.key] : undefined}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSortColumn}
          onReorder={handleReorderColumns}
          draggingCol={draggingCol}
          onDraggingChange={setDraggingCol}
          variant={variant}
          showPinnedScrollShadow={variant === "operator" && showPinnedScrollShadow}
          pinnedTone={
            pageStickyBands ? (pageStickyBands.stuck ? "solid" : "clear") : "default"
          }
          funderPortfolioLens={funderPortfolioLens}
        />
      ))}
    </div>
    )
  }

  const grantsTableBodyContent = (
    <>
      {grouped.map((group) => {
        const collapsed = collapsedGroups.has(group.key)
        const sumAward = group.items.reduce((s, g) => s + g.award, 0)
        const sumWeighted = group.items.reduce((s, g) => s + (g.weighted ?? 0), 0)
        const sumPortfolioAwarded = group.items.reduce((s, g) => s + awardedSumGrant(g), 0)
        return (
          <div key={group.key}>
            {groupBy !== "none" &&
              (funderPortfolioLens && groupBy === "funder" ? (
                <FunderPortfolioGroupHeader
                  groupKey={group.key}
                  items={group.items}
                  collapsed={collapsed}
                  onToggle={() => toggleGroup(group.key)}
                  sumAward={sumAward}
                  sumPortfolioAwarded={sumPortfolioAwarded}
                  sumWeighted={sumWeighted}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="group/grprow z-30 flex w-max min-w-full flex-nowrap items-center gap-2 border-b border-border bg-zinc-50 px-0 py-0 text-left hover:bg-zinc-100 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/45"
                >
                  <span className="sticky left-[40px] z-[25] ml-[40px] flex shrink-0 items-center gap-2 bg-zinc-50 px-3 py-1.5 group-hover/grprow:bg-zinc-100 dark:bg-zinc-900/30 dark:group-hover/grprow:bg-zinc-900/45">
                    {collapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {groupBy === "stage" && <StagePill stage={group.key as Stage} audience={boardAudience ? "board" : "internal"} />}
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
              ))}
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
                  boardAudience={boardAudience}
                  showPinnedScrollShadow={variant === "operator" && showPinnedScrollShadow}
                />
              ))}
          </div>
        )
      })}

      {sortedFiltered.length === 0 && (
        <div className="flex min-w-full flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No grants match your filters</p>
          <p className="text-xs text-muted-foreground">Try clearing filters or changing the view.</p>
        </div>
      )}
    </>
  )

  return (
    <div
      className={cn(
        pageScrollMode ? "flex min-w-0 w-full flex-col" : "flex min-h-0 min-w-0 shrink-0 flex-col flex-1",
      )}
    >
      <div
        className={cn(
          pageScrollMode ? "flex min-w-0 w-full flex-col" : "flex min-h-0 min-w-0 shrink-0 flex-col flex-1",
          variant === "operator" &&
            cn(
              !pageScrollMode && "rounded-[12px] bg-transparent dark:bg-card/40",
              !pageScrollMode && "overflow-hidden",
              !flatChrome && !pageScrollMode && "border border-elevated-stroke shadow-sm",
            ),
        )}
      >
      {!pageScrollMode && (
        <>
          <div
            className={cn(
              "mb-1 py-2",
              variant === "operator"
                ? "border-b-0 bg-transparent px-3 dark:bg-card/40"
                : "border-b border-border bg-background px-6",
            )}
          >
            {filterToolbarRow}
          </div>
          {funderPortfolioKpiBelowToolbar}
          {bulkBar}
        </>
      )}

      {/* Scrollport: page scroll ancestor when pageScrollMode; horizontal scroll only on table */}
      <div className={cn("min-w-0", pageScrollMode ? "flex w-full flex-col" : "relative min-h-0 flex-1")}>
        {pageScrollMode ? (
          <>
            <div className="flex min-w-0 w-full shrink-0 flex-col self-start bg-transparent">
              {stickyFilterPrefix ? (
                <>
                  <div
                    ref={setSentinelToggleEl}
                    className="pointer-events-none h-px max-w-none min-w-full shrink-0 self-start"
                    aria-hidden
                  />
                  {dockPins.pinToggle && toggleStickyH > 0 ? (
                    <div style={{ height: toggleStickyH }} className="shrink-0" aria-hidden />
                  ) : null}
                  <div
                    ref={toggleStickyMeasRef}
                    className={cn(
                      // Pinned bands use position:fixed; avoid min-width % (would use viewport vs dock width).
                      "box-border min-w-0 w-full shrink-0 self-start px-3 py-2.5 transition-[background-color,backdrop-filter,border-color]",
                      dockPins.pinToggle && "overflow-x-hidden",
                      dockPins.pinToggle
                        ? "border-b border-border/60 bg-background/95 backdrop-blur-sm dark:bg-background/95"
                        : "border-b border-transparent bg-transparent dark:bg-transparent",
                    )}
                    style={dockFixedStyles.toggle}
                  >
                    {stickyFilterPrefix}
                  </div>
                </>
              ) : null}
              <div
                ref={setSentinelFilterEl}
                className="pointer-events-none h-px max-w-none min-w-full shrink-0 self-start"
                aria-hidden
              />
              {dockPins.pinFilter && filterStickyH > 0 ? (
                <div style={{ height: filterStickyH }} className="shrink-0" aria-hidden />
              ) : null}
              <div
                ref={filterStickyMeasRef}
                className={cn(
                  "box-border min-w-0 w-full shrink-0 self-start transition-[background-color,backdrop-filter,border-color]",
                  dockPins.pinFilter && "overflow-x-hidden",
                  dockPins.pinFilter
                    ? "border-b border-border/60 bg-background/95 backdrop-blur-sm dark:bg-background/95"
                    : "border-b border-transparent bg-transparent dark:bg-transparent",
                )}
                style={dockFixedStyles.filter}
              >
                <div className="flex min-w-0 w-full max-w-full flex-col gap-1">
                  <div
                    className={cn(
                      "w-full min-w-0 max-w-full py-2",
                      variant === "operator" ? "px-3" : "border-b border-border bg-background px-6",
                    )}
                  >
                    {filterToolbarRow}
                  </div>
                {filterToolbarAccessory ? (
                  <div className="min-w-0 shrink-0 px-3 pb-1">{filterToolbarAccessory}</div>
                ) : null}
                </div>
              </div>
            </div>
            {funderPortfolioKpiPageBetween}
            {pageScrollBetweenFiltersAndTable ? (
              <div className="w-full shrink-0 self-start">{pageScrollBetweenFiltersAndTable}</div>
            ) : null}
            {bulkBar}
            <div ref={setSentinelHeaderEl} className="pointer-events-none h-px w-full shrink-0" aria-hidden />
            {dockPins.pinHeader && headerBandH > 0 ? (
              <div style={{ height: headerBandH }} className="shrink-0" aria-hidden />
            ) : null}
            <div className="relative min-w-0 w-full">
              <div
                ref={headerRailWrapRef}
                className={cn(
                  "box-border min-w-0 w-full shrink-0 self-start border-b border-border/60 transition-[background-color,backdrop-filter]",
                  variant === "operator" && "relative",
                  funderPortfolioLens && "border-t-0",
                  dockPins.pinHeader && "overflow-x-hidden",
                  dockPins.pinHeader
                    ? "bg-background/95 backdrop-blur-sm dark:bg-background/95"
                    : "bg-transparent dark:bg-transparent",
                )}
                style={dockFixedStyles.header}
              >
                <div
                  ref={tableHeaderHorizRef}
                  onScroll={() => syncHorizScroll("header")}
                  className="shadow-bleed-scroll box-border min-w-0 w-full overflow-x-auto overscroll-x-contain"
                >
                  <div className="flex min-w-full w-max flex-col">
                    {columnHeaderRow({ stuck: dockPins.pinHeader, railMount: true })}
                  </div>
                </div>
                {variant === "operator" && showTableRightFade && dockPins.pinHeader ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 z-[50] w-28 bg-gradient-to-l from-white from-30% via-white/55 to-transparent dark:from-background dark:via-background/55"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div
                ref={tableScrollRef}
                onScroll={() => syncHorizScroll("body")}
                className="shadow-bleed-scroll box-border min-w-0 w-full max-w-none shrink-0 self-start overflow-x-auto overscroll-x-contain"
              >
                <div className="flex min-w-full w-max flex-col">{grantsTableBodyContent}</div>
              </div>
              {variant === "operator" && showTableRightFade ? (
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 z-[35] w-28 bg-gradient-to-l from-white from-30% via-white/55 to-transparent dark:from-background dark:via-background/55"
                  aria-hidden
                />
              ) : null}
            </div>
          </>
        ) : (
          <div
            ref={tableScrollRef}
            className={cn("shadow-bleed-scroll h-full min-h-0 min-w-0 w-full overflow-auto overscroll-contain")}
          >
            <div className="flex w-max flex-col">
              {columnHeaderRow()}
              {grantsTableBodyContent}
            </div>
          </div>
        )}
        {variant === "operator" && !pageScrollMode && showTableRightFade ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[35] w-28 bg-gradient-to-l from-white from-30% via-white/55 to-transparent dark:from-background dark:via-background/55"
            aria-hidden
          />
        ) : null}
      </div>

      {/* Footer — grant count + totals */}
      <div
        className={cn(
          "flex items-center justify-between border-t border-border px-6 py-2 text-[11px] text-muted-foreground",
          pageScrollMode && "w-full min-w-0 shrink-0 self-stretch border-t-0",
          variant === "operator" ? "bg-transparent dark:bg-card/40" : "bg-background",
        )}
      >
        <span className="tabular-nums">
          Showing {sortedFiltered.length} of {grants.length} grants
        </span>
        <span className="tabular-nums">
          $
          {(sortedFiltered.reduce((s: number, g: Grant) => s + g.award, 0) / 1_000_000).toFixed(2)}M unweighted ·{" "}
          $
          {(sortedFiltered.reduce((s: number, g: Grant) => s + (g.weighted ?? 0), 0) / 1_000_000).toFixed(2)}M weighted
        </span>
      </div>

      </div>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Saves filters, grouping, columns, and sort. Pick it from the View menu when you need it.
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
          <DialogFooter className="gap-3">
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

/**
 * Same “merged strip” affordance as **Group by Stage** (`group/grprow` row): checkbox rail is visually open,
 * one sticky band for label, trailing cluster for rollup numbers (no visible column gutters).
 */
function FunderPortfolioGroupHeader({
  groupKey,
  items,
  collapsed,
  onToggle,
  sumAward,
  sumPortfolioAwarded,
  sumWeighted,
}: {
  groupKey: string
  items: Grant[]
  collapsed: boolean
  onToggle: () => void
  sumAward: number
  sumPortfolioAwarded: number
  sumWeighted: number
}) {
  const lastActivity = pickLastActivityDisplay(items)

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="group/grprow z-30 flex w-max min-w-full flex-nowrap items-center gap-2 border-b border-border bg-zinc-50 px-0 py-0 text-left hover:bg-zinc-100 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/45"
    >
      <span className="sticky left-[40px] z-[25] ml-[40px] flex shrink-0 items-center gap-2 bg-zinc-50 px-3 py-1.5 group-hover/grprow:bg-zinc-100 dark:bg-zinc-900/30 dark:group-hover/grprow:bg-zinc-900/45">
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="text-xs font-semibold text-foreground">{groupKey}</span>
      </span>
      <span className="ml-auto flex min-w-0 shrink-0 items-center gap-3 px-3 py-1.5 text-[11px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">{fmtBoard$(sumPortfolioAwarded)} total awarded</span>
        <span>${(sumAward / 1000).toFixed(0)}K pipeline</span>
        {sumWeighted > 0 ? <span>${(sumWeighted / 1000).toFixed(0)}K weighted</span> : null}
        <span className="min-w-0 max-w-[12rem] shrink truncate" title={lastActivity}>
          {lastActivity}
        </span>
      </span>
    </button>
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
  boardAudience = false,
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
  boardAudience?: boolean
  /** Checkbox + pinned grant column: soft right shadow when scrolled horizontally (operator). */
  showPinnedScrollShadow?: boolean
}) {
  const op = variant === "operator"
  const baseCell =
    !isSelected
      ? op
        ? "bg-background hover:bg-muted/45 dark:bg-background dark:hover:bg-muted/35"
        : "bg-card dark:bg-card group-hover:bg-muted dark:group-hover:bg-muted"
      : ""
  const grantColShell = cn(
    "sticky left-[40px] flex min-h-full w-full min-w-[320px] max-w-[320px] flex-col border-r border-border/60",
    op && showPinnedScrollShadow
      ? "z-[33] shadow-[3px_0_10px_-2px_rgba(0,0,0,0.07)] dark:shadow-[3px_0_10px_-2px_rgba(0,0,0,0.2)]"
      : "z-[28]",
    isSelected && "bg-violet-100 dark:bg-violet-950",
    !isSelected && baseCell,
  )

  return (
    <div
      onClick={onOpen}
      className={cn(
        "group grid w-max cursor-pointer items-stretch border-b border-border/60 transition-colors",
        isSelected && "bg-violet-100 dark:bg-violet-950",
        !isSelected &&
          (op
            ? "bg-background hover:bg-muted/45 dark:bg-background dark:hover:bg-muted/35"
            : "bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"),
      )}
      style={{ gridTemplateColumns: `40px ${gridTemplate}` }}
    >
      <div
        className={cn(
          "sticky left-0 z-[32] flex items-center px-3 py-2.5",
          op && showPinnedScrollShadow && "z-[33] shadow-[3px_0_10px_-2px_rgba(0,0,0,0.07)] dark:shadow-[3px_0_10px_-2px_rgba(0,0,0,0.2)]",
          op && !showPinnedScrollShadow && "shadow-none",
          op ? "border-r-0" : "border-r border-border/60",
          isSelected && "bg-violet-100 dark:bg-violet-950",
          !isSelected && baseCell,
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
            boardAudience={boardAudience}
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
  boardAudience,
  onUpdate,
  stopPropagation,
}: {
  col: ColDef
  grant: Grant
  boardAudience?: boolean
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
              <div className="truncate font-medium text-foreground">{grantDisplayTitle(grant)}</div>
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
            renderValue={() => (
              <StagePill stage={grant.stage} audience={boardAudience ? "board" : "internal"} className="max-w-full" />
            )}
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
    case "amountRequested": {
      const w = grant.weighted ?? 0
      return (
        <div className={[wrap, "text-right tabular-nums text-foreground"].join(" ")}>
          {w > 0 ? `$${(w / 1000).toFixed(0)}K` : "—"}
        </div>
      )
    }
    case "notificationDate":
      return <div className={[wrap, "text-muted-foreground"].join(" ")}>{grant.lastUpdated}</div>
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
    case "fpFunder":
      return (
        <div className={wrap}>
          <span className="truncate text-foreground">{grant.funder}</span>
        </div>
      )
    case "fpFunderType":
      return <div className={wrap + " text-muted-foreground"}>{grant.funderType}</div>
    case "fpTotalAwarded":
      return (
        <div className={[wrap, "text-right tabular-nums text-foreground font-medium"].join(" ")}>
          {fmtBoard$(awardedSumGrant(grant))}
        </div>
      )
    case "fpLastActivity":
      return <div className={wrap + " text-muted-foreground"}>{grant.lastUpdated}</div>
    case "fpRenewalStatus":
      return (
        <div className={wrap + " text-muted-foreground"}>{renewalStatusForGrant(grant, new Date())}</div>
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
  headerLabel,
  sortKey,
  sortDir,
  onSort,
  onReorder,
  draggingCol,
  onDraggingChange,
  variant = "default",
  showPinnedScrollShadow = false,
  pinnedTone = "default",
  funderPortfolioLens = false,
}: {
  col: ColDef
  /** Overrides canonical column label (e.g. Board / Leadership template). */
  headerLabel?: string
  sortKey: ColKey | null
  sortDir: SortDir
  onSort: (key: ColKey) => void
  onReorder: (from: ColKey, to: ColKey) => void
  draggingCol: ColKey | null
  onDraggingChange: (key: ColKey | null) => void
  variant?: "default" | "operator"
  showPinnedScrollShadow?: boolean
  /** Operator pinned grant column header background: default = subtle glass; solid/clear used for mixed sticky header. */
  pinnedTone?: "default" | "clear" | "solid"
  /** Funder portfolio: column sort is fixed by funder rollup — fp columns show static headers. */
  funderPortfolioLens?: boolean
}) {
  const active = sortKey === col.key
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
  const isGrant = col.key === "grant"
  const columnTitle = headerLabel ?? col.label
  const rightAlign =
    col.key === "award" ||
    col.key === "deadline" ||
    col.key === "amountRequested" ||
    col.key === "notificationDate" ||
    col.key === "fpTotalAwarded"
  const funderPortfolioFrozenCol = funderPortfolioLens && col.key.startsWith("fp")
  const op = variant === "operator"
  const opGrantHeaderBg = "bg-background dark:bg-background"

  const frozenPortfolioHeader = (
    <div
      className={cn(
        "flex min-h-[36px] w-full min-w-0 items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide",
        rightAlign && "justify-end text-right",
        col.key === "fpTotalAwarded" ? "text-foreground" : "text-muted-foreground",
      )}
      aria-sort={col.key === "fpTotalAwarded" ? "descending" : undefined}
    >
      <span className="min-w-0 truncate">{columnTitle}</span>
      {col.key === "fpTotalAwarded" ? (
        <ArrowDown className="h-3 w-3 shrink-0 opacity-70 text-foreground" aria-hidden />
      ) : null}
    </div>
  )

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
      <span className="min-w-0 truncate">{columnTitle}</span>
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
                opGrantHeaderBg,
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
        aria-label={`Reorder ${columnTitle} column`}
        title="Drag to reorder column"
      >
        <GripVertical className="h-3.5 w-3.5 opacity-70" />
      </button>
      {funderPortfolioFrozenCol ? frozenPortfolioHeader : sortLabelButton}
    </div>
  )
}

function TimeRangeFilterChip({
  filters,
  now,
  onPatch,
}: {
  filters: Record<string, string | null>
  now: Date
  onPatch: (patch: Record<string, string | null>) => void
}) {
  const preset = filters.timeRangePreset ?? "ytd"
  const isDefaultYtd = preset === "ytd"

  const displayValue =
    preset === "custom" && filters.timeRangeCustomStart && filters.timeRangeCustomEnd
      ? `${filters.timeRangeCustomStart} – ${filters.timeRangeCustomEnd}`
      : timeRangeMenuLabel(preset)

  const selectPreset = (id: TimeRangePresetId) => {
    if (id === "custom") {
      const end = startOfDay(now)
      const start = subDays(end, 30)
      onPatch({
        timeRangePreset: "custom",
        timeRangeCustomStart: format(start, "yyyy-MM-dd"),
        timeRangeCustomEnd: format(end, "yyyy-MM-dd"),
      })
    } else {
      onPatch({
        timeRangePreset: id,
        timeRangeCustomStart: null,
        timeRangeCustomEnd: null,
      })
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[11px]",
            !isDefaultYtd
              ? "border-primary/25 bg-primary/5 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Filter className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="shrink-0 font-medium text-muted-foreground">Period</span>
          <>
            <span className="text-muted-foreground/60">:</span>
            <span className="max-w-[11rem] shrink truncate font-semibold text-primary">{displayValue}</span>
          </>
          {!isDefaultYtd ? (
            <span
              role="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onPatch({ ...defaultTimeRangeFilterPatch() })
              }}
              className="ml-0.5 rounded p-0.5 hover:bg-primary/10"
              aria-label="Reset to this year (YTD)"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,17rem)] p-2">
        <div className="space-y-0.5">
          {TIME_RANGE_MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectPreset(item.id)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              {item.label}
              {preset === item.id ? <span className="text-primary">✓</span> : null}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
            <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Start
            </label>
            <input
              type="date"
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              value={filters.timeRangeCustomStart ?? ""}
              onChange={(e) =>
                onPatch({
                  timeRangePreset: "custom",
                  timeRangeCustomStart: e.target.value || null,
                })
              }
            />
            <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              End
            </label>
            <input
              type="date"
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              value={filters.timeRangeCustomEnd ?? ""}
              onChange={(e) =>
                onPatch({
                  timeRangePreset: "custom",
                  timeRangeCustomEnd: e.target.value || null,
                })
              }
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
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
    { id: "funder", label: "Funder" },
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
        <button className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted">
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
