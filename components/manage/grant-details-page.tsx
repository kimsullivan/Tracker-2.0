"use client"

import {
  Fragment,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  KpiChartMotionProvider,
  KPI_CHART_ANIMATION_DURATION_MS,
  KPI_CHART_ANIMATION_EASING,
  KPI_CHART_FONT,
  useKpiChartMotion,
} from "@/components/manage/all-grants-kpi-tiles"
import {
  type AppCycle,
  type AppCycleFilter,
  type AppCycleRow,
  type AppDocKind,
  type AppSubmissionStatus,
  type DeadlineUrgency,
  type FlatApplicationRow,
  deadlineRelativeLabel as appDeadlineRelativeLabel,
  deadlineUrgency,
  flattenApplications,
  patchAppCycleRow,
} from "@/lib/manage/application-cycles"
import {
  UploadApplicationDialog,
  useApplicationCyclesForGrant,
} from "@/components/manage/application-cycles-demo-context"
import { grants, stageOrder, team } from "@/lib/manage/data"
import {
  deadlineRelativeLabel,
  formatPortfolioDeadline,
  grantDisplayTitle,
  resolvedIneligibility,
  resolvedIrs990Snapshot,
  resolvedOpportunityComplianceEtc,
  resolvedProgramSummary,
  resolvedProjectLocation,
  resolvedResidencyLocation,
} from "@/lib/manage/grant-context"
import type { Grant, IssueNavigationContext, ProjectGroup, Stage, TeamMember } from "@/lib/manage/types"
import { StagePill } from "@/components/manage/status-pill"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  AtSign,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  CopyPlus,
  Calendar,
  DollarSign,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  MapPin,
  BarChart3,
  MoreHorizontal,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react"

type MainTab = "overview" | "applications" | "financials" | "opportunity" | "documents"
type OppTab = "overview" | "funder" | "details"

type GrantLifecycleBucket = "prospecting" | "active" | "terminal"

function grantLifecycleBucket(stage: Stage): GrantLifecycleBucket {
  if (stage === "Awarded - Active") return "active"
  if (stage === "Closed" || stage === "Declined") return "terminal"
  return "prospecting"
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function MemberAvatar({ member, className }: { member: TeamMember; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: member.color }}
    >
      {member.initials}
    </span>
  )
}

/** Ghost: same language as shadcn + CSS variables (primary / muted / accent), not a separate twilight/silver stack. */
const ghostActionSurface =
  "bg-transparent text-primary hover:bg-muted hover:text-foreground " +
  "dark:bg-transparent dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"

/** Grant page actions: compact `text-xs`, regular weight — overrides shadcn `Button` default `text-sm` / `font-medium`. */
function FlatButton({ className, variant, ...props }: ComponentProps<typeof Button>) {
  const v = variant ?? "default"
  const hoverFlat =
    v === "ghost"
      ? ghostActionSurface
      : v === "destructive"
        ? "hover:!bg-destructive dark:hover:!bg-destructive"
        : v === "default"
          ? "hover:!bg-primary dark:hover:!bg-primary"
          : "hover:!bg-muted hover:!text-foreground dark:hover:!bg-accent dark:hover:!text-accent-foreground"
  return (
    <Button
      {...props}
      variant={variant}
      className={cn(
        "font-sans text-xs leading-normal !font-normal shadow-none",
        hoverFlat,
        className,
      )}
    />
  )
}

type ThreadAuthor = { name: string; initials: string; color: string; memberId?: string }

type TaskThreadEntry = { id: string; at: string; body: string; author: ThreadAuthor }

type BudgetLine = {
  id: string
  name: string
  cadence: string
  budgeted: number
  spent: number
  remaining: number
  util: number
  utilOver?: boolean
  site: string
}

type BudgetCategory = { key: string; label: string; lines: BudgetLine[] }

function authorFromMember(m: TeamMember): ThreadAuthor {
  return { name: m.name, initials: m.initials, color: m.color, memberId: m.id }
}

const BUDGET_CATEGORIES: BudgetCategory[] = [
  {
    key: "personnel",
    label: "Personnel",
    lines: [
      {
        id: "l-swc",
        name: "Senior Workforce Coordinator",
        cadence: "monthly",
        budgeted: 142000,
        spent: 59200,
        remaining: 82800,
        util: 42,
        site: "Springfield",
      },
      {
        id: "l-ps",
        name: "Program Specialists (2 FTE)",
        cadence: "monthly",
        budgeted: 138000,
        spent: 59300,
        remaining: 78700,
        util: 43,
        site: "Springfield",
      },
      {
        id: "l-hc",
        name: "Hartford site coordinator",
        cadence: "monthly",
        budgeted: 48000,
        spent: 22400,
        remaining: 25600,
        util: 88,
        utilOver: true,
        site: "Hartford",
      },
    ],
  },
  {
    key: "indirect",
    label: "Indirect (12.5%)",
    lines: [
      {
        id: "l-ind",
        name: "Indirect pool",
        cadence: "auto",
        budgeted: 60937,
        spent: 23031,
        remaining: 37906,
        util: 38,
        site: "All sites",
      },
    ],
  },
  {
    key: "equipment",
    label: "Equipment & technology",
    lines: [
      {
        id: "l-lap",
        name: "Laptops (8 units)",
        cadence: "Oct 2025",
        budgeted: 24000,
        spent: 11800,
        remaining: 12200,
        util: 49,
        site: "Springfield",
      },
      {
        id: "l-sf",
        name: "Software licenses",
        cadence: "annual",
        budgeted: 18000,
        spent: 3000,
        remaining: 15000,
        util: 17,
        site: "All sites",
      },
      {
        id: "l-tr",
        name: "Training equipment",
        cadence: "as needed",
        budgeted: 10000,
        spent: 0,
        remaining: 10000,
        util: 0,
        utilOver: true,
        site: "Hartford",
      },
    ],
  },
  {
    key: "travel",
    label: "Travel & convening",
    lines: [
      {
        id: "l-tv",
        name: "Convening & site travel",
        cadence: "quarterly",
        budgeted: 18500,
        spent: 3200,
        remaining: 15300,
        util: 17,
        site: "All sites",
      },
    ],
  },
  {
    key: "evaluation",
    label: "Evaluation",
    lines: [
      {
        id: "l-ev",
        name: "External evaluator",
        cadence: "milestones",
        budgeted: 28063,
        spent: 2319,
        remaining: 25744,
        util: 8,
        utilOver: true,
        site: "All sites",
      },
    ],
  },
]

type DocItem = { id: string; name: string; ext: string; size: string; modified: string; sharedWith?: number }
type DocFolder = { id: string; name: string; description: string; files: DocItem[] }

const DOC_FOLDERS: DocFolder[] = [
  {
    id: "agreements",
    name: "Agreements",
    description: "Signed legal documents",
    files: [
      { id: "f-agree-1", name: "Grant Agreement.pdf", ext: "PDF", size: "2.4 MB", modified: "Sep 1, 2025", sharedWith: 4 },
      { id: "f-agree-2", name: "Award letter — Cohort 3.pdf", ext: "PDF", size: "220 KB", modified: "Aug 15, 2025", sharedWith: 3 },
    ],
  },
  {
    id: "application",
    name: "Application",
    description: "Submitted + draft proposals",
    files: [
      { id: "f-app-1", name: "RFP — Workforce Capacity 2025.pdf", ext: "PDF", size: "800 KB", modified: "Mar 1", sharedWith: 6 },
      { id: "f-app-2", name: "Full Proposal Draft v3.docx", ext: "DOC", size: "142 KB", modified: "14 min ago", sharedWith: 3 },
      { id: "f-app-3", name: "Letter of Intent.pdf", ext: "PDF", size: "110 KB", modified: "Feb 18", sharedWith: 4 },
    ],
  },
  {
    id: "financials",
    name: "Financials",
    description: "Budgets + drawdown receipts",
    files: [
      { id: "f-fin-1", name: "Budget — parsed lines.xlsx", ext: "XLS", size: "28 KB", modified: "Apr 28", sharedWith: 5 },
      { id: "f-fin-2", name: "Q1 Drawdown Receipt.pdf", ext: "PDF", size: "60 KB", modified: "Feb 15", sharedWith: 2 },
      { id: "f-fin-3", name: "Indirect rate agreement.pdf", ext: "PDF", size: "188 KB", modified: "Sep 4, 2025", sharedWith: 2 },
    ],
  },
  {
    id: "deliverables",
    name: "Deliverables",
    description: "Models + dashboards",
    files: [
      { id: "f-del-1", name: "Logic Model v2.pdf", ext: "PDF", size: "480 KB", modified: "Apr 12", sharedWith: 4 },
      { id: "f-del-2", name: "Outcomes dashboard export.xlsx", ext: "XLS", size: "96 KB", modified: "Apr 22", sharedWith: 3 },
    ],
  },
  {
    id: "reports",
    name: "Reports",
    description: "Progress and final reports",
    files: [
      { id: "f-rep-1", name: "Mid-year report draft.docx", ext: "DOC", size: "220 KB", modified: "May 7", sharedWith: 3 },
      { id: "f-rep-2", name: "Q1 progress summary.pdf", ext: "PDF", size: "145 KB", modified: "Mar 30", sharedWith: 4 },
    ],
  },
]

const DOC_EXT_COLOR: Record<string, string> = {
  PDF: "bg-chart-4/15 text-chart-4",
  DOC: "bg-chart-3/15 text-chart-3",
  XLS: "bg-chart-2/15 text-chart-2",
}

type ParsedDoc = {
  id: string
  name: string
  size: string
  ext: string
  status: "uploading" | "parsing" | "ready"
  progress: number
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

type AuditItem =
  | {
      kind: "note"
      id: string
      actor: ThreadAuthor
      time: string
      action: string
      content?: string
    }
  | {
      kind: "diff"
      id: string
      actor: ThreadAuthor
      time: string
      verb: "updated" | "changed"
      subject: string
      from: string
      to: string
    }
  | {
      kind: "comment"
      id: string
      actor: ThreadAuthor
      time: string
      linkLabel: string
      content: string
    }
  | {
      kind: "approval"
      id: string
      actor: ThreadAuthor
      time: string
      body: string
    }
  | {
      kind: "system"
      id: string
      time: string
      body: string
    }

type AuditDayGroup = { day: string; items: AuditItem[]; sortDate: string }

const AUDIT_SEED_YEAR = 2026

function parseAuditDayLabelToIso(dayLabel: string, year: number): string {
  const head = dayLabel.split(" ·")[0].trim()
  const ts = Date.parse(`${head}, ${year}`)
  if (!Number.isFinite(ts)) return `${year}-01-01`
  return new Date(ts).toISOString().slice(0, 10)
}

type AuditDateRangePreset = "all" | "30d" | "90d" | "12m"

function auditDateRangeMinTs(preset: AuditDateRangePreset): number | null {
  if (preset === "all") return null
  const days = preset === "30d" ? 30 : preset === "90d" ? 90 : 365
  return Date.now() - days * 86400000
}

function sortDateToStartTs(iso: string): number {
  return Date.parse(`${iso}T12:00:00`)
}

function auditActorMemberId(actor: ThreadAuthor): string | null {
  if (actor.memberId) return actor.memberId
  return team.find((t) => t.name === actor.name)?.id ?? null
}

function auditItemMatchesActorFilter(item: AuditItem, memberId: string): boolean {
  if (memberId === "all") return true
  if (item.kind === "system") return false
  return auditActorMemberId(item.actor) === memberId
}

function auditItemMatchesStageFilter(item: AuditItem, stage: Stage | "all"): boolean {
  if (stage === "all") return true
  if (item.kind !== "diff") return true
  if (!/lifecycle stage|opportunity stage/i.test(item.subject)) return true
  return item.from === stage || item.to === stage
}

function filterAuditDayGroups(
  days: AuditDayGroup[],
  range: AuditDateRangePreset,
  memberId: string,
  stage: Stage | "all",
): AuditDayGroup[] {
  const minTs = auditDateRangeMinTs(range)
  return days
    .filter((d) => (minTs == null ? true : sortDateToStartTs(d.sortDate) >= minTs))
    .map((d) => ({
      ...d,
      items: d.items.filter(
        (item) => auditItemMatchesActorFilter(item, memberId) && auditItemMatchesStageFilter(item, stage),
      ),
    }))
    .filter((d) => d.items.length > 0)
}

function buildAuditSeedActive(): AuditDayGroup[] {
  const maria = authorFromMember(team.find((t) => t.id === "maria")!)
  const grace = authorFromMember(team.find((t) => t.id === "grace")!)
  const laurie = authorFromMember(team.find((t) => t.id === "laurie")!)
  return [
    {
      day: "May 8 · Today",
      sortDate: `${AUDIT_SEED_YEAR}-05-08`,
      items: [
        {
          kind: "note",
          id: "seed-m8",
          actor: maria,
          time: "2h ago",
          action: "added a note",
          content: `Talked to Dr. Patel — she's open to a budget realignment between Hartford and equipment lines. Need to formalize before next drawdown.`,
        },
      ],
    },
    {
      day: "May 4",
      sortDate: `${AUDIT_SEED_YEAR}-05-04`,
      items: [
        {
          kind: "diff",
          id: "seed-m4",
          actor: grace,
          time: "3:14pm",
          verb: "updated",
          subject: "Award amount",
          from: "$465,000",
          to: "$487,500",
        },
      ],
    },
    {
      day: "May 2",
      sortDate: `${AUDIT_SEED_YEAR}-05-02`,
      items: [
        {
          kind: "comment",
          id: "seed-m2",
          actor: laurie,
          time: "11:42am",
          linkLabel: "Logic model revision",
          content: `Hold off — CFO wants to see the budget realignment before we finalize outputs. I'll loop her in.`,
        },
      ],
    },
    {
      day: "Apr 28",
      sortDate: `${AUDIT_SEED_YEAR}-04-28`,
      items: [
        {
          kind: "approval",
          id: "seed-apr28a",
          actor: maria,
          time: "4:08pm",
          body: "approved drawdown of $112,000 — Q2 personnel + indirect",
        },
        {
          kind: "system",
          id: "seed-apr28b",
          time: "9:30am",
          body: "synced utilization feed — Hartford site flagged 18% over plan",
        },
      ],
    },
    {
      day: "Apr 14",
      sortDate: `${AUDIT_SEED_YEAR}-04-14`,
      items: [
        {
          kind: "diff",
          id: "seed-apr14",
          actor: grace,
          time: "10:21am",
          verb: "changed",
          subject: "Lifecycle stage",
          from: "Application Submitted",
          to: "Awarded - Active",
        },
      ],
    },
  ]
}

function buildAuditSeedProspecting(): AuditDayGroup[] {
  const maria = authorFromMember(team.find((t) => t.id === "maria")!)
  const laurie = authorFromMember(team.find((t) => t.id === "laurie")!)
  const grace = authorFromMember(team.find((t) => t.id === "grace")!)
  return [
    {
      day: "May 8 · Today",
      sortDate: `${AUDIT_SEED_YEAR}-05-08`,
      items: [
        {
          kind: "note",
          id: "seed-pro-1",
          actor: laurie,
          time: "1h ago",
          action: "added a note",
          content:
            "Summarized HRSA priorities from the NOFO — strong alignment on community health worker outcomes. Next step is a 30-min fit call with the PO.",
        },
      ],
    },
    {
      day: "May 5",
      sortDate: `${AUDIT_SEED_YEAR}-05-05`,
      items: [
        {
          kind: "diff",
          id: "seed-pro-2",
          actor: maria,
          time: "10:12am",
          verb: "updated",
          subject: "Opportunity stage",
          from: "Planned",
          to: "Researching",
        },
      ],
    },
    {
      day: "May 1",
      sortDate: `${AUDIT_SEED_YEAR}-05-01`,
      items: [
        {
          kind: "comment",
          id: "seed-pro-3",
          actor: grace,
          time: "3:40pm",
          linkLabel: "Funder brief",
          content: "Drafted two-page program summary for leadership — waiting on metrics from Springfield before we circulate.",
        },
      ],
    },
    {
      day: "Apr 22",
      sortDate: `${AUDIT_SEED_YEAR}-04-22`,
      items: [
        {
          kind: "system",
          id: "seed-pro-4",
          time: "8:00am",
          body: "990 dataset refreshed — payout rate and median grant size pulled into Opportunity tab.",
        },
      ],
    },
  ]
}

function buildAuditSeedTerminal(): AuditDayGroup[] {
  const maria = authorFromMember(team.find((t) => t.id === "maria")!)
  const grace = authorFromMember(team.find((t) => t.id === "grace")!)
  return [
    {
      day: "May 8 · Today",
      sortDate: `${AUDIT_SEED_YEAR}-05-08`,
      items: [
        {
          kind: "note",
          id: "seed-term-1",
          actor: maria,
          time: "4h ago",
          action: "added a note",
          content: "Archived final narrative and portal exports to the grant folder. Finance sign-off on last invoice is complete.",
        },
      ],
    },
    {
      day: "May 2",
      sortDate: `${AUDIT_SEED_YEAR}-05-02`,
      items: [
        {
          kind: "diff",
          id: "seed-term-2",
          actor: grace,
          time: "2:18pm",
          verb: "changed",
          subject: "Lifecycle stage",
          from: "Awarded - Active",
          to: "Closed",
        },
      ],
    },
    {
      day: "Apr 18",
      sortDate: `${AUDIT_SEED_YEAR}-04-18`,
      items: [
        {
          kind: "system",
          id: "seed-term-3",
          time: "6:15am",
          body: "Final closeout checklist marked complete — no open compliance items.",
        },
      ],
    },
  ]
}

function buildAuditSeedByBucket(bucket: GrantLifecycleBucket): AuditDayGroup[] {
  if (bucket === "active") return buildAuditSeedActive()
  if (bucket === "terminal") return buildAuditSeedTerminal()
  return buildAuditSeedProspecting()
}

function AuditTimelineItems({ items }: { items: AuditItem[] }) {
  return (
    <>
      {items.map((item) => {
        if (item.kind === "note") {
          return (
            <div key={item.id} className="relative grid grid-cols-[24px_1fr] gap-3 py-2">
              <span className="z-[1] mx-auto mt-1.5 size-2 rounded-full border-2 border-muted-foreground/50 bg-card" />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-medium text-foreground">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: item.actor.color }}
                    >
                      {item.actor.initials}
                    </span>
                    <strong>{item.actor.name}</strong>
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">{item.time}</span>
                </div>
                <p className="text-muted-foreground">{item.action}</p>
                {item.content ? (
                  <div className="mt-2 rounded-md bg-muted/60 p-3 text-[13px] leading-relaxed text-foreground/90">{item.content}</div>
                ) : null}
              </div>
            </div>
          )
        }
        if (item.kind === "diff") {
          return (
            <div key={item.id} className="relative grid grid-cols-[24px_1fr] gap-3 py-2">
              <span className="z-[1] mx-auto mt-1.5 size-2 rounded-full border-2 border-muted-foreground/50 bg-card" />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: item.actor.color }}
                    >
                      {item.actor.initials}
                    </span>
                    <strong>{item.actor.name}</strong>
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">{item.time}</span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {item.verb} <strong className="font-medium text-foreground">{item.subject}</strong>
                </p>
                <div className="mt-1 inline-flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto text-[12.5px] whitespace-nowrap">
                  <span className="shrink-0 text-muted-foreground line-through">{item.from}</span>
                  <span className="shrink-0 text-muted-foreground">→</span>
                  <span className="shrink-0 font-medium text-foreground">{item.to}</span>
                </div>
              </div>
            </div>
          )
        }
        if (item.kind === "comment") {
          return (
            <div key={item.id} className="relative grid grid-cols-[24px_1fr] gap-3 py-2">
              <span className="z-[1] mx-auto mt-1.5 size-2 rounded-full border-2 border-muted-foreground/50 bg-card" />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: item.actor.color }}
                    >
                      {item.actor.initials}
                    </span>
                    <strong>{item.actor.name}</strong>
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">{item.time}</span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  commented on{" "}
                  <button type="button" className="border-b border-border/60 font-medium text-foreground">
                    {item.linkLabel}
                  </button>
                </p>
                <div className="mt-2 rounded-md bg-muted/60 p-3 text-[13px] leading-relaxed text-foreground/90">{item.content}</div>
              </div>
            </div>
          )
        }
        if (item.kind === "approval") {
          return (
            <div key={item.id} className="relative grid grid-cols-[24px_1fr] gap-3 py-2">
              <span className="z-[1] mx-auto mt-1.5 size-2 rounded-full border-2 border-muted-foreground/50 bg-card" />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: item.actor.color }}
                    >
                      {item.actor.initials}
                    </span>
                    <strong>{item.actor.name}</strong>
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">{item.time}</span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  approved drawdown of <strong className="font-medium text-foreground">$112,000</strong> — Q2 personnel + indirect
                </p>
              </div>
            </div>
          )
        }
        return (
          <div key={item.id} className="relative grid grid-cols-[24px_1fr] gap-3 py-2">
            <span className="z-[1] mx-auto mt-1.5 size-2.5 rounded-full border-2 border-dashed border-muted-foreground/40 bg-card" />
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-muted-foreground">
                    <RefreshCw className="size-2.5" aria-hidden />
                  </span>
                  <strong>Epic integration</strong>
                </span>
                <span className="text-[11.5px] text-muted-foreground">{item.time}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                synced utilization feed —{" "}
                <strong className="font-medium text-foreground">Hartford site flagged 18% over plan</strong>
              </p>
            </div>
          </div>
        )
      })}
    </>
  )
}

function seedTaskThreadsActive(): Record<string, TaskThreadEntry[]> {
  const maria = authorFromMember(team.find((t) => t.id === "maria")!)
  const grace = authorFromMember(team.find((t) => t.id === "grace")!)
  const laurie = authorFromMember(team.find((t) => t.id === "laurie")!)
  const sharon: ThreadAuthor = { name: "Sharon Wells", initials: "SW", color: "#9C4A4A" }
  return {
    drawdown: [
      {
        id: "td1",
        at: "2h ago",
        body: "Pinged Dr. Patel for the formal confirmation email — expecting it tomorrow morning.",
        author: maria,
      },
      {
        id: "td2",
        at: "May 4",
        body: "QuickBooks reconciled — totals match the agreement budget.",
        author: grace,
      },
    ],
    midyear: [],
    logic: [
      {
        id: "tl1",
        at: "May 2",
        body: `Hold off — CFO wants to see the budget realignment before we finalize outputs. I'll loop her in.`,
        author: laurie,
      },
      {
        id: "tl2",
        at: "Apr 30",
        body: "Need a week to review the Hartford reallocation before I can sign off.",
        author: sharon,
      },
    ],
    visit: [],
  }
}

function seedTaskThreadsProspecting(): Record<string, TaskThreadEntry[]> {
  const maria = authorFromMember(team.find((t) => t.id === "maria")!)
  const laurie = authorFromMember(team.find((t) => t.id === "laurie")!)
  return {
    "research-fit": [
      {
        id: "tp1",
        at: "2h ago",
        body: "Pulled last three years of awards in our cohort from USASpending — typical ask looks like $400–550K.",
        author: laurie,
      },
    ],
    narrative: [
      {
        id: "tp2",
        at: "May 4",
        body: "Leadership wants the equity framing upfront; I’ll fold that into v2 tonight.",
        author: maria,
      },
    ],
    discovery: [],
    "budget-outline": [],
  }
}

function seedTaskThreadsTerminal(): Record<string, TaskThreadEntry[]> {
  const maria = authorFromMember(team.find((t) => t.id === "maria")!)
  return {
    closeout: [
      {
        id: "tt1",
        at: "May 3",
        body: "Submitted final SF-425 and narrative to the portal — confirmation email saved to Documents.",
        author: maria,
      },
    ],
    archive: [],
    narrative: [],
    handoff: [],
  }
}

function seedTaskThreadsByBucket(bucket: GrantLifecycleBucket): Record<string, TaskThreadEntry[]> {
  if (bucket === "active") return seedTaskThreadsActive()
  if (bucket === "terminal") return seedTaskThreadsTerminal()
  return seedTaskThreadsProspecting()
}

type TrendMetric = "giving" | "grants" | "median" | "assets" | "payout"

const TREND: Record<
  TrendMetric,
  { title: string; values: number[]; yMax: number; yLabels: string[]; latest: string; peak: string; cagr: string; vsAvg: string }
> = {
  giving: {
    title: "Annual giving · 10-year history",
    values: [52, 58, 63, 71, 78, 85, 76, 82, 96, 108],
    yMax: 120,
    yLabels: ["$120M", "$90M", "$60M", "$30M", "$0"],
    latest: "$108M",
    peak: "$108M",
    cagr: "+7.6%",
    vsAvg: "+24.7%",
  },
  grants: {
    title: "Grants made · 10-year history",
    values: [520, 560, 600, 640, 685, 720, 690, 760, 800, 847],
    yMax: 900,
    yLabels: ["900", "675", "450", "225", "0"],
    latest: "847",
    peak: "847",
    cagr: "+5.6%",
    vsAvg: "+11.8%",
  },
  median: {
    title: "Median grant size · 10-year",
    values: [28, 30, 33, 36, 38, 40, 38, 42, 44, 45],
    yMax: 50,
    yLabels: ["$50K", "$37.5K", "$25K", "$12.5K", "$0"],
    latest: "$45K",
    peak: "$45K",
    cagr: "+5.0%",
    vsAvg: "+8.4%",
  },
  assets: {
    title: "Total assets · 10-year history",
    values: [1.4, 1.5, 1.65, 1.85, 2.0, 2.15, 2.05, 2.3, 2.6, 2.8],
    yMax: 3,
    yLabels: ["$3B", "$2.25B", "$1.5B", "$750M", "$0"],
    latest: "$2.8B",
    peak: "$2.8B",
    cagr: "+7.2%",
    vsAvg: "+22.8%",
  },
  payout: {
    title: "Payout rate · 10-year history",
    values: [3.7, 3.6, 3.8, 3.9, 4.0, 4.0, 3.7, 3.6, 3.7, 3.9],
    yMax: 5,
    yLabels: ["5%", "3.75%", "2.5%", "1.25%", "0%"],
    latest: "3.9%",
    peak: "4.0%",
    cagr: "+0.5%",
    vsAvg: "+5.6%",
  },
}

const GRANT_SIZE_DIST_DATA = [
  { label: "<$10K", count: 95, highlight: false },
  { label: "$10–25K", count: 184, highlight: false },
  { label: "$25–50K", count: 248, highlight: false },
  { label: "$50–100K", count: 178, highlight: false },
  { label: "$100–250K", count: 92, highlight: false },
  { label: "$250K–1M", count: 38, highlight: true },
  { label: ">$1M", count: 12, highlight: false },
] as const

const GRANT_SIZE_BAR_FILLS = [
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-1)",
  "var(--chart-5)",
] as const

function Funder990TrendChart({ metric }: { metric: TrendMetric }) {
  const uid = useId().replace(/:/g, "")
  const gradId = `f990-fill-${uid}`
  const { chartReady, reducedMotion } = useKpiChartMotion()
  const cfg = TREND[metric]
  const data = useMemo(() => cfg.values.map((value, i) => ({ year: String(2014 + i), value })), [metric, cfg.values])
  return (
    <div className="h-[220px] w-full [&_.recharts-surface]:outline-none" style={{ fontFamily: KPI_CHART_FONT }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.85} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            width={44}
            domain={[0, cfg.yMax]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => {
              if (metric === "giving") return `$${v}M`
              if (metric === "assets") return `$${v}B`
              if (metric === "median") return `$${v}K`
              if (metric === "payout") return `${v}%`
              return String(v)
            }}
          />
          <Tooltip
            contentStyle={{
              fontFamily: KPI_CHART_FONT,
              fontSize: 12,
              borderRadius: 8,
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
            formatter={(value: number) => [value, cfg.title.split("·")[0]?.trim() ?? "Value"]}
            labelFormatter={(y) => `FY ${y}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            fill={`url(#${gradId})`}
            dot={{ r: 3, fill: "var(--card)", stroke: "var(--chart-1)", strokeWidth: 1.5 }}
            activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--chart-1)" }}
            isAnimationActive={!reducedMotion && chartReady}
            animationDuration={reducedMotion ? 0 : KPI_CHART_ANIMATION_DURATION_MS}
            animationEasing={KPI_CHART_ANIMATION_EASING}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function Funder990SizeBarChart() {
  const { chartReady, reducedMotion } = useKpiChartMotion()
  const data = useMemo(() => GRANT_SIZE_DIST_DATA.map((d) => ({ ...d })), [])
  return (
    <div className="h-[200px] w-full [&_.recharts-surface]:outline-none" style={{ fontFamily: KPI_CHART_FONT }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 28 }} barCategoryGap="12%">
          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="var(--border)" opacity={0.85} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            contentStyle={{
              fontFamily: KPI_CHART_FONT,
              fontSize: 12,
              borderRadius: 8,
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion && chartReady} animationDuration={KPI_CHART_ANIMATION_DURATION_MS} animationEasing={KPI_CHART_ANIMATION_EASING}>
            {data.map((entry, i) => (
              <Cell key={entry.label} fill={GRANT_SIZE_BAR_FILLS[i] ?? "var(--chart-3)"} stroke={entry.highlight ? "var(--chart-1)" : undefined} strokeWidth={entry.highlight ? 1 : 0} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function OpportunityGivingTrendChart({ data }: { data: { year: number; amount: number }[] }) {
  const { chartReady, reducedMotion } = useKpiChartMotion()
  const chartData = useMemo(
    () => data.map((d) => ({ year: String(d.year), amount: d.amount })),
    [data],
  )
  return (
    <div className="h-[240px] w-full [&_.recharts-surface]:outline-none" style={{ fontFamily: KPI_CHART_FONT }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.85} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => `$${v}M`}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{
              fontFamily: KPI_CHART_FONT,
              fontSize: 12,
              borderRadius: 8,
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
            formatter={(value: number | string) => [`$${value}M`, "Giving"]}
            labelFormatter={(y) => `FY ${y}`}
          />
          <Bar
            dataKey="amount"
            fill="var(--primary)"
            fillOpacity={0.35}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reducedMotion && chartReady}
            animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
            animationEasing={KPI_CHART_ANIMATION_EASING}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "var(--chart-2)", strokeWidth: 0 }}
            isAnimationActive={!reducedMotion && chartReady}
            animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
            animationEasing={KPI_CHART_ANIMATION_EASING}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function Opportunity990CumulativeAreaChart({ data }: { data: { year: number; amount: number }[] }) {
  const gid = useId().replace(/:/g, "")
  const { chartReady, reducedMotion } = useKpiChartMotion()
  const chartData = useMemo(() => {
    let run = 0
    return data.map((d) => {
      run += d.amount
      return { year: String(d.year), cumulative: Math.round(run * 10) / 10 }
    })
  }, [data])
  const gradId = `opp990Cumulative-${gid}`
  return (
    <div className="h-[240px] w-full [&_.recharts-surface]:outline-none" style={{ fontFamily: KPI_CHART_FONT }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.85} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => `$${v}M`}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{
              fontFamily: KPI_CHART_FONT,
              fontSize: 12,
              borderRadius: 8,
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
            formatter={(value: number | string) => [`$${value}M`, "Cumulative"]}
            labelFormatter={(y) => `Through ${y}`}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="var(--chart-3)"
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive={!reducedMotion && chartReady}
            animationDuration={KPI_CHART_ANIMATION_DURATION_MS}
            animationEasing={KPI_CHART_ANIMATION_EASING}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function buildOlderAuditDays(): AuditDayGroup[] {
  const maria = authorFromMember(team.find((t) => t.id === "maria")!)
  const grace = authorFromMember(team.find((t) => t.id === "grace")!)
  const laurie = authorFromMember(team.find((t) => t.id === "laurie")!)
  const rows: [string, AuditItem][] = [
    ["Apr 12", { kind: "note", id: "o-1", actor: grace, time: "4:20pm", action: "added a note", content: "Circulated draft narrative to program leads." }],
    ["Apr 11", { kind: "diff", id: "o-2", actor: maria, time: "1:05pm", verb: "updated", subject: "Application owner", from: "Unassigned", to: maria.name }],
    ["Apr 11", { kind: "system", id: "o-3", time: "8:12am", body: "Drive sync completed — 3 new attachments indexed." }],
    ["Apr 10", { kind: "note", id: "o-4", actor: laurie, time: "3:50pm", action: "added a note", content: "CFO asked for one more column on indirect — added." }],
    ["Apr 9", { kind: "diff", id: "o-5", actor: grace, time: "11:18am", verb: "changed", subject: "Deadline", from: "May 2", to: "May 5" }],
    ["Apr 8", { kind: "comment", id: "o-6", actor: maria, time: "9:22am", linkLabel: "Full proposal", content: "Can we lock section 4 before legal review?" }],
    ["Apr 7", { kind: "note", id: "o-7", actor: grace, time: "5:01pm", action: "added a note", content: "Exported budget CSV for Finance." }],
    ["Apr 6", { kind: "system", id: "o-8", time: "7:00am", body: "Scheduled reminder: LOI acknowledgment window closes in 7 days." }],
    ["Apr 5", { kind: "diff", id: "o-9", actor: maria, time: "2:44pm", verb: "updated", subject: "Logic model file", from: "v1.pdf", to: "v2.pdf" }],
    ["Apr 4", { kind: "note", id: "o-10", actor: laurie, time: "10:10am", action: "added a note", content: "Site visit dates penciled — awaiting PO confirmation." }],
    ["Apr 3", { kind: "approval", id: "o-11", actor: maria, time: "4:55pm", body: "approved internal budget carry request" }],
    ["Apr 2", { kind: "system", id: "o-12", time: "6:30am", body: "Epic utilization job finished with no errors." }],
    ["Apr 1", { kind: "note", id: "o-13", actor: grace, time: "1:12pm", action: "added a note", content: "Uploaded signed partner MOU." }],
    ["Mar 28", { kind: "diff", id: "o-14", actor: grace, time: "9:09am", verb: "changed", subject: "Reporting cadence", from: "Quarterly", to: "Mid-year + annual" }],
    ["Mar 26", { kind: "comment", id: "o-15", actor: laurie, time: "12:40pm", linkLabel: "Budget workbook", content: "Indirect tab formula looks good on my end." }],
    ["Mar 22", { kind: "note", id: "o-16", actor: maria, time: "3:08pm", action: "added a note", content: "Kickoff call notes attached." }],
    ["Mar 18", { kind: "system", id: "o-17", time: "5:15am", body: "Portal credentials rotated per IT policy." }],
    ["Mar 14", { kind: "diff", id: "o-18", actor: maria, time: "11:11am", verb: "updated", subject: "Primary site", from: "Hartford", to: "Springfield" }],
    ["Mar 10", { kind: "note", id: "o-19", actor: grace, time: "8:47am", action: "added a note", content: "Draft LOI shared with leadership." }],
    ["Mar 4", { kind: "note", id: "o-20", actor: laurie, time: "2:02pm", action: "added a note", content: "Risk register updated for Q1." }],
    ["Feb 26", { kind: "system", id: "o-21", time: "10:00pm", body: "Year-end snapshot archived for audit trail." }],
  ]
  const byDay = new Map<string, AuditItem[]>()
  for (const [day, item] of rows) {
    const list = byDay.get(day) ?? []
    list.push(item)
    byDay.set(day, list)
  }
  return Array.from(byDay.entries()).map(([day, items]) => ({
    day,
    items,
    sortDate: parseAuditDayLabelToIso(day, AUDIT_SEED_YEAR),
  }))
}

const OLDER_AUDIT_DAYS = buildOlderAuditDays()

type TaskRowDef = {
  id: string
  title: string
  sub: string
  description: string
  due: string
  urgent?: boolean
  ownerId: string
  tag?: string
}

function seedTasksActive(ownerId: string): TaskRowDef[] {
  return [
    {
      id: "drawdown",
      title: "Q2 drawdown package",
      sub: "Drawdown · $112K personnel + indirect",
      description:
        "Assemble the reimbursement packet with payroll registers for Springfield and Hartford, indirect pool breakdown, and PO attestation. Route to Dr. Patel for approval before Finance releases funds.",
      due: "May 5 · 3d late",
      urgent: true,
      ownerId,
    },
    {
      id: "midyear",
      title: "Mid-year progress report",
      sub: "Report · enrollment + utilization",
      description:
        "Summarize enrollment vs. targets, placement at 6 months, and site-level utilization. Include the two new equity fields from the March template and attach charts exported from the outcomes dashboard.",
      due: "May 31",
      ownerId,
    },
    {
      id: "logic",
      title: "Logic model revision",
      sub: "Deliverable · awaiting CFO sign-off",
      description:
        "Revise outputs and assumptions to reflect the Hartford reallocation scenario. Circulate the redlined PDF to the CFO before uploading the final version to the funder portal.",
      due: "May 20",
      ownerId: "laurie",
      tag: "CFO review",
    },
    {
      id: "visit",
      title: "Site visit prep — HRSA PO",
      sub: "Outreach · coordinate with clinical team",
      description:
        "Confirm tour stops, participant story briefs (anonymized), and the data room folder. Schedule a dry run with clinical leadership one week before the Jun 3 visit.",
      due: "Jun 3",
      ownerId: "grace",
    },
  ]
}

function seedTasksProspecting(ownerId: string): TaskRowDef[] {
  return [
    {
      id: "research-fit",
      title: "Complete funder fit memo",
      sub: "Prospecting · NOFO + 990 scan",
      description:
        "Document mission alignment, typical award size, and any deal-breakers (match, indirect cap, site requirements). Link primary NOFO sections and attach the one-page competitive scan.",
      due: "May 12",
      urgent: true,
      ownerId: "laurie",
    },
    {
      id: "narrative",
      title: "Draft opportunity narrative (internal)",
      sub: "Story · problem / intervention / outcomes",
      description:
        "Two-page narrative for leadership go/no-go: who we serve, evidence base, and how this funder’s priorities map. No budget detail yet beyond rough order-of-magnitude.",
      due: "May 18",
      ownerId,
    },
    {
      id: "discovery",
      title: "Schedule PO / program discovery call",
      sub: "Relationship · clarify eligibility",
      description:
        "Secure a 30-minute intro with the program officer. Agenda: eligibility, cohort definition, and whether prior HRSA awards affect scoring.",
      due: "May 22",
      ownerId,
      tag: "Relationship",
    },
    {
      id: "budget-outline",
      title: "Rough budget outline (no line items)",
      sub: "Planning · staffing + sites only",
      description:
        "High-level buckets only (personnel %, fringe, subcontractors). Explicitly not for submission — calibrate ask size before LOI.",
      due: "May 25",
      ownerId: "grace",
    },
  ]
}

function seedTasksTerminal(ownerId: string): TaskRowDef[] {
  return [
    {
      id: "closeout",
      title: "Final closeout checklist",
      sub: "Compliance · portal + finance",
      description:
        "Confirm last reimbursement, property disposition if any, and narrative filed. Export portal receipts into the grant folder.",
      due: "Complete",
      ownerId,
      urgent: true,
    },
    {
      id: "archive",
      title: "Archive grant record",
      sub: "Records · 7-year retention",
      description:
        "Move signed agreements, key correspondence, and financial close packet into long-term storage with standard naming.",
      due: "May 30",
      ownerId,
    },
    {
      id: "narrative",
      title: "Lessons learned brief",
      sub: "Internal · 1 page",
      description:
        "Capture what worked for renewals: relationship rhythm, reporting burden, and any budget surprises for the portfolio review.",
      due: "Jun 6",
      ownerId: "grace",
    },
    {
      id: "handoff",
      title: "Stakeholder handoff",
      sub: "Programs · sustain outcomes",
      description:
        "Brief program leads on any post-award obligations that continue (data, participant follow-up) after the grant formally ends.",
      due: "Jun 10",
      ownerId: "nina",
    },
  ]
}

function seedTasksByBucket(bucket: GrantLifecycleBucket, ownerId: string): TaskRowDef[] {
  if (bucket === "active") return seedTasksActive(ownerId)
  if (bucket === "terminal") return seedTasksTerminal(ownerId)
  return seedTasksProspecting(ownerId)
}

type AppCyclePhase = AppCycle["phase"]

const APP_STATUS_OPTIONS: { value: AppSubmissionStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "review", label: "In review" },
]

function appStatusDotClass(s: AppSubmissionStatus) {
  if (s === "submitted") return "bg-chart-2"
  if (s === "in_progress") return "bg-primary"
  if (s === "review") return "bg-amber-500"
  return "bg-muted-foreground"
}

function appStatusLabel(s: AppSubmissionStatus) {
  return APP_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s
}

const APP_DOC_KIND_OPTIONS: { value: AppDocKind; label: string }[] = [
  { value: "LOI", label: "LOI" },
  { value: "Proposal", label: "Proposal" },
]

function formatSingleCycleDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const DEADLINE_PILL_TONE: Record<DeadlineUrgency, string> = {
  overdue: "bg-rose-100 text-rose-900 ring-1 ring-rose-300 dark:bg-rose-950/55 dark:text-rose-100 dark:ring-rose-900/60",
  urgent: "bg-amber-100 text-amber-950 ring-1 ring-amber-300 dark:bg-amber-950/55 dark:text-amber-100 dark:ring-amber-900/60",
  soon: "bg-muted text-foreground ring-1 ring-border/60",
  normal: "",
}

const DEADLINE_DOT_TONE: Record<DeadlineUrgency, string> = {
  overdue: "bg-rose-600",
  urgent: "bg-amber-500",
  soon: "bg-muted-foreground/60",
  normal: "",
}

const appFieldInputClass =
  "h-8 border-border/60 bg-white text-xs shadow-none focus-visible:ring-1 dark:bg-card"

function ApplicationCyclesPanel({
  appCycles,
  setAppCycles,
  ownerId,
  grant,
  applicationHighlight,
  onDismissApplicationHighlight,
}: {
  appCycles: AppCycle[]
  setAppCycles: Dispatch<SetStateAction<AppCycle[]>>
  ownerId: string
  grant: Grant
  applicationHighlight?: IssueNavigationContext | null
  onDismissApplicationHighlight?: () => void
}) {
  const [cycleFilter, setCycleFilter] = useState<AppCycleFilter>("all")
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<{ cycleId: string; row: AppCycleRow } | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  const applicationCount = useMemo(() => appCycles.reduce((n, c) => n + c.rows.length, 0), [appCycles])

  /** Sort applications by deadline. Active rows (not yet submitted) come first by closest
   *  upcoming deadline; already-submitted rows fall to the bottom, most recent first. */
  const tableRows = useMemo(() => {
    const rows = flattenApplications(appCycles, cycleFilter)
    return rows.slice().sort((a, b) => {
      const aSubmitted = a.status === "submitted" ? 1 : 0
      const bSubmitted = b.status === "submitted" ? 1 : 0
      if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted
      if (aSubmitted === 0) return a.cycleDate < b.cycleDate ? -1 : a.cycleDate > b.cycleDate ? 1 : 0
      return a.cycleDate < b.cycleDate ? 1 : a.cycleDate > b.cycleDate ? -1 : 0
    })
  }, [appCycles, cycleFilter])

  useEffect(() => {
    if (applicationHighlight?.fieldKey === "submit_application") setCycleFilter("all")
  }, [applicationHighlight])

  const viewApplication = (row: FlatApplicationRow) => {
    toast("View application", { description: `${grantDisplayTitle(grant)} · ${row.name}` })
  }

  const openEdit = (cycleId: string, row: FlatApplicationRow) => {
    const clean: AppCycleRow = {
      id: row.id,
      name: row.name,
      kind: row.kind,
      status: row.status,
      ownerId: row.ownerId,
      submissionDate: row.submissionDate,
      lastUpdated: row.lastUpdated,
    }
    setEditTarget({ cycleId, row: { ...clean } })
    setEditOpen(true)
  }

  const saveEdit = () => {
    if (!editTarget) return
    const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    setAppCycles((prev) =>
      patchAppCycleRow(prev, editTarget.cycleId, editTarget.row.id, {
        ...editTarget.row,
        lastUpdated: stamp,
      }),
    )
    setEditOpen(false)
    setEditTarget(null)
    toast.success("Application updated", { description: editTarget.row.name })
  }

  const removeRow = (cycleId: string, rowId: string, label: string) => {
    setAppCycles((prev) =>
      prev.map((c) => (c.id !== cycleId ? c : { ...c, rows: c.rows.filter((r) => r.id !== rowId) })),
    )
    toast("Removed", { description: label })
  }

  const addApplicationRow = () => {
    const id = `row-${Date.now()}`
    const targetCycle =
      appCycles.find((c) => c.phase === "current") ?? appCycles.find((c) => c.phase === "future") ?? appCycles[0]
    if (!targetCycle) return
    setAppCycles((prev) =>
      prev.map((c) =>
        c.id !== targetCycle.id
          ? c
          : {
              ...c,
              rows: [
                ...c.rows,
                {
                  id,
                  name: "New application",
                  kind: "LOI",
                  status: "draft",
                  ownerId,
                  submissionDate: "—",
                  lastUpdated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                },
              ],
            },
      ),
    )
    toast.success("Application added", { description: "Use Edit to complete the row." })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">Applications</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {applicationCount} row{applicationCount === 1 ? "" : "s"} across {appCycles.length} cycle
            {appCycles.length === 1 ? "" : "s"} · sorted by deadline. Rows mirror My-work tasks.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="app-cycle-filter" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Cycle
            </label>
            <select
              id="app-cycle-filter"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value as AppCycleFilter)}
              className={cn(appFieldInputClass, "h-9 min-w-[11rem] cursor-pointer rounded-md border px-2 dark:bg-card")}
            >
              <option value="all">All cycles</option>
              <option value="current">Current</option>
              <option value="future">Future</option>
              <option value="past">Past</option>
            </select>
          </div>
          <FlatButton size="sm" onClick={addApplicationRow}>
            + New application
          </FlatButton>
        </div>
      </div>

      {applicationHighlight?.fieldKey === "submit_application" ? (() => {
        const target = flattenApplications(appCycles, "all").find(
          (r) => r.kind === "Proposal" && r.status === "in_progress",
        )
        const deadlineLabel = target ? formatSingleCycleDate(target.cycleDate) : null
        const relLabel = target ? appDeadlineRelativeLabel(target.cycleDate) : null
        return (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-50"
          role="status"
        >
          <p className="flex min-w-0 flex-1 items-start gap-2.5 leading-snug">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              <span className="font-semibold">Due soon</span>
              <span className="text-amber-900/90 dark:text-amber-100/90">
                {" "}
                — Full proposal deadline
                {deadlineLabel ? (
                  <>
                    {" "}
                    is <strong className="font-semibold">{deadlineLabel}</strong>
                    {relLabel ? <> ({relLabel.toLowerCase()})</> : null}
                  </>
                ) : (
                  <> is near</>
                )}
                . Record the submission date and upload your final proposal.
              </span>
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 px-3 text-[12.5px] font-medium"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="size-3.5 shrink-0" aria-hidden />
              Upload proposal
            </Button>
            <button
              type="button"
              onClick={() => onDismissApplicationHighlight?.()}
              className="shrink-0 rounded-md p-1 text-amber-800/70 hover:bg-amber-100/80 hover:text-amber-950 dark:text-amber-200/80 dark:hover:bg-amber-900/50 dark:hover:text-amber-50"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        )
      })() : null}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Table containerClassName="p-0 sm:p-0" className="text-[12px] leading-snug [&_th]:h-9 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 font-medium uppercase tracking-wide text-muted-foreground">Grant</TableHead>
              <TableHead className="font-medium uppercase tracking-wide text-muted-foreground">LOI or proposal</TableHead>
              <TableHead className="font-medium uppercase tracking-wide text-muted-foreground">Deadline</TableHead>
              <TableHead className="font-medium uppercase tracking-wide text-muted-foreground">Submission date</TableHead>
              <TableHead className="font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="font-medium uppercase tracking-wide text-muted-foreground">Owner</TableHead>
              <TableHead className="font-medium uppercase tracking-wide text-muted-foreground">Last updated</TableHead>
              <TableHead className="min-w-[10.5rem] pr-4 text-right font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-10 text-center text-[12px] text-muted-foreground">
                  No applications in this cycle filter.
                </TableCell>
              </TableRow>
            ) : (
              tableRows.map((row) => {
                const rowOwner = team.find((m) => m.id === row.ownerId) || team[0]
                return (
                  <TableRow key={`${row.cycleId}-${row.id}`}>
                    <TableCell className="max-w-[16rem] whitespace-normal pl-4">
                      <button
                        type="button"
                        className={cn(
                          "group w-full rounded-md py-1 text-left outline-none transition-colors",
                          "hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                        onClick={() => viewApplication(row)}
                      >
                        <div className="font-medium leading-snug text-foreground underline-offset-2 group-hover:underline group-hover:decoration-primary/60">
                          {grantDisplayTitle(grant)}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{grant.funder}</div>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.kind}</TableCell>
                    <TableCell className="tabular-nums">
                      {(() => {
                        const tone: DeadlineUrgency = row.status === "submitted" ? "normal" : deadlineUrgency(row.cycleDate)
                        const rel = row.status === "submitted" ? null : appDeadlineRelativeLabel(row.cycleDate)
                        if (tone === "overdue" || tone === "urgent") {
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium",
                                DEADLINE_PILL_TONE[tone],
                              )}
                              title={rel ?? undefined}
                            >
                              <span className={cn("size-1.5 shrink-0 rounded-full", DEADLINE_DOT_TONE[tone])} aria-hidden />
                              {formatSingleCycleDate(row.cycleDate)}
                              {rel ? <span className="font-normal opacity-80">· {rel}</span> : null}
                            </span>
                          )
                        }
                        return <span className="text-muted-foreground">{formatSingleCycleDate(row.cycleDate)}</span>
                      })()}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{row.submissionDate}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground">
                        <span className={cn("size-1.5 shrink-0 rounded-full", appStatusDotClass(row.status))} aria-hidden />
                        {appStatusLabel(row.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MemberAvatar member={rowOwner} className="size-5 text-[9px]" />
                        <span className="truncate text-foreground">{rowOwner.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{row.lastUpdated}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <FlatButton
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs font-normal"
                          onClick={() => openEdit(row.cycleId, row)}
                        >
                          Edit
                        </FlatButton>
                        <FlatButton
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs font-normal"
                          onClick={() => viewApplication(row)}
                        >
                          View
                        </FlatButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <FlatButton
                              variant="outline"
                              size="icon-sm"
                              className="size-8 shrink-0"
                              aria-label={`More actions for ${grantDisplayTitle(grant)} — ${row.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </FlatButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              className="flex cursor-pointer items-center gap-2 text-xs"
                              onClick={() => toast("Share", { description: `Link copied for ${row.name} (demo).` })}
                            >
                              <Share2 className="size-3.5 shrink-0 text-muted-foreground" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="flex cursor-pointer items-center gap-2 text-xs"
                              onClick={() => toast("Copy link", { description: "Application URL copied (demo)." })}
                            >
                              <Copy className="size-3.5 shrink-0 text-muted-foreground" />
                              Copy link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer text-xs"
                              onClick={() => removeRow(row.cycleId, row.id, row.name)}
                            >
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <UploadApplicationDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open)
          if (!open) onDismissApplicationHighlight?.()
        }}
        grantId={grant.id}
        grantTitle={grantDisplayTitle(grant)}
      />

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditOpen(false)
            setEditTarget(null)
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle className="font-heading text-base">Edit application</DialogTitle>
            <DialogDescription className="text-[12px]">
              {editTarget ? (
                <>
                  Cycle: <span className="font-medium text-foreground">{appCycles.find((c) => c.id === editTarget.cycleId)?.title}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {editTarget ? (
            <div className="space-y-4 px-5 py-4">
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Application name</div>
                <Input
                  value={editTarget.row.name}
                  onChange={(e) => setEditTarget((t) => (t ? { ...t, row: { ...t.row, name: e.target.value } } : t))}
                  className={appFieldInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">LOI or proposal</div>
                <select
                  value={editTarget.row.kind}
                  onChange={(e) =>
                    setEditTarget((t) =>
                      t ? { ...t, row: { ...t.row, kind: e.target.value as AppDocKind } } : t,
                    )
                  }
                  className={cn(appFieldInputClass, "h-9 w-full cursor-pointer rounded-md border px-2 dark:bg-card")}
                >
                  {APP_DOC_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Submission date</div>
                <Input
                  value={editTarget.row.submissionDate}
                  onChange={(e) =>
                    setEditTarget((t) => (t ? { ...t, row: { ...t.row, submissionDate: e.target.value } } : t))
                  }
                  className={appFieldInputClass}
                  placeholder="e.g. Mar 14, 2026 or —"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</div>
                <select
                  value={editTarget.row.status}
                  onChange={(e) =>
                    setEditTarget((t) =>
                      t ? { ...t, row: { ...t.row, status: e.target.value as AppSubmissionStatus } } : t,
                    )
                  }
                  className={cn(appFieldInputClass, "h-9 w-full cursor-pointer rounded-md border px-2 dark:bg-card")}
                >
                  {APP_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Owner</div>
                <select
                  value={editTarget.row.ownerId}
                  onChange={(e) =>
                    setEditTarget((t) => (t ? { ...t, row: { ...t.row, ownerId: e.target.value } } : t))
                  }
                  className={cn(appFieldInputClass, "h-9 w-full cursor-pointer rounded-md border px-2 dark:bg-card")}
                >
                  {team
                    .filter((m) => m.id !== "unassigned")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">Last updated is set automatically when you save.</p>
            </div>
          ) : null}
          <DialogFooter className="border-t border-border/60 px-5 py-4">
            <FlatButton
              variant="outline"
              size="sm"
              onClick={() => {
                setEditOpen(false)
                setEditTarget(null)
              }}
            >
              Cancel
            </FlatButton>
            <FlatButton size="sm" onClick={saveEdit} disabled={!editTarget?.row.name.trim()}>
              Save
            </FlatButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FunderSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("border-t border-border/60 pt-10", className)}>{children}</section>
}

function GrantFinancialsLifecyclePlaceholder({ bucket, stage }: { bucket: GrantLifecycleBucket; stage: Stage }) {
  const isProspecting = bucket === "prospecting"
  return (
    <div id="highlight-budget_spend" className="space-y-8" aria-busy="true">
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 p-6 sm:p-8">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">Financials</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {isProspecting ? (
            <>
              Status is <strong className="font-medium text-foreground">{stage}</strong> — spend-down, reimbursement pacing, and line-item budget
              stay empty until the opportunity is <strong className="font-medium text-foreground">Awarded - Active</strong>. Use Overview and
              Opportunity for prospecting work; nothing here syncs to finance yet.
            </>
          ) : (
            <>
              This grant is in a terminal stage (<strong className="font-medium text-foreground">{stage}</strong>). Live spend-down controls and
              QuickBooks-style feeds are hidden in this prototype; export from Documents and Activity if you need the historical packet.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-8 border-b border-border/60 pb-6 sm:grid-cols-2 lg:grid-cols-4">
        {["Award amount", "Spent", "Remaining", "Burn / mo"].map((label) => (
          <div key={label} className="space-y-2">
            <div className="text-[12px] text-muted-foreground">{label}</div>
            <div className="h-9 w-[min(100%,12rem)] animate-pulse rounded-md bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted/80" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="flex justify-between">
          <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted/80" />
        </div>
        <div className="divide-y divide-border/60 px-4 py-2 sm:px-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="h-3 min-w-0 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-muted/80" />
              <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-muted/80" />
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[12.5px] text-muted-foreground">
        {isProspecting ? "Connect accounting after award to populate this tab." : "Financial detail is intentionally minimized post-close."}
      </p>
    </div>
  )
}

function HBarRow({ label, pct, muted }: { label: string; pct: number; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3.5 py-2 sm:grid-cols-[minmax(0,180px)_1fr_3rem]">
      <div className="text-[13px] text-foreground/90">{label}</div>
      <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", muted ? "bg-muted-foreground/45" : "bg-foreground")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-[12.5px] font-medium tabular-nums text-foreground">{pct}%</div>
    </div>
  )
}

function BoardAvatar({ initials, bg }: { initials: string; bg: string }) {
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-white"
      style={{ backgroundColor: bg }}
    >
      {initials}
    </span>
  )
}

const DEFAULT_PRIORITY_BY_GROUP: Record<ProjectGroup, string[]> = {
  "Health Equity": [
    "Care access and continuity",
    "Community governance of data",
    "Equity metrics and disaggregation",
    "Workforce pipelines into care",
    "Partner accountability",
  ],
  Workforce: [
    "Earned-income and wage progression",
    "Employer and training partnerships",
    "Credential and placement outcomes",
    "Support services that remove barriers",
    "Evaluation proportionate to scale",
  ],
  "General Op": [
    "Organizational resilience",
    "Cash runway and reserves",
    "Shared measurement with peers",
    "Cohort learning participation",
    "Subgrantee health",
  ],
  Capacity: [
    "Technical assistance depth",
    "Backbone coordination",
    "Regional coverage",
    "Sustainability past grant",
    "Knowledge products",
  ],
  Research: [
    "IRB and community oversight",
    "Data stewardship",
    "Dissemination plan",
    "Field site readiness",
    "Interdisciplinary team",
  ],
}

const DEFAULT_FUNDING_USES: Record<ProjectGroup, string[]> = {
  "Health Equity": ["Direct services", "Data & reporting", "Partner contracts", "Evaluation"],
  Workforce: ["Instruction & training", "Stipends", "Employer incentives", "Systems"],
  "General Op": ["Core staffing", "Facilities", "Professional services", "Reserves policy"],
  Capacity: ["TA delivery", "Convenings", "Tools & licenses", "Travel"],
  Research: ["Personnel", "Participant support", "Data use agreements", "Publication"],
}

function defaultEligibleApplicants(g: Grant): string[] {
  if (g.opportunityEligibleApplicants?.length) return g.opportunityEligibleApplicants
  if (g.funderType === "Federal") {
    return [
      "501(c)(3) or governmental prime applicants (per NOFO)",
      "Federally recognized Tribal organizations where applicable",
      "Subrecipients under executed subaward agreements",
    ]
  }
  return [
    "501(c)(3) public charities",
    "Government or quasi-government partners (as subrecipient)",
    "Tribal organizations with documented partnership",
  ]
}

function defaultIneligibilityBullets(g: Grant, prose: string): string[] {
  if (g.ineligibilityBullets?.length) return g.ineligibilityBullets
  const parts = prose
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
  return parts.slice(0, 5)
}

function defaultIrs990GivingTrend(g: Grant): { year: number; amount: number }[] {
  const endY = new Date().getFullYear() - 1
  const w = g.weighted != null && g.award > 0 ? g.weighted / g.award : 0.75
  return Array.from({ length: 5 }, (_, i) => {
    const year = endY - 4 + i
    const base = 2.8 + w * 2.2 + i * 0.35
    return { year, amount: Math.round(base * 10) / 10 }
  })
}

function opportunityPipelineFromCycles(cycles: AppCycle[]): { title: string; desc: string; meta: string }[] {
  const c = cycles.find((x) => x.phase === "current") ?? cycles[0]
  if (!c?.rows?.length) {
    return [
      {
        title: "Letter of intent",
        desc: "Short fit narrative and leadership alignment before full materials.",
        meta: "Rolling until program deadline",
      },
      {
        title: "Full proposal",
        desc: "Program design, budget, outcomes, and compliance attachments.",
        meta: "See portfolio deadline",
      },
      {
        title: "Review & decision",
        desc: "Internal review, funder Q&A, and award setup.",
        meta: "Notification per funder calendar",
      },
    ]
  }
  return c.rows.slice(0, 4).map((r) => ({
    title: r.name,
    desc: `${r.kind === "LOI" ? "Intent, eligibility, and scope statement." : "Full submission packet and attachments."} Tracked in Applications.`,
    meta:
      r.submissionDate && r.submissionDate !== "—"
        ? `Submission: ${r.submissionDate} · ${appStatusLabel(r.status)}`
        : `In workspace · ${appStatusLabel(r.status)}`,
  }))
}

function splitGrantSummary(text: string): { first: string; second?: string } {
  const idx = text.indexOf(". ")
  if (idx === -1 || idx > text.length * 0.55) return { first: text }
  const first = text.slice(0, idx + 1).trim()
  const second = text.slice(idx + 2).trim()
  if (second.length < 60) return { first: text }
  return { first, second }
}

export function GrantDetailsPage({
  grantId,
  issueHighlight,
  onDismissHighlight,
}: {
  grantId: string
  issueHighlight?: IssueNavigationContext | null
  onDismissHighlight?: () => void
}) {
  const grant = grants.find((g) => g.id === grantId) || grants[0]
  const owner = team.find((t) => t.id === grant.ownerId) || team[0]
  const { appCycles, setAppCycles } = useApplicationCyclesForGrant(grantId, grant.ownerId)
  const [mainTab, setMainTab] = useState<MainTab>("overview")
  const [oppTab, setOppTab] = useState<OppTab>("overview")
  const [ownerId, setOwnerId] = useState(grant.ownerId)
  const [expandedTask, setExpandedTask] = useState<string | null>(() => {
    const g = grants.find((x) => x.id === grantId) || grants[0]
    const list = seedTasksByBucket(grantLifecycleBucket(g.stage), g.ownerId)
    return list[0]?.id ?? null
  })
  const [metric, setMetric] = useState<TrendMetric>("giving")
  const [ownerSearch, setOwnerSearch] = useState("")
  const [budgetSeg, setBudgetSeg] = useState<"category" | "month" | "site">("category")
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    personnel: true,
    indirect: true,
    equipment: true,
    travel: false,
    evaluation: false,
  })
  const [budgetQuery, setBudgetQuery] = useState("")
  const [taskComposer, setTaskComposer] = useState<Record<string, string>>({})
  const [taskUpdates, setTaskUpdates] = useState<Record<string, TaskThreadEntry[]>>(() => {
    const g = grants.find((x) => x.id === grantId) || grants[0]
    return seedTaskThreadsByBucket(grantLifecycleBucket(g.stage))
  })
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>({})
  const [activityComposer, setActivityComposer] = useState("")
  const [auditDays, setAuditDays] = useState(() => {
    const g = grants.find((x) => x.id === grantId) || grants[0]
    return buildAuditSeedByBucket(grantLifecycleBucket(g.stage))
  })
  const [showOlderAudit, setShowOlderAudit] = useState(false)
  const [auditDateRange, setAuditDateRange] = useState<AuditDateRangePreset>("12m")
  const [auditOwnerFilter, setAuditOwnerFilter] = useState<string>("all")
  const [auditStageFilter, setAuditStageFilter] = useState<Stage | "all">("all")
  const [tasks, setTasks] = useState<TaskRowDef[]>(() => {
    const g = grants.find((x) => x.id === grantId) || grants[0]
    return seedTasksByBucket(grantLifecycleBucket(g.stage), g.ownerId)
  })
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskSub, setNewTaskSub] = useState("")
  const [newTaskDesc, setNewTaskDesc] = useState("")
  const [newTaskDue, setNewTaskDue] = useState("")
  const [budgetDragActive, setBudgetDragActive] = useState(false)
  const [parsedDocs, setParsedDocs] = useState<ParsedDoc[]>([])
  const budgetFileInputRef = useRef<HTMLInputElement | null>(null)
  const docFileInputRef = useRef<HTMLInputElement | null>(null)
  const [openDocFolders, setOpenDocFolders] = useState<Record<string, boolean>>(() => ({
    agreements: true,
    application: true,
    financials: true,
    deliverables: true,
    reports: true,
  }))
  const [docQuery, setDocQuery] = useState("")
  const [grantStage, setGrantStage] = useState<Stage>(grant.stage)
  const [docPreviewFile, setDocPreviewFile] = useState<DocItem | null>(null)
  const grantDisplayName = useMemo(() => grantDisplayTitle(grant), [grant.title, grant.funder])
  const activeHighlight = issueHighlight ?? null

  const dismissActiveHighlight = () => {
    onDismissHighlight?.()
  }

  const lifecycleBucket = useMemo(() => grantLifecycleBucket(grantStage), [grantStage])

  const overviewNarrative = useMemo(() => resolvedProgramSummary(grant, grantStage), [grant, grantStage])
  const projectLocationBody = useMemo(() => resolvedProjectLocation(grant), [grant])
  const residencyLocationBody = useMemo(() => resolvedResidencyLocation(grant), [grant])
  const irs990SnapshotBody = useMemo(() => resolvedIrs990Snapshot(grant), [grant])
  const ineligibilityBody = useMemo(() => resolvedIneligibility(grant), [grant])
  const opportunityComplianceEtc = useMemo(() => resolvedOpportunityComplianceEtc(grant), [grant])
  const portfolioDeadlineLong = useMemo(() => formatPortfolioDeadline(grant.deadline), [grant.deadline])
  const portfolioDeadlineRelative = useMemo(() => deadlineRelativeLabel(grant.daysToDeadline), [grant.daysToDeadline])

  const oppPriorityAreas = useMemo(
    () => grant.opportunityPriorityAreas ?? DEFAULT_PRIORITY_BY_GROUP[grant.projectGroup],
    [grant],
  )
  const oppFundingUses = useMemo(
    () => grant.opportunityFundingUses ?? DEFAULT_FUNDING_USES[grant.projectGroup],
    [grant],
  )
  const oppEligibleApplicants = useMemo(() => defaultEligibleApplicants(grant), [grant])
  const oppIneligibilityBullets = useMemo(
    () => defaultIneligibilityBullets(grant, ineligibilityBody),
    [grant, ineligibilityBody],
  )
  const oppPipeline = useMemo(() => opportunityPipelineFromCycles(appCycles), [appCycles])
  const oppSummaryParts = useMemo(() => splitGrantSummary(overviewNarrative), [overviewNarrative])
  const oppOverviewLead = useMemo(() => {
    if (grant.funderType === "Federal") {
      return "Federal opportunities are bounded by statute, the published NOFO, and uniform guidance on allowable costs, indirect rates, and audit thresholds—planning here should mirror what grants management will defend in reimbursement and single audit."
    }
    return "Philanthropic opportunities reward crisp outcomes logic, credible budgets, and governance that can carry multi-year reporting—use this overview to align program, finance, and grants before anything hits the portal."
  }, [grant.funderType])

  const funderMark = useMemo(() => {
    const letters = grant.funder.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter(Boolean)
    const a = letters[0]?.charAt(0) ?? "?"
    const b = letters[1]?.charAt(0) ?? letters[0]?.charAt(1) ?? "?"
    return `${a}${b}`.toUpperCase()
  }, [grant.funder])

  const opportunityAwardBand = useMemo(() => {
    const floor = Math.min(grant.weighted ?? grant.award * 0.35, grant.award * 0.95)
    const ceil = Math.max(grant.award * 1.05, grant.award)
    return `${money(Math.round(floor))} – ${money(Math.round(ceil))}`
  }, [grant.award, grant.weighted])

  const irs990FigureRows = useMemo(() => {
    const m = grant.irs990Metrics
    const subs = ["Latest filing (demo)", "Portfolio context", "Comparable awards"]
    const isDash = (v: string) => v === "—" || v === "–" || v.trim() === ""

    const assetDemo = Math.round(Math.max(6_500_000, grant.award * 14 + grant.id.length * 1_250_000))
    const givingDemo = Math.round(Math.max(750_000, grant.award * 9 + grant.award * 0.15))
    const totalAssets =
      grant.funderType === "Federal"
        ? "Prime financial statements (A-133)"
        : money(assetDemo)
    const annualGiving =
      grant.funderType === "Federal" ? money(Math.round(grant.award * 1.05 + 120_000)) : money(givingDemo)

    const defaultAssetsRow = {
      label: "Total assets",
      value: totalAssets,
      sub: grant.funderType === "Federal" ? "Not a 990-PF funder stream" : "Modeled from comparable 990-PF (demo)",
    }
    const defaultGivingRow = {
      label: "Annual giving",
      value: annualGiving,
      sub: grant.funderType === "Federal" ? "Obligations / drawdowns window (demo)" : "Fiscal footprint vs. median award (demo)",
    }
    const defaultAvgRow = {
      label: "Avg award",
      value: m?.find((r) => /median/i.test(r.label))?.value ?? opportunityAwardBand,
      sub: "Planning band",
    }

    const slot = (
      match: (label: string) => boolean,
      fallback: { label: string; value: string; sub: string },
      subIndex: number,
    ) => {
      const hit = m?.find((r) => match(r.label))
      if (!hit) return { ...fallback, sub: subs[subIndex] ?? fallback.sub }
      const value = isDash(hit.value) ? fallback.value : hit.value
      return { label: hit.label, value, sub: subs[subIndex] ?? fallback.sub }
    }

    if (m && m.length >= 3) {
      return m.slice(0, 3).map((row, i) => ({
        label: row.label,
        value: isDash(row.value)
          ? /total assets/i.test(row.label)
            ? totalAssets
            : /annual giving|grants paid/i.test(row.label)
              ? annualGiving
              : /median|avg/i.test(row.label)
                ? defaultAvgRow.value
                : row.value
          : row.value,
        sub: subs[i] ?? "—",
      }))
    }

    return [
      slot((label) => /total assets/i.test(label), defaultAssetsRow, 0),
      slot((label) => /annual giving|grants paid/i.test(label), defaultGivingRow, 1),
      slot((label) => /median|avg award/i.test(label), defaultAvgRow, 2),
    ]
  }, [grant, opportunityAwardBand])
  const givingTrendChartData = useMemo(
    () => grant.irs990GivingTrend ?? defaultIrs990GivingTrend(grant),
    [grant],
  )
  const last990Year = givingTrendChartData[givingTrendChartData.length - 1]?.year ?? new Date().getFullYear() - 1

  const overviewWorkflows = useMemo(() => {
    if (lifecycleBucket === "prospecting") {
      return {
        subtitle: "2 active workstreams · 1 waiting on calendar",
        items: [
          {
            tag: "Discovery",
            title: "PO intro + eligibility check",
            sub: "Confirm cohort fit, indirect rules, and match expectations before drafting the LOI.",
            w: 38,
            foot: "2 of 5 steps",
            blocked: false,
          },
          {
            tag: "Positioning",
            title: "Internal opportunity narrative",
            sub: "Leadership-ready story: outcomes, equity framing, and rough order-of-magnitude only.",
            w: 55,
            foot: "3 of 6 steps",
            blocked: false,
          },
          {
            tag: "Research",
            title: "Competitive / portfolio scan",
            sub: "Waiting on comparable awards list from Research before locking ask size.",
            w: 15,
            foot: "1 of 4 steps",
            blocked: true,
          },
        ],
      }
    }
    if (lifecycleBucket === "terminal") {
      return {
        subtitle: "0 active workflows · closeout complete",
        items: [
          {
            tag: "Archive",
            title: "Finalize grant folder + retention",
            sub: "Signed agreements, portal PDFs, and finance close packet in long-term storage.",
            w: 92,
            foot: "5 of 5 steps",
            blocked: false,
          },
          {
            tag: "Handoff",
            title: "Program sustainment briefing",
            sub: "Document any obligations that continue after the formal award ends (data, participants).",
            w: 40,
            foot: "2 of 4 steps",
            blocked: false,
          },
          {
            tag: "Lessons",
            title: "Portfolio debrief (optional)",
            sub: "Capture renewal learnings for the next cycle with this funder.",
            w: 10,
            foot: "0 of 3 steps",
            blocked: false,
          },
        ],
      }
    }
    return {
      subtitle: "3 active workflows · 1 blocked",
      items: [
        {
          tag: "Drawdown",
          title: "Submit Q2 drawdown",
          sub: "$112K personnel + indirect, approved by Dr. Patel.",
          w: 75,
          foot: "3 of 4 steps",
          blocked: false,
        },
        {
          tag: "Reporting",
          title: "Mid-year progress report",
          sub: "Funder updated template; new equity metrics required. Due May 31.",
          w: 25,
          foot: "1 of 4 steps",
          blocked: false,
        },
        {
          tag: "Risk · blocked",
          title: "Hartford budget realignment",
          sub: "CFO sign-off needed before formal request.",
          w: 10,
          foot: "0 of 5 steps",
          blocked: true,
        },
      ],
    }
  }, [lifecycleBucket])

  const overviewKeyDates = useMemo(() => {
    if (lifecycleBucket === "prospecting") {
      return [
        { l: "Discovery call target", v: "May 16, 2026", sub: "in 5 days", urgent: true },
        { l: "Internal go / no-go", v: "May 22, 2026", sub: "in 11 days" },
        { l: "LOI draft ready", v: "Jun 4, 2026", sub: "in 24 days" },
        { l: "Funder office hours", v: "Jun 12, 2026", sub: "TBC · RSVP" },
      ]
    }
    if (lifecycleBucket === "terminal") {
      return [
        { l: "Record archived", v: "May 2, 2026", sub: "complete" },
        { l: "Final narrative filed", v: "Apr 28, 2026", sub: "complete" },
        { l: "Finance sign-off", v: "Apr 21, 2026", sub: "complete" },
        { l: "Retention through", v: "May 2033", sub: "7-year policy" },
      ]
    }
    return [
      { l: "Mid-year report", v: "May 31, 2026", sub: "in 23 days", urgent: true },
      { l: "Q2 drawdown", v: "May 5, 2026", sub: "3 days late", late: true },
      { l: "Site visit · HRSA", v: "Jun 3, 2026", sub: "in 26 days" },
      { l: "Annual report", v: "Sep 1, 2026", sub: "in 116 days" },
    ]
  }, [lifecycleBucket])

  const currentOwner = team.find((t) => t.id === ownerId) || owner
  const collaborators = team.filter((t) => ["grace", "laurie", "nina"].includes(t.id))

  const award = grant.award || 487500
  const spent = Math.round(award * 0.378)
  const drawnPct = Math.min(100, Math.round((spent / award) * 100))

  const displayedAuditDays = useMemo(
    () => (showOlderAudit ? [...auditDays, ...OLDER_AUDIT_DAYS] : auditDays),
    [auditDays, showOlderAudit],
  )

  const visibleAuditDays = useMemo(
    () => filterAuditDayGroups(displayedAuditDays, auditDateRange, auditOwnerFilter, auditStageFilter),
    [displayedAuditDays, auditDateRange, auditOwnerFilter, auditStageFilter],
  )

  const activityAiSummary = useMemo(() => {
    const newest = auditDays[0]?.day ?? "recent activity"
    const newestHead = newest.split(" ·")[0] ?? newest
    const oldest = auditDays[auditDays.length - 1]?.day.split(" ·")[0] ?? "Apr 14"
    if (lifecycleBucket === "prospecting") {
      return `Since ${oldest}: the team advanced funder fit work, refreshed opportunity context from 990s, and aligned on a discovery call agenda. ${newestHead} — Laurie summarized NOFO alignment; Maria updated the lifecycle stage for visibility. Financial tabs stay skeletal until an award exists.`
    }
    if (lifecycleBucket === "terminal") {
      return `Since ${oldest}: closeout artifacts were finalized and the record moved to a terminal lifecycle state. ${newestHead} — Maria confirmed exports and sign-offs; remaining items are archival and handoff, not spend-down.`
    }
    return `Since ${oldest}: award amount was updated, a Q2 drawdown was approved, and Epic flagged Hartford utilization above plan. ${newestHead} — Maria noted flexibility on budget lines with the PO; Laurie is holding logic-model changes until CFO review. Mid-year template now requires two additional equity metrics.`
  }, [auditDays, lifecycleBucket])

  const filteredBudget = useMemo(() => {
    const q = budgetQuery.trim().toLowerCase()
    return BUDGET_CATEGORIES.map((cat) => {
      const lines = cat.lines.filter((line) => {
        if (budgetSeg === "month" && line.cadence === "as needed") return false
        if (budgetSeg === "site" && line.site === "All sites") return false
        if (!q) return true
        return (
          line.name.toLowerCase().includes(q) ||
          line.cadence.toLowerCase().includes(q) ||
          line.site.toLowerCase().includes(q)
        )
      })
      return { ...cat, lines }
    }).filter((c) => c.lines.length > 0)
  }, [budgetQuery, budgetSeg])

  const budgetFilteredTotals = useMemo(() => {
    let b = 0
    let s = 0
    let r = 0
    for (const c of filteredBudget) {
      for (const l of c.lines) {
        b += l.budgeted
        s += l.spent
        r += l.remaining
      }
    }
    const util = b > 0 ? Math.round((s / b) * 100) : 0
    return { b, s, r, util }
  }, [filteredBudget])

  const postTaskUpdate = (taskId: string) => {
    const raw = taskComposer[taskId] ?? ""
    const body = raw.trim()
    if (!body) return
    const author = authorFromMember(currentOwner)
    const entry: TaskThreadEntry = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: "Just now",
      body,
      author,
    }
    setTaskUpdates((prev) => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), entry] }))
    setTaskComposer((prev) => ({ ...prev, [taskId]: "" }))
  }

  const postActivityNote = () => {
    const body = activityComposer.trim()
    if (!body) return
    const author = authorFromMember(currentOwner)
    const item: AuditItem = {
      kind: "note",
      id: `live-${Date.now()}`,
      actor: author,
      time: "Just now",
      action: "added a note",
      content: body,
    }
    setAuditDays((prev) => {
      const next = [...prev]
      const headDay = prev[0]?.day ?? "May 8 · Today"
      const todayIso = new Date().toISOString().slice(0, 10)
      const i = next.findIndex((d) => d.day === headDay)
      if (i >= 0) {
        const g = next[i]
        next[i] = { ...g, sortDate: g.sortDate ?? todayIso, items: [item, ...g.items] }
      } else next.unshift({ day: headDay, items: [item], sortDate: todayIso })
      return next
    })
    setActivityComposer("")
  }

  const hk = activeHighlight?.fieldKey

  useLayoutEffect(() => {
    setGrantStage(grant.stage)
    setOwnerId(grant.ownerId)
  }, [grantId, grant.stage, grant.ownerId])

  useEffect(() => {
    const bucket = grantLifecycleBucket(grantStage)
    const seeded = seedTasksByBucket(bucket, ownerId)
    setTasks(seeded)
    setTaskUpdates(seedTaskThreadsByBucket(bucket))
    setAuditDays(buildAuditSeedByBucket(bucket))
    setExpandedTask(seeded[0]?.id ?? null)
    setTaskDone({})
    setTaskComposer({})
    setShowOlderAudit(false)
    setAuditDateRange("12m")
    setAuditOwnerFilter("all")
    setAuditStageFilter("all")
    // ownerId omitted from deps: changing owner alone should not wipe tasks; after navigation, layout syncs owner before this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantStage, grantId])

  /** Run before paint so Take action from My work lands on the right tab immediately (not a flash of Overview). */
  useLayoutEffect(() => {
    if (!activeHighlight) return
    const k = activeHighlight.fieldKey
    if (k === "budget_spend") setMainTab("financials")
    else if (k === "logic_model" || k === "full_application" || k === "submit_application") setMainTab("applications")
    else if (k === "grant_documents") setMainTab("documents")
    else setMainTab("overview")
  }, [activeHighlight])

  useEffect(() => {
    if (!hk) return
    const t = window.setTimeout(() => {
      document.getElementById(`highlight-${hk}`)?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 120)
    return () => window.clearTimeout(t)
  }, [hk, mainTab])

  const filteredTeam = team.filter(
    (m) =>
      m.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
      m.role.toLowerCase().includes(ownerSearch.toLowerCase()),
  )

  const olderEventCount = useMemo(() => OLDER_AUDIT_DAYS.reduce((s, d) => s + d.items.length, 0), [])

  const grantShareUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    try {
      const u = new URL(window.location.href)
      u.searchParams.set("grant", grantId)
      return u.toString()
    } catch {
      return window.location.href
    }
  }, [grantId])

  const shareGrant = async () => {
    const url = grantShareUrl || (typeof window !== "undefined" ? window.location.href : "")
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: grantDisplayName,
          text: `${grant.id} · ${grantStage}`,
          url,
        })
        toast.success("Shared")
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.message("Share cancelled")
      }
    } else {
      const ok = await copyTextToClipboard(url)
      if (ok) toast.success("Link copied", { description: "Native share isn’t available in this browser." })
      else toast.error("Could not copy link")
    }
  }

  const copyGrantLink = async () => {
    const url = grantShareUrl || (typeof window !== "undefined" ? window.location.href : "")
    const ok = await copyTextToClipboard(url)
    if (ok) toast.success("Link copied to clipboard")
    else toast.error("Could not copy link")
  }

  const copyGrantId = async () => {
    const ok = await copyTextToClipboard(grant.id)
    if (ok) toast.success("Grant ID copied")
    else toast.error("Could not copy")
  }

  const downloadGrantSummary = () => {
    const body = [
      grantDisplayName,
      `Grant ID: ${grant.id}`,
      `Funder: ${grant.funder}`,
      `Stage: ${grantStage}`,
      `Owner: ${currentOwner.name}`,
      `Period: ${grant.period ?? "—"}`,
      "",
      `Exported ${new Date().toISOString().slice(0, 10)}`,
    ].join("\n")
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" })
    const a = document.createElement("a")
    const href = URL.createObjectURL(blob)
    a.href = href
    a.download = `${grant.id}-summary.txt`
    a.click()
    URL.revokeObjectURL(href)
    toast.success("Download started", { description: `${grant.id}-summary.txt` })
  }

  const duplicateGrant = () => {
    toast.success("Grant duplicated", { description: `Draft: ${grant.id}-copy (prototype)` })
  }

  const filteredDocFolders = useMemo(() => {
    const q = docQuery.trim().toLowerCase()
    if (!q) return DOC_FOLDERS
    return DOC_FOLDERS.map((f) => ({
      ...f,
      files: f.files.filter((file) => file.name.toLowerCase().includes(q) || file.ext.toLowerCase().includes(q)),
    })).filter((f) => f.files.length > 0)
  }, [docQuery])

  const totalDocCount = useMemo(() => DOC_FOLDERS.reduce((n, f) => n + f.files.length, 0), [])

  const handleBudgetDrop = (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    arr.forEach((file) => {
      const id = `pd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const ext = file.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"
      setParsedDocs((prev) => [
        { id, name: file.name, size: formatBytes(file.size), ext, status: "uploading", progress: 0 },
        ...prev,
      ])
      let p = 0
      const tick = () => {
        p = Math.min(100, p + 12 + Math.random() * 9)
        const status: ParsedDoc["status"] = p >= 100 ? "ready" : p >= 60 ? "parsing" : "uploading"
        setParsedDocs((prev) => prev.map((d) => (d.id === id ? { ...d, progress: p, status } : d)))
        if (p < 100) window.setTimeout(tick, 200)
      }
      window.setTimeout(tick, 160)
    })
    toast.success(`Parsing ${arr.length} file${arr.length > 1 ? "s" : ""}…`)
  }

  const addNewTask = () => {
    const title = newTaskTitle.trim()
    if (!title) {
      toast.error("Add a task title")
      return
    }
    const id = `t-${Date.now()}`
    setTasks((prev) => [
      ...prev,
      {
        id,
        title,
        sub: newTaskSub.trim() || "General",
        description: newTaskDesc.trim() || "Describe what done looks like for this task.",
        due: newTaskDue.trim() || "TBD",
        ownerId,
      },
    ])
    setTaskUpdates((prev) => ({ ...prev, [id]: [] }))
    setTaskComposer((prev) => ({ ...prev, [id]: "" }))
    setAddTaskOpen(false)
    setNewTaskTitle("")
    setNewTaskSub("")
    setNewTaskDesc("")
    setNewTaskDue("")
    setExpandedTask(id)
    toast.success("Task added")
  }

  return (
    <KpiChartMotionProvider>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {activeHighlight && activeHighlight.fieldKey !== "submit_application" ? (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm text-foreground"
          role="status"
        >
          <p className="min-w-0 leading-snug">
            <span className="font-semibold">Highlighted: {activeHighlight.fieldLabel}</span>
            <span className="text-muted-foreground"> — {activeHighlight.reason}</span>
          </p>
          <button
            type="button"
            onClick={dismissActiveHighlight}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background/80 hover:text-foreground"
            aria-label="Dismiss highlight"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        <button type="button" className="hover:text-foreground" onClick={() => toast("Navigate", { description: "Manage home" })}>
          Manage
        </button>
        <span className="text-muted-foreground/50">/</span>
        <button type="button" className="hover:text-foreground" onClick={() => toast("Navigate", { description: "Active grants" })}>
          Active grants
        </button>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{grantDisplayName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{grant.funder}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>
              Cycle <span className="font-medium text-foreground">{grant.cycle}</span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 max-w-[min(100%,20rem)] gap-2 rounded-lg border-border/60 bg-background px-2.5 font-medium shadow-none hover:bg-muted/60 dark:hover:bg-muted/40"
              >
                <StagePill stage={grantStage} audience="internal" className="max-w-[11rem] shrink truncate text-[10px]" />
                <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Set status</DropdownMenuLabel>
              {stageOrder.map((st) => (
                <DropdownMenuItem
                  key={st}
                  disabled={grantStage === st}
                  onClick={() => {
                    setGrantStage(st)
                    toast.success("Status updated", { description: st })
                  }}
                  className="flex cursor-pointer items-center gap-2 py-2 text-[13px]"
                >
                  <StagePill stage={st} audience="internal" className="max-w-[14rem] shrink text-[10px]" />
                  {grantStage === st ? <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">Current</span> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setGrantStage("Declined")
                  toast.success("Marked as declined")
                }}
              >
                Mark as declined
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                id="highlight-owner"
                className={cn(
                  "h-9 gap-2 rounded-lg border-border/60 bg-background pl-1.5 pr-2 font-medium shadow-none hover:bg-muted/60 dark:hover:bg-muted/40",
                  hk === "owner" && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
                )}
              >
                <MemberAvatar member={currentOwner} className="size-[22px] text-[10px]" />
                <span className="max-w-[10rem] truncate">{currentOwner.name}</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0">
              <div className="border-b border-border/60 p-2">
                <div className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    placeholder="Search teammates…"
                    className="h-7 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <DropdownMenuLabel className="px-2 pt-2 text-[11px]">Owner</DropdownMenuLabel>
              <div className="max-h-56 overflow-y-auto px-1 pb-1">
                {filteredTeam.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    className="gap-2 text-[13px]"
                    onClick={() => {
                      setOwnerId(m.id)
                      toast("Owner updated", { description: m.name })
                    }}
                  >
                    <MemberAvatar member={m} className="size-6 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">{m.role}</div>
                    </div>
                    {m.id === ownerId ? <Check className="size-3.5 shrink-0" /> : null}
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Collaborators · {collaborators.length}</p>
                <div className="mt-2 flex items-center gap-1">
                  {collaborators.map((c, i) => (
                    <MemberAvatar key={c.id} member={c} className={cn("size-6 text-[10px]", i > 0 && "-ml-1.5 ring-2 ring-background")} />
                  ))}
                  <FlatButton variant="ghost" size="sm" className="ml-1 h-7" onClick={() => toast("Add collaborator")}>
                    + Add
                  </FlatButton>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg border-border/60 px-3 font-medium shadow-none hover:bg-muted/60 dark:hover:bg-muted/40"
            onClick={() => void shareGrant()}
          >
            <Share2 className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0 rounded-lg border-border/60 shadow-none hover:bg-muted/60 dark:hover:bg-muted/40"
                aria-label="Grant actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Grant</DropdownMenuLabel>
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={() => void shareGrant()}>
                <Share2 className="size-4 shrink-0 text-muted-foreground" />
                Share…
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={() => void copyGrantLink()}>
                <Copy className="size-4 shrink-0 text-muted-foreground" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={() => void copyGrantId()}>
                <Copy className="size-4 shrink-0 text-muted-foreground" />
                Copy grant ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={downloadGrantSummary}>
                <Download className="size-4 shrink-0 text-muted-foreground" />
                Download summary
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={duplicateGrant}>
                <CopyPlus className="size-4 shrink-0 text-muted-foreground" />
                Duplicate grant
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={() => window.print()}>
                <Printer className="size-4 shrink-0 text-muted-foreground" />
                Print view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main tabs */}
      <div className="flex flex-wrap gap-0 border-b border-border/60">
        {(
          [
            { id: "overview" as const, label: "Overview" },
            { id: "applications" as const, label: "Applications" },
            { id: "financials" as const, label: "Financials" },
            { id: "opportunity" as const, label: "Opportunity" },
            { id: "documents" as const, label: "Documents", badge: totalDocCount },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMainTab(t.id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-[13px] font-medium transition-colors",
              mainTab === t.id
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {"badge" in t ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {mainTab === "overview" ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-14 sm:gap-16">
            <section>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">Pick up where you left off</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">{overviewWorkflows.subtitle}</p>
                </div>
                <FlatButton variant="ghost" size="sm" onClick={() => toast("View all workflows")}>
                  View all
                </FlatButton>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {overviewWorkflows.items.map((w) => (
                  <button
                    key={w.title}
                    type="button"
                    onClick={() => toast(w.title)}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/25",
                      w.blocked && "border-destructive/25",
                    )}
                  >
                    <span className="text-[11.5px] font-medium text-muted-foreground">{w.tag}</span>
                    <span className="font-heading text-[15px] font-semibold leading-snug text-foreground">{w.title}</span>
                    <span className="text-[12.5px] leading-snug text-muted-foreground">{w.sub}</span>
                    <div className="mt-auto h-0.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full bg-foreground/80", w.blocked && "bg-destructive")}
                        style={{ width: `${w.w}%` }}
                      />
                    </div>
                    <div className="flex w-full items-center justify-between text-[12px] text-muted-foreground">
                      <span>{w.foot}</span>
                      <span className="font-medium text-foreground">Continue →</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Key dates */}
            <section>
              <h2 className="mb-4 font-heading text-base font-semibold tracking-tight text-foreground">Key dates</h2>
              <div className="grid gap-6 border-y border-border/60 py-5 sm:grid-cols-2 lg:grid-cols-4">
                {overviewKeyDates.map((d) => (
                  <div key={d.l}>
                    <div className="text-[12px] text-muted-foreground">{d.l}</div>
                    <div className={cn("mt-1.5 text-[15px] font-semibold tracking-tight text-foreground", d.urgent && "text-primary")}>
                      {d.v}
                    </div>
                    <div className={cn("mt-1 text-[12px] text-muted-foreground", d.late && "font-medium text-destructive")}>{d.sub}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Tasks */}
            <section>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">Tasks</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {tasks.filter((t) => !taskDone[t.id]).length} open · {tasks.filter((t) => t.tag).length} flagged
                    {lifecycleBucket === "prospecting" ? " · no award financials yet" : null}
                    {lifecycleBucket === "terminal" ? " · spend-down context is historical" : null}
                  </p>
                </div>
                <FlatButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (addTaskOpen) {
                      setNewTaskTitle("")
                      setNewTaskSub("")
                      setNewTaskDesc("")
                      setNewTaskDue("")
                    }
                    setAddTaskOpen((o) => !o)
                  }}
                >
                  {addTaskOpen ? "Close" : "+ Add task"}
                </FlatButton>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
                <div className="grid grid-cols-[22px_1fr_100px_120px_24px] gap-3 border-b border-border/60 bg-muted/50 px-4 py-2 text-[11.5px] font-medium text-muted-foreground sm:px-5">
                  <span className="col-span-2">Task</span>
                  <span className="hidden sm:inline">Owner</span>
                  <span className="text-right">Due</span>
                  <span />
                </div>
                {addTaskOpen ? (
                  <div className="space-y-2.5 border-b border-border/60 bg-muted/20 px-4 py-3.5 sm:px-5">
                    <div className="text-[11px] font-medium text-muted-foreground">New task</div>
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Title (required)"
                      className="h-8 border-border/60 bg-white text-[12px] shadow-none focus-visible:ring-1 dark:bg-card"
                    />
                    <Input
                      value={newTaskSub}
                      onChange={(e) => setNewTaskSub(e.target.value)}
                      placeholder="Subtitle · e.g. Report · enrollment"
                      className="h-8 border-border/60 bg-white text-[12px] shadow-none focus-visible:ring-1 dark:bg-card"
                    />
                    <Textarea
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      placeholder="Description — what done looks like, links, or constraints"
                      className="min-h-[64px] resize-y border-border/60 bg-white text-[12px] shadow-none focus-visible:ring-1 dark:bg-card"
                    />
                    <Input
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      placeholder="Due · e.g. May 31"
                      className="h-8 border-border/60 bg-white text-[12px] shadow-none focus-visible:ring-1 dark:bg-card"
                    />
                    <div className="flex flex-wrap justify-end gap-2 pt-0.5">
                      <FlatButton variant="outline" size="sm" className="h-7" onClick={() => setAddTaskOpen(false)}>
                        Cancel
                      </FlatButton>
                      <FlatButton size="sm" className="h-7" onClick={addNewTask}>
                        Add task
                      </FlatButton>
                    </div>
                  </div>
                ) : null}
                {tasks.map((task) => {
                  const taskOwner = team.find((m) => m.id === task.ownerId) || currentOwner
                  return (
                  <Collapsible
                    key={task.id}
                    open={expandedTask === task.id}
                    onOpenChange={(o) => setExpandedTask(o ? task.id : null)}
                    className="border-b border-border/50 last:border-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        className="grid cursor-pointer grid-cols-[22px_1fr_100px_120px_24px] items-center gap-3 px-4 py-3 sm:px-5"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setExpandedTask(expandedTask === task.id ? null : task.id)
                          }
                        }}
                      >
                        <button
                          type="button"
                          className={cn(
                            "flex size-4 items-center justify-center rounded border border-border/60 bg-background",
                            taskDone[task.id] && "border-foreground bg-foreground text-primary-foreground",
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            setTaskDone((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                          }}
                        >
                          <Check className={cn("size-2.5", taskDone[task.id] ? "opacity-100" : "opacity-0")} strokeWidth={3} />
                        </button>
                        <div className="min-w-0 text-left">
                          <div className={cn("text-[13.5px] text-foreground", taskDone[task.id] && "text-muted-foreground line-through")}>
                            {task.title}
                            {task.tag ? (
                              <span className="ml-2 inline-flex rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                                {task.tag}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-[12px] text-muted-foreground">{task.sub}</div>
                        </div>
                        <div className="hidden min-w-0 items-center gap-2 sm:flex">
                          <MemberAvatar member={taskOwner} />
                          <span className="truncate text-[12.5px]">{taskOwner.name}</span>
                        </div>
                        <div className={cn("text-right text-[12.5px] text-muted-foreground", task.urgent && "font-medium text-primary")}>
                          {task.due}
                        </div>
                        <ChevronDown
                          className={cn("size-4 shrink-0 justify-self-end text-muted-foreground transition-transform", expandedTask === task.id && "rotate-180")}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 border-t border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Description</div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{task.description}</p>
                        </div>
                        <div className="relative mb-2">
                          <div className="flex items-start gap-3">
                            <MemberAvatar member={currentOwner} className="size-7 text-[10px]" />
                            <div
                              className={cn(
                                "min-w-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-white transition-[box-shadow,border-color] dark:bg-card",
                                "focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
                              )}
                            >
                              <Textarea
                                value={taskComposer[task.id] ?? ""}
                                onChange={(e) => setTaskComposer((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                placeholder="Add an update or @mention a teammate…"
                                className="min-h-[6rem] w-full resize-none border-0 bg-white px-4 py-4 text-sm shadow-none focus-visible:bg-white focus-visible:ring-0 dark:bg-card dark:focus-visible:bg-card"
                              />
                              <div className="flex items-center justify-between border-t border-border/60 bg-white px-4 py-3 dark:bg-card">
                                <div className="flex items-center gap-4">
                                  <FlatButton
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0"
                                    aria-label="Insert mention"
                                    onClick={() =>
                                      setTaskComposer((prev) => ({
                                        ...prev,
                                        [task.id]: `${prev[task.id] ?? ""}@`.trimStart(),
                                      }))
                                    }
                                  >
                                    <AtSign className="size-4" />
                                  </FlatButton>
                                  <FlatButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 px-2.5"
                                    onClick={() => toast("Attach file")}
                                  >
                                    <Paperclip className="size-4" />
                                    Attach
                                  </FlatButton>
                                </div>
                                <FlatButton size="sm" className="h-8 rounded-lg px-4" onClick={() => postTaskUpdate(task.id)}>
                                  Post update
                                </FlatButton>
                              </div>
                            </div>
                          </div>
                        </div>
                        {(taskUpdates[task.id] ?? []).length ? (
                          <div className="space-y-3">
                            {(taskUpdates[task.id] ?? [])
                              .slice()
                              .reverse()
                              .map((u) => (
                                <div key={u.id} className="grid grid-cols-[22px_1fr] gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                                  <span
                                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                                    style={{ backgroundColor: u.author.color }}
                                  >
                                    {u.author.initials}
                                  </span>
                                  <div>
                                    <strong className="font-medium text-foreground">{u.author.name}</strong>{" "}
                                    <span className="text-[11.5px] text-muted-foreground">· {u.at}</span>
                                    <div className="mt-1 text-[12.5px]">{u.body}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-[12.5px] text-muted-foreground">No updates yet.</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  )
                })}
                <FlatButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start rounded-none px-4 py-3 text-left"
                  onClick={() => setAddTaskOpen((o) => !o)}
                >
                  + Add task
                </FlatButton>
              </div>
            </section>

            {/* Activity */}
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">Activity</h2>
                <FlatButton variant="ghost" size="sm" className="h-8" onClick={() => toast("Export")}>
                  Export
                </FlatButton>
              </div>
              <div className="relative mb-6 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-chart-1/[0.07] via-card to-card p-5">
                <div className="flex items-start gap-3.5">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-chart-1/15 text-chart-1">
                    <Sparkles className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13.5px] font-semibold tracking-tight text-foreground">What&apos;s changed</h3>
                      <span className="text-[11.5px] text-muted-foreground">· Updated just now</span>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-foreground/90">{activityAiSummary}</p>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <div
                  className={cn(
                    "min-w-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-white transition-[box-shadow,border-color] dark:bg-card",
                    "focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
                  )}
                >
                  <Textarea
                    value={activityComposer}
                    onChange={(e) => setActivityComposer(e.target.value)}
                    placeholder="Add a note, comment, or @mention a teammate…"
                    className="min-h-[6rem] w-full resize-none border-0 bg-white px-4 py-4 text-sm shadow-none focus-visible:bg-white focus-visible:ring-0 dark:bg-card dark:focus-visible:bg-card"
                  />
                  <div className="flex items-center justify-between border-t border-border/60 bg-white px-4 py-3 dark:bg-card">
                    <div className="flex items-center gap-4">
                      <FlatButton
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        aria-label="Insert mention"
                        onClick={() => setActivityComposer((v) => `${v}@`)}
                      >
                        <AtSign className="size-4" />
                      </FlatButton>
                      <FlatButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2.5"
                        onClick={() => toast("Attach file")}
                      >
                        <Paperclip className="size-4" />
                        Attach
                      </FlatButton>
                    </div>
                    <FlatButton size="sm" className="h-8 shrink-0 rounded-lg px-4" onClick={postActivityNote}>
                      Post note
                    </FlatButton>
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
                <div className="flex flex-col gap-2.5 border-b border-border/60 bg-muted/15 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3 sm:px-5">
                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-medium tracking-wide text-muted-foreground">Date range</span>
                    <Select
                      value={auditDateRange}
                      onValueChange={(v) => setAuditDateRange(v as AuditDateRangePreset)}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-full min-w-[9.5rem] gap-1.5 px-2 text-xs shadow-none hover:shadow-none focus-visible:shadow-none data-[size=sm]:h-7 sm:w-[10.75rem] [&>svg:last-child]:size-3.5"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="12m" className="py-1 pr-7 text-xs">
                          Last 12 months
                        </SelectItem>
                        <SelectItem value="90d" className="py-1 pr-7 text-xs">
                          Last 90 days
                        </SelectItem>
                        <SelectItem value="30d" className="py-1 pr-7 text-xs">
                          Last 30 days
                        </SelectItem>
                        <SelectItem value="all" className="py-1 pr-7 text-xs">
                          All time
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-medium tracking-wide text-muted-foreground">Owner</span>
                    <Select value={auditOwnerFilter} onValueChange={setAuditOwnerFilter}>
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-full min-w-[9.5rem] gap-1.5 px-2 text-xs shadow-none hover:shadow-none focus-visible:shadow-none data-[size=sm]:h-7 sm:w-[10.75rem] [&>svg:last-child]:size-3.5"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                          {auditOwnerFilter === "all" ? (
                            <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Users className="size-2.5" aria-hidden />
                            </span>
                          ) : (
                            <MemberAvatar
                              member={team.find((x) => x.id === auditOwnerFilter) ?? team[0]}
                              className="!size-[18px] shrink-0 text-[7px]"
                            />
                          )}
                          <span className="truncate">
                            {auditOwnerFilter === "all"
                              ? "Everyone"
                              : (team.find((x) => x.id === auditOwnerFilter)?.name ?? "Owner")}
                          </span>
                        </span>
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="all" className="py-1 pr-7 text-xs">
                          <span className="flex items-center gap-2">
                            <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Users className="size-2.5" aria-hidden />
                            </span>
                            Everyone
                          </span>
                        </SelectItem>
                        {team
                          .filter((m) => m.id !== "unassigned")
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id} className="py-1 pr-7 text-xs">
                              <span className="flex items-center gap-2">
                                <MemberAvatar member={m} className="!size-[18px] shrink-0 text-[7px]" />
                                {m.name}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-medium tracking-wide text-muted-foreground">Stage</span>
                    <Select
                      value={auditStageFilter}
                      onValueChange={(v) => setAuditStageFilter(v === "all" ? "all" : (v as Stage))}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-full min-w-[9.5rem] px-2 text-xs shadow-none hover:shadow-none focus-visible:shadow-none data-[size=sm]:h-7 sm:min-w-[12rem] sm:max-w-[22rem] [&>svg:last-child]:size-3.5"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="all" className="py-1 pr-7 text-xs">
                          All stages
                        </SelectItem>
                        {stageOrder.map((s) => (
                          <SelectItem key={s} value={s} className="py-1 pr-7 text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="relative px-4 pb-2 pt-2 sm:px-5">
                  <div
                    className="pointer-events-none absolute bottom-4 left-[28px] top-4 z-0 w-px bg-border sm:left-[32px]"
                    aria-hidden
                  />
                  <div className="relative z-[1] space-y-0 text-[13px]">
                    {visibleAuditDays.length === 0 ? (
                      <p className="py-8 pl-9 text-center text-[13px] text-muted-foreground sm:pl-10">
                        No activity matches these filters.
                      </p>
                    ) : (
                      visibleAuditDays.map((day, dayIdx) => (
                        <div key={`${day.day}-${day.sortDate}-${dayIdx}`} className="relative">
                          <div className="relative z-[2] pl-9 pt-4 first:pt-3">
                            <span className="inline-block rounded-md bg-card px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {day.day}
                            </span>
                          </div>
                          <AuditTimelineItems items={day.items} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {lifecycleBucket === "active" ? (
                  <div className="border-t border-border/60 bg-muted/30 px-4 py-3 text-center sm:px-5">
                    <FlatButton variant="ghost" size="sm" onClick={() => setShowOlderAudit((v) => !v)}>
                      {showOlderAudit ? "Hide older events" : `Show ${olderEventCount} older events`}
                    </FlatButton>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          {/* Rail */}
          <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground px-0.5 pb-1">Snapshot</h2>
            {lifecycleBucket === "active" ? (
              <button
                type="button"
                onClick={() => toast("Spend-down")}
                className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/30"
              >
                <div className="flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
                  <span>Spend-down</span>
                  <span>View →</span>
                </div>
                <div className="font-heading text-xl font-semibold tracking-tight text-foreground">
                  {money(spent)} <span className="text-[12.5px] font-normal text-muted-foreground">of {money(award)}</span>
                </div>
                <div className="h-0.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${drawnPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
                  <span>{drawnPct}% drawn</span>
                  <span className="font-medium text-primary">12 pts behind</span>
                </div>
              </button>
            ) : lifecycleBucket === "prospecting" ? (
              <button
                type="button"
                onClick={() => setMainTab("financials")}
                className="flex flex-col gap-2.5 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-left shadow-xs transition-colors hover:border-primary/30"
              >
                <div className="flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
                  <span>Award financials</span>
                  <span>Preview →</span>
                </div>
                <div className="font-heading text-lg font-semibold tracking-tight text-muted-foreground">Not live yet</div>
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  Spend-down, budget lines, and utilization charts unlock once status is Awarded - Active.
                </p>
                <div className="h-0.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[18%] rounded-full bg-muted-foreground/25" />
                </div>
                <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
                  <span>Weighted pipeline</span>
                  <span className="font-medium text-foreground">{money(grant.weighted ?? grant.award * 0.35)}</span>
                </div>
              </button>
            ) : (
              <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-muted/25 p-4 text-left shadow-xs">
                <div className="flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
                  <span>Award (historical)</span>
                </div>
                <div className="font-heading text-xl font-semibold tracking-tight text-foreground">{money(award)}</div>
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  This grant is in a terminal stage. Use Documents and Activity for the audit trail; live spend-down controls are read-only in this prototype.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMainTab("applications")}
              className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/30"
            >
              <div className="flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
                <span>Application</span>
                <span>View →</span>
              </div>
              <div className="font-heading text-xl font-semibold tracking-tight text-foreground">
                3<span className="text-[12.5px] font-normal text-muted-foreground"> of 7 sections</span>
              </div>
              <div className="h-0.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-foreground/70" style={{ width: "43%" }} />
              </div>
              <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
                <span>Full proposal</span>
                <span className="font-medium text-primary">Due in 4 days</span>
              </div>
            </button>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
                <span>People</span>
                <button type="button" className="hover:text-foreground" onClick={() => toast("Manage people")}>
                  Manage →
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <MemberAvatar member={currentOwner} className="size-7 text-[10.5px]" />
                <div>
                  <div className="text-[13px] font-medium">{currentOwner.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">Owner</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex">
                  {collaborators.map((c, i) => (
                    <MemberAvatar key={c.id} member={c} className={cn("size-5 text-[9.5px]", i > 0 && "-ml-1 ring-2 ring-card")} />
                  ))}
                </div>
                <span className="text-[12px] text-muted-foreground">{collaborators.length} collaborators</span>
              </div>
              <p className="mt-3 text-[11.5px] text-muted-foreground">PO · Dr. Aisha Patel</p>
            </div>
          </aside>
        </div>
      ) : null}

      {mainTab === "applications" ? (
        <div id="highlight-full_application">
          <div id="highlight-submit_application">
            <ApplicationCyclesPanel
              appCycles={appCycles}
              setAppCycles={setAppCycles}
              ownerId={ownerId}
              grant={grant}
              applicationHighlight={activeHighlight?.fieldKey === "submit_application" ? activeHighlight : null}
              onDismissApplicationHighlight={dismissActiveHighlight}
            />
          </div>
        </div>
      ) : null}

      {mainTab === "financials" ? (
        lifecycleBucket !== "active" ? (
          <GrantFinancialsLifecyclePlaceholder bucket={lifecycleBucket} stage={grantStage} />
        ) : (
        <div id="highlight-budget_spend" className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">Spend-down</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">12 points behind plan (prototype)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FlatButton variant="outline" size="sm" onClick={() => toast("Forecast settings")}>
                Forecast settings
              </FlatButton>
              <FlatButton variant="outline" size="sm" onClick={() => toast("Download report")}>
                Download report
              </FlatButton>
            </div>
          </div>
          <div className="grid gap-8 border-b border-border/60 pb-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[12px] text-muted-foreground">Award amount</div>
              <div className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">{money(award)}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">Spent</div>
              <div className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
                {money(spent)} <span className="text-sm font-normal text-chart-2">{drawnPct}%</span>
              </div>
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">Remaining</div>
              <div className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">{money(award - spent)}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">Required burn</div>
              <div className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
                $26.3K<span className="ml-1 text-sm font-normal text-primary">/mo</span>
              </div>
            </div>
          </div>
          <div className="relative pt-8">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 text-center text-[12px] font-medium text-foreground">
              Today
              <span className="mt-1 block h-3.5 w-px bg-muted-foreground/40" />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${drawnPct}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-[12px] text-muted-foreground">
              <span>Start</span>
              <span>Period ends</span>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setBudgetDragActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setBudgetDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setBudgetDragActive(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setBudgetDragActive(false)
              if (e.dataTransfer.files) handleBudgetDrop(e.dataTransfer.files)
            }}
            onClick={() => budgetFileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                budgetFileInputRef.current?.click()
              }
            }}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-5 transition-colors",
              budgetDragActive
                ? "border-primary bg-primary/[0.06]"
                : "border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <input
              ref={budgetFileInputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv,.numbers"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleBudgetDrop(e.target.files)
                e.target.value = ""
              }}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                  budgetDragActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                )}
              >
                <Upload className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-heading text-[14px] font-semibold text-foreground">
                  {budgetDragActive ? "Drop to parse into the budget" : "Drop a budget PDF or spreadsheet to parse"}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  PDF, XLSX, or CSV up to 20 MB · last parsed{" "}
                  <strong className="font-medium text-foreground">Cummings_Budget_Cohort3.pdf</strong> on Apr 28 ·{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      toast("Re-parse queued")
                    }}
                  >
                    re-parse now
                  </button>
                </p>
              </div>
              <FlatButton
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  budgetFileInputRef.current?.click()
                }}
              >
                Choose file
              </FlatButton>
            </div>
            {parsedDocs.length ? (
              <ul className="mt-4 space-y-2 border-t border-border/60 pt-3" onClick={(e) => e.stopPropagation()}>
                {parsedDocs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-semibold",
                        DOC_EXT_COLOR[d.ext] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {d.ext.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate text-[13px] font-medium text-foreground">{d.name}</div>
                        <div className="shrink-0 text-[11.5px] text-muted-foreground">{d.size}</div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-200 ease-out",
                              d.status === "ready" ? "bg-chart-2" : "bg-primary",
                            )}
                            style={{ width: `${d.progress}%` }}
                          />
                        </div>
                        <div className="flex w-[88px] shrink-0 items-center justify-end gap-1 text-[11.5px] font-medium tabular-nums">
                          {d.status === "uploading" ? (
                            <>
                              <Loader2 className="size-3 animate-spin text-primary" />
                              <span className="text-muted-foreground">Uploading</span>
                            </>
                          ) : d.status === "parsing" ? (
                            <>
                              <Loader2 className="size-3 animate-spin text-primary" />
                              <span className="text-muted-foreground">Parsing</span>
                            </>
                          ) : (
                            <>
                              <Check className="size-3 text-chart-2" strokeWidth={3} />
                              <span className="text-chart-2">Ready</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {d.status === "ready" ? (
                      <FlatButton variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => toast(`Review ${d.name}`)}>
                        Review
                      </FlatButton>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={() => setParsedDocs((prev) => prev.filter((p) => p.id !== d.id))}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">Budget</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {BUDGET_CATEGORIES.reduce((n, c) => n + c.lines.length, 0)} line items · synced from agreement Apr 28
                </p>
              </div>
              <div className="flex gap-2">
                <FlatButton variant="outline" size="sm">
                  Settings
                </FlatButton>
                <FlatButton variant="outline" size="sm">
                  Import expenses
                </FlatButton>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
                <div className="flex rounded-lg bg-muted p-0.5">
                  {(
                    [
                      { id: "category" as const, label: "By category" },
                      { id: "month" as const, label: "By month" },
                      { id: "site" as const, label: "By site" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setBudgetSeg(s.id)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-[12.5px] font-medium",
                        budgetSeg === s.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex max-w-[240px] flex-1 items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
                  <Search className="size-3.5 text-muted-foreground" />
                  <Input
                    value={budgetQuery}
                    onChange={(e) => setBudgetQuery(e.target.value)}
                    placeholder="Search line items…"
                    className="h-7 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-[13px] tabular-nums">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[11.5px] font-medium text-muted-foreground">
                      <th className="px-4 py-3">Line item</th>
                      <th className="px-4 py-3">{budgetSeg === "site" ? "Site" : "Date"}</th>
                      <th className="px-4 py-3 text-right">Budgeted</th>
                      <th className="px-4 py-3 text-right">Spent</th>
                      <th className="px-4 py-3 text-right">Remaining</th>
                      <th className="px-4 py-3 text-right">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBudget.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                          No line items match this search or view.
                        </td>
                      </tr>
                    ) : (
                      filteredBudget.map((cat) => (
                        <Fragment key={cat.key}>
                          <tr className="bg-muted/50 font-medium text-foreground">
                            <td className="px-4 py-2.5" colSpan={6}>
                              <button
                                type="button"
                                className="inline-flex items-center gap-2"
                                onClick={() => setOpenCats((o) => ({ ...o, [cat.key]: !o[cat.key] }))}
                              >
                                <ChevronRight className={cn("size-3.5 transition-transform", openCats[cat.key] && "rotate-90")} />
                                {cat.label}
                              </button>
                            </td>
                          </tr>
                          {openCats[cat.key]
                            ? cat.lines.map((line) => (
                                <tr key={line.id} className="border-b border-border/50">
                                  <td className="px-4 py-2.5 pl-10 text-muted-foreground">{line.name}</td>
                                  <td className="text-[12px] text-muted-foreground">
                                    {budgetSeg === "site" ? line.site : line.cadence}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">{money(line.budgeted)}</td>
                                  <td className="px-4 py-2.5 text-right">{money(line.spent)}</td>
                                  <td className="px-4 py-2.5 text-right">{money(line.remaining)}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <div className="inline-flex items-center justify-end gap-2">
                                      <span className="inline-block h-1 w-[60px] rounded-full bg-muted align-middle">
                                        <span
                                          className={cn("block h-full rounded-full bg-primary", line.utilOver && "bg-primary")}
                                          style={{ width: `${Math.min(100, line.util)}%` }}
                                        />
                                      </span>
                                      <span className={cn("min-w-[2.5rem] font-medium tabular-nums", line.utilOver && "text-primary")}>
                                        {line.util}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            : null}
                        </Fragment>
                      ))
                    )}
                    <tr className="border-t border-border/60 bg-muted/50 font-medium text-foreground">
                      <td className="px-4 py-3" colSpan={2}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right">{money(budgetFilteredTotals.b)}</td>
                      <td className="px-4 py-3 text-right">{money(budgetFilteredTotals.s)}</td>
                      <td className="px-4 py-3 text-right">{money(budgetFilteredTotals.r)}</td>
                      <td className="px-4 py-3 text-right">
                        {budgetFilteredTotals.b > 0 ? `${budgetFilteredTotals.util}%` : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 text-[12.5px] text-muted-foreground">
                <span>
                  <strong className="font-medium text-foreground">
                    {filteredBudget.reduce((n, c) => n + c.lines.length, 0)}
                  </strong>{" "}
                  line items shown · last expense <strong className="font-medium text-foreground">Apr 28</strong>
                </span>
                <span>Synced with QuickBooks · 2h ago</span>
              </div>
            </div>
          </div>
        </div>
        )
      ) : null}

      {mainTab === "opportunity" ? (
        <div className="space-y-6">
          <div
            role="tablist"
            aria-label="Opportunity sections"
            className="inline-flex w-fit gap-1 rounded-lg border border-border/60 bg-muted/40 p-1"
          >
            {(
              [
                { id: "overview" as const, label: "Overview" },
                { id: "funder" as const, label: "Funder profile" },
                { id: "details" as const, label: "Award details" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={oppTab === t.id}
                onClick={() => setOppTab(t.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  oppTab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {oppTab === "overview" ? (
            <div className="max-w-4xl pb-4">
              <section className="pb-8 pt-2">
                <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">Grant overview</h2>
                <div className="mt-4 max-w-none space-y-5 text-[15px] leading-[1.65] text-foreground/88">
                  <p className="font-medium text-foreground">{oppOverviewLead}</p>
                  <p>{oppSummaryParts.first}</p>
                  {oppSummaryParts.second ? <p>{oppSummaryParts.second}</p> : null}
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Project footprint:</span> {projectLocationBody}
                  </p>
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Residency / staffing:</span> {residencyLocationBody}
                  </p>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-8 border-t border-border/50 pt-8 md:grid-cols-2 md:gap-x-12">
                  <div>
                    <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority focus areas</h3>
                    <ul className="space-y-2.5">
                      {oppPriorityAreas.map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-[13px] font-medium text-foreground/90">
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Approved funding uses</h3>
                    <div className="flex flex-wrap gap-2">
                      {oppFundingUses.map((use) => (
                        <span
                          key={use}
                          className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-1 text-[11px] font-medium text-foreground/90"
                        >
                          {use}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-6 border-y border-border/60 py-8 md:grid-cols-4 md:gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Region</p>
                  <div className="flex items-start gap-2 font-medium leading-snug text-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="line-clamp-3 text-[13px]">{projectLocationBody}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Application due</p>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Calendar className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-[13px]">{portfolioDeadlineLong}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Grant size</p>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <DollarSign className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-[13px] tabular-nums">{opportunityAwardBand}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Eligibility</p>
                  <div className="flex items-start gap-2 font-medium text-foreground">
                    <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="line-clamp-2 text-[13px]">{oppEligibleApplicants[0]}</span>
                  </div>
                </div>
              </div>

              <hr className="border-border/60" />

              <section className="py-10 md:py-12">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/80">
                      <BarChart3 className="size-5 text-foreground" aria-hidden />
                    </div>
                    <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">990 financial snapshot</h2>
                  </div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">FY {last990Year} (demo)</p>
                </div>
                <div className="grid grid-cols-1 gap-8 border-b border-border/50 pb-10 md:grid-cols-3 md:gap-10">
                  {irs990FigureRows.map((row) => (
                    <div key={row.label} className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{row.label}</p>
                      <p className="font-heading text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">{row.value}</p>
                      <p className="text-[11px] text-muted-foreground">{row.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <TrendingUp className="size-3.5 text-primary" aria-hidden />
                      Annual giving ($M)
                    </h3>
                    <OpportunityGivingTrendChart data={givingTrendChartData} />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5">
                    <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cumulative giving ($M)</h3>
                    <Opportunity990CumulativeAreaChart data={givingTrendChartData} />
                  </div>
                </div>
                <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">{irs990SnapshotBody}</p>
                <div className="mt-6">
                  <FlatButton variant="ghost" size="sm" className="h-8 gap-1.5 px-0 text-xs font-normal" onClick={() => toast("Download 990 analysis")}>
                    Download full 990-PF analysis
                    <Download className="size-3.5" />
                  </FlatButton>
                </div>
              </section>

              <hr className="border-border/60" />

              <section className="py-10 md:py-12">
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/80">
                    <AlertCircle className="size-5 text-foreground" aria-hidden />
                  </div>
                  <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">Eligibility criteria</h2>
                </div>
                <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
                  <div>
                    <h3 className="mb-6 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eligible organizations</h3>
                    <ul className="space-y-4">
                      {oppEligibleApplicants.map((type) => (
                        <li key={type} className="flex items-start gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-primary">
                            <CheckCircle2 className="size-4" aria-hidden />
                          </span>
                          <span className="text-[13px] font-medium leading-snug text-foreground/90">{type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-6 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hard exclusions</h3>
                    <ul className="space-y-3">
                      {oppIneligibilityBullets.map((text) => (
                        <li key={text} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <hr className="border-border/60" />

              <section className="py-10 md:py-12">
                <div className="mb-10 flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/80">
                    <FileText className="size-5 text-foreground" aria-hidden />
                  </div>
                  <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">Application pipeline</h2>
                </div>
                <div className="space-y-0">
                  {oppPipeline.map((item, idx) => (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex w-3 shrink-0 flex-col items-center pt-1">
                        <span
                          className="size-2 shrink-0 rounded-full bg-primary ring-2 ring-primary/20"
                          aria-hidden
                        />
                        {idx < oppPipeline.length - 1 ? (
                          <span className="mt-1 min-h-[2.75rem] w-px flex-1 bg-border/70" aria-hidden />
                        ) : null}
                      </div>
                      <div className={cn("min-w-0 flex-1", idx < oppPipeline.length - 1 ? "pb-5" : "pb-0")}>
                        <h4 className="font-heading text-[15px] font-semibold leading-snug text-foreground">{item.title}</h4>
                        <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted-foreground">{item.desc}</p>
                        <span className="mt-1.5 inline-block rounded-md bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {item.meta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-10">
                  <FlatButton
                    size="sm"
                    className="h-11 w-full gap-2 rounded-xl text-sm font-medium sm:h-12"
                    onClick={() => {
                      setMainTab("applications")
                      toast("Applications", { description: "Continue in the Applications tab." })
                    }}
                  >
                    Begin application
                    <ArrowRight className="size-4" />
                  </FlatButton>
                </div>
                <p className="mt-10 border-t border-border/50 pt-8 text-[12px] leading-relaxed text-muted-foreground">{opportunityComplianceEtc}</p>
              </section>
            </div>
          ) : null}

          {oppTab === "funder" ? (
            <div className="space-y-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-[13px] font-semibold text-background">
                    CF
                  </div>
                  <div>
                    <h3 className="font-heading text-[22px] font-semibold text-foreground">{grant.funder}</h3>
                    <p className="mt-2 flex flex-wrap gap-3 text-[13px] text-muted-foreground">
                      <span>
                        <strong className="font-medium text-foreground">EIN</strong> 04-3406383
                      </span>
                      <span>Woburn, MA</span>
                      <a href="#" className="border-b border-border/60 font-medium text-foreground hover:border-primary" onClick={(e) => e.preventDefault()}>
                        cummingsfoundation.org
                      </a>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <FlatButton variant="outline" size="sm">
                    View 990 PDF
                  </FlatButton>
                  <FlatButton variant="outline" size="sm">
                    Visit site
                  </FlatButton>
                </div>
              </div>
              <div>
                <h4 className="font-heading text-lg font-semibold text-foreground">Key metrics</h4>
                <p className="mt-1 text-[13px] text-muted-foreground">FY 2023 · Form 990</p>
                <div className="mt-4 grid grid-cols-2 gap-0 overflow-hidden rounded-xl border border-border/60 bg-card sm:grid-cols-3 lg:grid-cols-5">
                  {(
                    [
                      { id: "giving" as const, l: "Annual giving", v: "$108M", t: "↑ 12.4% YoY" },
                      { id: "grants" as const, l: "Grants made", v: "847", t: "↑ 6.1% YoY" },
                      { id: "median" as const, l: "Median grant", v: "$45K", t: "→ flat" },
                      { id: "assets" as const, l: "Total assets", v: "$2.8B", t: "↑ 8.2% YoY" },
                      { id: "payout" as const, l: "Payout rate", v: "3.9%", t: "↑ 0.3pts" },
                    ] as const
                  ).map((tile, i, arr) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => setMetric(tile.id)}
                      className={cn(
                        "border-b border-border/60 p-4 text-left transition-colors hover:bg-muted/50 sm:border-b-0 lg:border-r lg:border-border/60",
                        metric === tile.id && "bg-muted/60",
                        i === arr.length - 1 && "lg:border-r-0",
                      )}
                    >
                      <div className="text-[11.5px] text-muted-foreground">{tile.l}</div>
                      <div className="mt-1.5 font-heading text-xl font-semibold tracking-tight text-foreground">{tile.v}</div>
                      <div className={cn("mt-1.5 text-[11.5px] text-muted-foreground", tile.t.startsWith("↑") && "text-chart-2")}>{tile.t}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-heading text-lg font-semibold text-foreground">{TREND[metric].title}</h4>
                <p className="mt-1 text-[13px] text-muted-foreground">Source: IRS Form 990</p>
                <div className="mt-4 flex flex-wrap gap-8 text-[11.5px]">
                  <div>
                    <div className="text-muted-foreground">Latest</div>
                    <div className="mt-1 font-heading text-lg font-semibold">{TREND[metric].latest}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">10-year peak</div>
                    <div className="mt-1 font-heading text-lg font-semibold">{TREND[metric].peak}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">10-year CAGR</div>
                    <div className="mt-1 font-heading text-lg font-semibold text-chart-2">{TREND[metric].cagr}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">vs 5-year avg</div>
                    <div className="mt-1 font-heading text-lg font-semibold text-chart-2">{TREND[metric].vsAvg}</div>
                  </div>
                </div>
                <Funder990TrendChart metric={metric} />
              </div>

              <FunderSection>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg font-semibold text-foreground">Funding focus areas</h4>
                  <p className="text-[13px] text-muted-foreground">2023 · by dollars</p>
                </div>
                <div className="mt-4 space-y-0">
                  <HBarRow label="Workforce & economic mobility" pct={34} />
                  <HBarRow label="Community health" pct={26} muted />
                  <HBarRow label="Education" pct={18} muted />
                  <HBarRow label="Arts & culture" pct={12} muted />
                  <HBarRow label="Other" pct={10} muted />
                </div>
                <p className="mt-4 border-t border-border/60 pt-4 text-[12.5px] leading-relaxed text-muted-foreground">
                  We map to <strong className="font-medium text-foreground">Workforce & economic mobility</strong> — the largest category at
                  34%.
                </p>
              </FunderSection>

              <FunderSection>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg font-semibold text-foreground">Grant size distribution</h4>
                  <p className="text-[13px] text-muted-foreground">all 847 grants in 2023</p>
                </div>
                <Funder990SizeBarChart />
                <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                  Our ask of <strong className="font-medium text-foreground">{money(award)}</strong> sits in the{" "}
                  <strong className="font-medium text-foreground">$250K–$1M band</strong>, which represents only 4.5% of all grants (38 of
                  847). Awards in this band are typically multi-year capacity-building.
                </p>
              </FunderSection>

              <FunderSection>
                <h4 className="font-heading text-lg font-semibold text-foreground">Geographic concentration</h4>
                <div className="mt-4 space-y-0">
                  <HBarRow label="Massachusetts" pct={62} />
                  <HBarRow label="New England (other)" pct={22} muted />
                  <HBarRow label="National programs" pct={11} muted />
                  <HBarRow label="International" pct={5} muted />
                </div>
                <p className="mt-4 border-t border-border/60 pt-4 text-[12.5px] leading-relaxed text-muted-foreground">
                  Our service area (MA, CT) falls within their <strong className="font-medium text-foreground">84% New England concentration</strong>.
                </p>
              </FunderSection>

              <FunderSection>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg font-semibold text-foreground">Application calendar</h4>
                  <p className="text-[13px] text-muted-foreground">how this funder typically operates</p>
                </div>
                <div className="mt-4 grid grid-cols-6 gap-px overflow-hidden rounded-lg border border-border/60 bg-border md:grid-cols-12">
                  {[
                    { m: "Jan", active: false },
                    { m: "Feb", active: false },
                    { m: "Mar", active: true, ev: "LOI open" },
                    { m: "Apr", active: true, ev: "LOI close" },
                    { m: "May", active: true, ev: "Proposal", muted: true },
                    { m: "Jun", active: true, ev: "Review", muted: true },
                    { m: "Jul", active: false },
                    { m: "Aug", active: true, ev: "Decisions" },
                    { m: "Sep", active: true, ev: "Awards" },
                    { m: "Oct", active: false },
                    { m: "Nov", active: false },
                    { m: "Dec", active: false },
                  ].map((cell) => (
                    <div
                      key={cell.m}
                      className={cn(
                        "flex min-h-[60px] flex-col gap-1 bg-card px-1.5 py-2.5 text-center",
                        cell.active && "bg-primary/10",
                      )}
                    >
                      <div className={cn("text-[11.5px] font-medium text-muted-foreground", cell.active && "text-primary")}>{cell.m}</div>
                      {"ev" in cell && cell.ev ? (
                        <div
                          className={cn(
                            "text-[10.5px] font-medium leading-tight text-foreground",
                            "muted" in cell && cell.muted && "font-normal text-muted-foreground",
                          )}
                        >
                          {cell.ev}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-8 sm:grid-cols-3">
                  {[
                    { l: "Avg. decision time", v: "5.2 months", sub: "LOI to award" },
                    { l: "Renewal cadence", v: "2–3 years", sub: "68% of grants renewed" },
                    { l: "Reporting cadence", v: "Mid-year + annual", sub: "2 reports per year" },
                  ].map((s) => (
                    <div key={s.l}>
                      <div className="text-[11.5px] text-muted-foreground">{s.l}</div>
                      <div className="mt-1.5 text-[15px] font-semibold tracking-tight text-foreground">{s.v}</div>
                      <div className="mt-1 text-[11.5px] text-muted-foreground">{s.sub}</div>
                    </div>
                  ))}
                </div>
              </FunderSection>

              <FunderSection>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg font-semibold text-foreground">Comparable grantees</h4>
                  <p className="text-[13px] text-muted-foreground">similar size & focus</p>
                </div>
                <div className="mt-4 divide-y divide-border/60">
                  {[
                    { name: "Boston Workforce Alliance", meta: "Workforce · Cohort 2 · 3-year operating · Boston, MA", amt: "$675K" },
                    { name: "Year Up United", meta: "Workforce · multi-year general operating · Boston, MA", amt: "$520K" },
                    { name: "Bottom Line Inc.", meta: "Education / workforce · 3-year operating · Boston, MA", amt: "$385K" },
                    { name: "Jewish Vocational Service", meta: "Workforce · capacity building · Greater Boston", amt: "$310K" },
                  ].map((g) => (
                    <div key={g.name} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                      <div className="min-w-0">
                        <div className="text-[13.5px] text-foreground">{g.name}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">{g.meta}</div>
                      </div>
                      <div className="shrink-0 text-[13.5px] font-medium tabular-nums text-foreground">{g.amt}</div>
                    </div>
                  ))}
                </div>
              </FunderSection>

              <FunderSection>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg font-semibold text-foreground">Leadership & board</h4>
                  <p className="text-[13px] text-muted-foreground">from 990 Part VII</p>
                </div>
                <div className="mt-4 divide-y divide-border/60">
                  {[
                    { initials: "JC", bg: "var(--chart-1)", name: "Joyce Cummings", role: "Chair · Founder · since 1986", meta: "Volunteer" },
                    { initials: "EM", bg: "var(--chart-2)", name: "Eric Maddox", role: "President · since 2019", meta: money(285000) },
                    { initials: "DH", bg: "var(--chart-4)", name: "Dennis Houston", role: "Treasurer · CFO", meta: money(210000) },
                    { initials: "SK", bg: "var(--chart-3)", name: "Sarah Kim", role: "VP, Programs · Workforce portfolio · our PO supervisor", meta: money(165000) },
                  ].map((p) => (
                    <div key={p.name} className="grid grid-cols-[30px_1fr_auto] items-center gap-3.5 py-3 first:pt-0">
                      <BoardAvatar initials={p.initials} bg={p.bg} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] text-foreground">{p.name}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">{p.role}</div>
                      </div>
                      <div className="shrink-0 text-right text-[12.5px] tabular-nums text-muted-foreground">
                        {p.meta === "Volunteer" ? (
                          p.meta
                        ) : (
                          <span className="font-medium text-foreground">{p.meta}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </FunderSection>

              <FunderSection>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg font-semibold text-foreground">Financial position</h4>
                  <p className="text-[13px] text-muted-foreground">FY 2023 · 990 Part X</p>
                </div>
                <div className="mt-4 grid divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card md:grid-cols-3 md:divide-x">
                  <div className="p-4 md:p-5">
                    <div className="border-b border-border/60 pb-2 text-[11.5px] font-medium text-muted-foreground">Assets</div>
                    <dl className="mt-3 space-y-1.5 text-[13px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Total assets</dt>
                        <dd className="font-medium text-foreground">$2.84B</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Investments</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$2.62B</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Cash & equivalents</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$148M</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Real estate</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$72M</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="border-t border-border/60 p-4 md:border-t-0 md:p-5">
                    <div className="border-b border-border/60 pb-2 text-[11.5px] font-medium text-muted-foreground">Liabilities & expenses</div>
                    <dl className="mt-3 space-y-1.5 text-[13px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Total liabilities</dt>
                        <dd className="font-medium text-foreground">$84M</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Operating expenses</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$14.2M</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Admin overhead</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">9.8%</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Investment fees</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$8.4M</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="border-t border-border/60 p-4 md:border-t-0 md:p-5">
                    <div className="border-b border-border/60 pb-2 text-[11.5px] font-medium text-muted-foreground">Giving requirements</div>
                    <dl className="mt-3 space-y-1.5 text-[13px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Required payout (5%)</dt>
                        <dd className="font-medium text-foreground">$140M</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Actual giving</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$108M</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Carryover obligation</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$32M</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">5-yr giving avg</dt>
                        <dd className="font-medium tabular-nums text-foreground/90">$92M</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 p-4 text-[13px] leading-relaxed text-muted-foreground">
                  Cummings has a $32M payout carryover obligation, suggesting{" "}
                  <strong className="font-medium text-foreground">2024 giving may exceed $140M</strong> to satisfy IRS minimums — favorable
                  timing for new applicants.
                </div>
              </FunderSection>
            </div>
          ) : null}

          {oppTab === "details" ? (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
              <div className="border-b border-border/60 px-5 py-3 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                Award terms
              </div>
              <dl className="divide-y divide-border/60">
                {[
                  ["Range", `${money(250000)} – ${money(750000)}`],
                  ["Term", grant.period ?? "3 years"],
                  ["Match required", grant.matchRequired ? "25%" : "None"],
                  ["Indirect cap", "12.5%"],
                  ["Reporting cadence", "Mid-year (Mar 1) · Annual (Sep 1)"],
                ].map(([dt, dd]) => (
                  <div key={dt} className="grid grid-cols-[minmax(0,160px)_1fr] gap-3 px-5 py-2.5 text-[13px]">
                    <dt className="text-muted-foreground">{dt}</dt>
                    <dd className="text-foreground">{dd}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-border/60 px-5 py-3 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                Funder contacts
              </div>
              <dl className="divide-y divide-border/60">
                {[
                  ["Program officer", "Dr. Aisha Patel · apatel@cummingsfdn.org"],
                  ["Senior PO", "Karen Tao · ktao@cummingsfdn.org"],
                  ["Grants admin", "Robert Jin · rjin@cummingsfdn.org"],
                ].map(([dt, dd]) => (
                  <div key={dt} className="grid grid-cols-[minmax(0,160px)_1fr] gap-3 px-5 py-2.5 text-[13px]">
                    <dt className="text-muted-foreground">{dt}</dt>
                    <dd className="text-foreground">{dd}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      ) : null}

      {mainTab === "documents" ? (
        <div id="highlight-grant_documents" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">Documents</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {totalDocCount} files across {DOC_FOLDERS.length} folders · synced from Drive (prototype)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FlatButton variant="outline" size="sm" onClick={() => toast("New folder")}>
                <Plus className="mr-1 size-3.5" />
                New folder
              </FlatButton>
              <FlatButton size="sm" onClick={() => docFileInputRef.current?.click()}>
                <Upload className="mr-1 size-3.5" />
                Upload
              </FlatButton>
              <input
                ref={docFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const n = e.target.files?.length ?? 0
                  if (n) toast.success(`${n} file${n > 1 ? "s" : ""} queued`)
                  e.target.value = ""
                }}
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
              <div className="flex max-w-[260px] flex-1 items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
                <Search className="size-3.5 text-muted-foreground" />
                <Input
                  value={docQuery}
                  onChange={(e) => setDocQuery(e.target.value)}
                  placeholder="Search files…"
                  className="h-7 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                />
              </div>
              <FlatButton
                variant="ghost"
                size="sm"
                className="ml-auto h-7"
                onClick={() =>
                  setOpenDocFolders((prev) => {
                    const allOpen = DOC_FOLDERS.every((f) => prev[f.id])
                    const next: Record<string, boolean> = {}
                    DOC_FOLDERS.forEach((f) => (next[f.id] = !allOpen))
                    return next
                  })
                }
              >
                {DOC_FOLDERS.every((f) => openDocFolders[f.id]) ? "Collapse all" : "Expand all"}
              </FlatButton>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5 w-[120px]">Type</th>
                    <th className="px-4 py-2.5 w-[110px]">Size</th>
                    <th className="px-4 py-2.5 w-[140px]">Modified</th>
                    <th className="px-4 py-2.5 w-[110px]">Shared</th>
                    <th className="px-4 py-2.5 w-[88px] text-right">Preview</th>
                    <th className="px-4 py-2.5 w-[44px]" />
                  </tr>
                </thead>
                <tbody>
                  {filteredDocFolders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No files match this search.
                      </td>
                    </tr>
                  ) : (
                    filteredDocFolders.map((folder) => {
                      const open = openDocFolders[folder.id] ?? true
                      return (
                        <Fragment key={folder.id}>
                          <tr className="border-b border-border/60 bg-muted/20">
                            <td colSpan={7} className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => setOpenDocFolders((prev) => ({ ...prev, [folder.id]: !open }))}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
                              >
                                <ChevronRight
                                  className={cn(
                                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                    open && "rotate-90",
                                  )}
                                />
                                {open ? (
                                  <FolderOpen className="size-4 shrink-0 text-primary" />
                                ) : (
                                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="font-medium text-foreground">{folder.name}</span>
                                <span className="text-[11.5px] text-muted-foreground">
                                  · {folder.files.length} file{folder.files.length === 1 ? "" : "s"}
                                </span>
                                <span className="ml-2 hidden truncate text-[11.5px] text-muted-foreground sm:inline">
                                  {folder.description}
                                </span>
                              </button>
                            </td>
                          </tr>
                          {open
                            ? folder.files.map((file) => (
                                <tr key={file.id} className="border-b border-border/50">
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2.5 pl-6">
                                      <span
                                        className={cn(
                                          "flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[9.5px] font-semibold",
                                          DOC_EXT_COLOR[file.ext] ?? "bg-muted text-muted-foreground",
                                        )}
                                      >
                                        {file.ext}
                                      </span>
                                      <span className="truncate text-[13px] font-medium text-foreground">{file.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-[12.5px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5">
                                      <FileText className="size-3.5" />
                                      {file.ext}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-[12.5px] tabular-nums text-muted-foreground">{file.size}</td>
                                  <td className="px-4 py-2.5 text-[12.5px] text-muted-foreground">{file.modified}</td>
                                  <td className="px-4 py-2.5 text-[12.5px] text-muted-foreground">
                                    {file.sharedWith ? `${file.sharedWith} people` : "Only you"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <FlatButton
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 px-2"
                                      onClick={() => setDocPreviewFile(file)}
                                    >
                                      <Eye className="size-3.5" />
                                      Preview
                                    </FlatButton>
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button
                                      type="button"
                                      aria-label="More actions"
                                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                      onClick={() => toast(`More — ${file.name}`)}
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            : null}
                        </Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 text-[12.5px] text-muted-foreground">
              <span>
                <strong className="font-medium text-foreground">{filteredDocFolders.reduce((n, f) => n + f.files.length, 0)}</strong>{" "}
                files shown · last sync <strong className="font-medium text-foreground">2 min ago</strong>
              </span>
              <FlatButton variant="ghost" size="sm" className="h-7" onClick={() => toast("Drive settings")}>
                Drive settings →
              </FlatButton>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={docPreviewFile !== null} onOpenChange={(open) => !open && setDocPreviewFile(null)}>
        <DialogContent className="sm:max-w-lg">
          {docPreviewFile ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{docPreviewFile.name}</DialogTitle>
                <DialogDescription>
                  {docPreviewFile.ext} · {docPreviewFile.size} · Modified {docPreviewFile.modified}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-border/60 bg-muted/25 p-4">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Quick preview for{" "}
                  <strong className="font-medium text-foreground">{docPreviewFile.name}</strong>. Open in Drive for the full document.
                </p>
                <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-border/60 bg-card text-center text-[12px] text-muted-foreground">
                  {docPreviewFile.ext === "PDF"
                    ? "PDF preview loads here (prototype)."
                    : docPreviewFile.ext === "XLS"
                      ? "Spreadsheet preview loads here (prototype)."
                      : "Document preview loads here (prototype)."}
                </div>
              </div>
              <DialogFooter>
                <FlatButton variant="outline" onClick={() => setDocPreviewFile(null)}>
                  Close
                </FlatButton>
                <FlatButton onClick={() => toast("Open in Drive", { description: docPreviewFile.name })}>Open in Drive</FlatButton>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
    </KpiChartMotionProvider>
  )
}
