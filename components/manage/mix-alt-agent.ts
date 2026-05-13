import type { ChatSource, ChatViz } from "@/components/manage/chat-inline-viz"
import type { Grain } from "@/components/manage/grain-bar"
import type { ActionItem, Grant, IssueNavigationContext, FunderType } from "@/lib/manage/types"
import { team, RACINE_COMMUNITY_FOUNDATION_GRANT_ID } from "@/lib/manage/data"
import type { ColKey, GroupBy, SortDir } from "@/components/manage/all-grants"

export type MixAltEffect =
  | { type: "set_owner_filter"; ownerId: string }
  | { type: "clear_owner_filter" }
  | { type: "set_foundation_filter" }
  | { type: "clear_foundation_filter" }
  | { type: "set_threshold"; days: number }
  | { type: "snooze_upcoming" }
  | { type: "set_discovery"; deadlineNextMonth: boolean; tasksNone: boolean }
  | { type: "clear_discovery" }
  | { type: "add_saved_view_label"; label: string }
  /** Open Save view dialog; optional name prefills the input (user confirms). */
  | { type: "open_save_view_dialog"; suggestedName?: string }
  | { type: "set_group_by"; groupBy: GroupBy }
  | { type: "clear_grant_toolbar_filters" }
  | { type: "set_funder_type_filter"; funderType: FunderType | null }
  | { type: "set_sort"; column: ColKey | null; dir?: SortDir }
  | { type: "set_fiscal_year_filter"; fiscalYear: string | null }
  | { type: "set_pipeline_fourth_metric"; metric: "winrate" | "team_capacity" }
  | { type: "set_column_visible"; column: ColKey; visible: boolean }
  | { type: "move_column_before"; moved: ColKey; before: ColKey }
  | { type: "move_column_after"; moved: ColKey; after: ColKey | null }

export type MixAltAgentSnapshot = {
  filteredBaseGrants: Grant[]
  tableScopeGrants: Grant[]
  workQueueItems: ActionItem[]
  upcomingThresholdDays: number
  snoozedIssueIds: ReadonlySet<string>
  lastIssueContext: IssueNavigationContext | null
  activeGrantTitle: string | null
  currentViewLabel: string
  discoveryDeadlineNextMonth: boolean
  discoveryTasksNone: boolean
  chatSavedViewLabels: string[]
  /** Distinct FY labels (`FY2026`, …) from seed grants — used when matching natural-language period commands. */
  fiscalYearLabels: string[]
  /** Shell tab — pipeline KPI swap only applies on All grants. */
  grain: Grain
  /** Operator View menu id (`all` = “Where are we?”). */
  operatorViewId: string
}

/** Subsequent agent message appended after the primary reply has streamed in.
 *  Useful for showing a result (e.g., a chart) and *then* a separate prose
 *  message with a follow-up CTA so the user perceives a natural beat. */
export type MixAltAgentFollowUp = {
  /** Delay (ms) from when the primary message was appended. */
  delayMs: number
  agentBody: string
  sources?: ChatSource[]
  viz?: ChatViz[]
  /** Force markdown formatting for this follow-up (defaults to inheriting). */
  markdown?: boolean
}

export type MixAltAgentTurn = {
  agentBody: string
  sources?: ChatSource[]
  viz?: ChatViz[]
  effects: MixAltEffect[]
  /** Optional cascade of agent messages that should appear after the primary. */
  followUps?: MixAltAgentFollowUp[]
}

/** Underspend / spend pace (Racine grant): just the spenddown chart, styled to
 *  mirror the Opportunity-tab cumulative chart treatment. */
export function mixAltUnderspendSpendCharts(): ChatViz[] {
  return [
    {
      kind: "spend_pace",
      title: "Spenddown — Racine Community Foundation",
      subtitle: "Cumulative spend vs. linear plan · $185K award · Jan → Dec",
      nowLabel: "May",
      yUnit: "K",
      series: [
        { month: "Jan", expected: 15, actual: 6 },
        { month: "Feb", expected: 31, actual: 14 },
        { month: "Mar", expected: 46, actual: 24 },
        { month: "Apr", expected: 62, actual: 33 },
        { month: "May", expected: 77, actual: 42 },
        { month: "Jun", expected: 92, actual: null },
        { month: "Jul", expected: 108, actual: null },
        { month: "Aug", expected: 123, actual: null },
        { month: "Sep", expected: 139, actual: null },
        { month: "Oct", expected: 154, actual: null },
        { month: "Nov", expected: 170, actual: null },
        { month: "Dec", expected: 185, actual: null },
      ],
    },
  ]
}

/** Plain inline button that opens the Racine grant on its Financials/Spenddown
 *  tab — no card treatment, just a single button below the message. */
export function mixAltRacineGrantFollowUp(): ChatViz {
  return {
    kind: "inline_actions",
    actions: [
      {
        label: "Open Racine grant",
        href: `mixalt://grant/${RACINE_COMMUNITY_FOUNDATION_GRANT_ID}/financials`,
      },
    ],
  }
}

export function mixAltOverspendSpendCharts(): ChatViz[] {
  return [
    {
      kind: "metrics",
      rows: [
        { label: "Budget used", value: "95%", hint: "of award (prototype scenario)" },
        { label: "Period elapsed", value: "60%", hint: "share of grant term" },
        { label: "Ahead of pace", value: "~35 pts", hint: "flag when >20 pts ahead" },
      ],
    },
    {
      kind: "sparkline",
      title: "Expected cumulative burn (% of award)",
      series: [
        { x: "Start", y: 0 },
        { x: "33%", y: 33 },
        { x: "66%", y: 66 },
        { x: "Now", y: 60 },
      ],
    },
    {
      kind: "sparkline",
      title: "Actual cumulative spend (% of award)",
      series: [
        { x: "Start", y: 0 },
        { x: "33%", y: 40 },
        { x: "66%", y: 78 },
        { x: "Now", y: 95 },
      ],
    },
  ]
}

const MIXALT_FALLBACK =
  "I'm a prototype — try one of the suggested prompts."

function grantIdsWithOpenIssues(items: ActionItem[]): Set<string> {
  const s = new Set<string>()
  for (const i of items) {
    if (!i.done && !i.snoozed) s.add(i.grantId)
  }
  return s
}

export function isEffectiveUpcoming(
  item: ActionItem,
  thresholdDays: number,
  snoozedIds: ReadonlySet<string>,
): boolean {
  if (item.done || item.snoozed || snoozedIds.has(item.id)) return false
  if (item.issueCategory !== "upcoming") return false
  return item.daysOut >= 0 && item.daysOut <= thresholdDays
}

export function countEffectiveUpcoming(items: ActionItem[], thresholdDays: number, snoozedIds: ReadonlySet<string>): number {
  return items.filter((i) => isEffectiveUpcoming(i, thresholdDays, snoozedIds)).length
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

/** Deadline lands in the next calendar month after today (local). */
function isDeadlineNextMonth(g: Grant, now = new Date()): boolean {
  const d = new Date(g.deadline.split("T")[0] + "T12:00:00")
  if (Number.isNaN(d.getTime())) return false
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
  return d >= next && d <= end
}

export function matchDiscoveryGrants(
  grants: Grant[],
  items: ActionItem[],
  deadlineNextMonth: boolean,
  tasksNone: boolean,
): Grant[] {
  const busy = grantIdsWithOpenIssues(items)
  return grants.filter((g) => {
    if (deadlineNextMonth && !isDeadlineNextMonth(g)) return false
    if (tasksNone && busy.has(g.id)) return false
    return true
  })
}

export type MixAltSuggestionContext = {
  grain: Grain | null | undefined
  /** View dropdown id when on All grants (`all` = default Pipeline Overview). */
  operatorViewId?: string | null
}

const MIXALT_SUGGESTIONS_MY_WORK: string[] = [
  "What needs my attention today?",
  "Snooze all upcoming for a week",
  "Adjust my alert thresholds",
  "What changed since yesterday?",
]

const MIXALT_SUGGESTIONS_ALL_GRANTS: string[] = [
  "Show only federal grants",
  "Group by owner",
  "What's my pipeline this quarter?",
  "Show grants I haven't touched in 30 days",
]

const MIXALT_SUGGESTIONS_SAVED_VIEW: string[] = [
  "Export this as a PDF",
  "Save this view",
  "What views do I have?",
  "Make a board version of this",
]

const MIXALT_SUGGESTIONS_FALLBACK: string[] = [
  "What can you do?",
  "Show me what's at risk",
  "Filter by owner",
  "Export this view",
]

export function getMixAltSuggestions(context?: MixAltSuggestionContext): string[] {
  const grain = context?.grain
  const viewId = context?.operatorViewId ?? "all"

  if (grain == null) {
    return [...MIXALT_SUGGESTIONS_FALLBACK]
  }
  if (grain === "command") {
    return [...MIXALT_SUGGESTIONS_MY_WORK]
  }
  if (grain === "all-grants") {
    if (viewId === "all") {
      return [...MIXALT_SUGGESTIONS_ALL_GRANTS]
    }
    return [...MIXALT_SUGGESTIONS_SAVED_VIEW]
  }
  return [...MIXALT_SUGGESTIONS_FALLBACK]
}

function parseTableGroupBy(t: string): GroupBy | null {
  if (!/\bgroup\b/.test(t) && !t.includes("grouping")) return null
  if (
    t.includes("no grouping") ||
    t.includes("no group") ||
    t.includes("flat list") ||
    (t.includes("flat") && t.includes("list")) ||
    t.includes("ungroup") ||
    t.includes("don't group") ||
    t.includes("do not group")
  ) {
    return "none"
  }
  if (t.includes("funder type") || t.includes("funder-type")) return "funderType"
  if (t.includes("owner")) return "owner"
  if (t.includes("stage") || (t.includes("status") && !/\bsort\b/.test(t))) return "stage"
  if (t.includes("project")) return "projectGroup"
  if (t.includes("deadline")) return "deadline"
  if (t.includes("cultivation")) return "cultivationStage"
  if (t.includes("funder")) return "funder"
  return null
}

function parseFunderTypeKeyword(t: string): FunderType | null {
  if (t.includes("federal")) return "Federal"
  if (t.includes("private") || t.includes("foundation")) return "Private"
  if (t.includes("corporate")) return "Corporate"
  if (t.includes("local")) return "Local"
  if (t.includes("state")) return "State"
  return null
}

function resolveOwnerFilterFromText(t: string): string | null {
  if (t.includes("filter to me") || (t.includes("my grants") && t.includes("only"))) return "elizabeth"
  if (t.includes("elizabeth only") || t.includes("only elizabeth")) return "elizabeth"
  const afterOwner = t.match(/\bowner\s+([a-z]+)\b/)
  if (afterOwner) {
    const tok = afterOwner[1]!
    for (const m of team) {
      const first = m.name.split(" ")[0]!.toLowerCase()
      if (first === tok || (tok.length >= 2 && first.startsWith(tok))) return m.id
    }
  }
  for (const m of team) {
    const full = m.name.toLowerCase()
    const first = m.name.split(" ")[0]!.toLowerCase()
    const firstOk = first.length >= 2 ? first : full
    if (full.length >= 3 && t.includes(full)) return m.id
    if (firstOk.length >= 2 && new RegExp(`\\b${firstOk}\\b`).test(t)) return m.id
  }
  return null
}

/** FY labels (`FY2026`, …) derived from grant deadlines — used for NL period matching. */
export function fiscalYearLabelsForGrants(grants: Grant[]): string[] {
  const set = new Set<number>()
  for (const g of grants) {
    const d = new Date(g.deadline.split("T")[0] + "T12:00:00")
    if (Number.isNaN(d.getTime())) continue
    const y = d.getFullYear()
    const m = d.getMonth()
    const fy = m >= 6 ? y + 1 : y
    if (Number.isFinite(fy)) set.add(fy)
  }
  return Array.from(set)
    .sort((a, b) => a - b)
    .map((fy) => `FY${fy}`)
}

const COLUMN_PHRASES: [string, ColKey][] = [
  ["amount requested", "amountRequested"],
  ["notification date", "notificationDate"],
  ["project group", "projectGroup"],
  ["last updated", "lastUpdated"],
  ["funding source", "fundingSource"],
  ["weighted", "amountRequested"],
  ["indirect", "indirect"],
  ["renewal", "renewal"],
  ["priority", "priority"],
  ["deadline", "deadline"],
  ["requested", "amountRequested"],
  ["funder", "funder"],
  ["status", "status"],
  ["stage", "status"],
  ["grant", "grant"],
  ["title", "grant"],
  ["owner", "owner"],
  ["award", "award"],
  ["amount", "award"],
  ["cycle", "cycle"],
  ["fain", "fain"],
  ["cfda", "cfda"],
  ["period", "period"],
  ["match", "match"],
]

function pickColumnFromText(t: string): ColKey | null {
  const sorted = [...COLUMN_PHRASES].sort((a, b) => b[0].length - a[0].length)
  for (const [phrase, col] of sorted) {
    if (t.includes(phrase)) return col
  }
  return null
}

function parseColumnMove(t: string): MixAltEffect | null {
  const bc = t.match(/\bmove\s+([\w\s]+?)\s+(?:column\s+)?before\s+([\w\s]+)\b/)
  if (bc) {
    const a = pickColumnFromText(bc[1]!.trim().toLowerCase())
    const b = pickColumnFromText(bc[2]!.trim().toLowerCase())
    if (a && b && a !== "grant" && b !== "grant") return { type: "move_column_before", moved: a, before: b }
  }
  const ac = t.match(/\bmove\s+([\w\s]+?)\s+(?:column\s+)?after\s+([\w\s]+)\b/)
  if (ac) {
    const a = pickColumnFromText(ac[1]!.trim().toLowerCase())
    const b = pickColumnFromText(ac[2]!.trim().toLowerCase())
    if (a && b && a !== "grant" && b !== "grant") return { type: "move_column_after", moved: a, after: b }
  }
  const putb = t.match(/\bput\s+([\w\s]+?)\s+(?:column\s+)?before\s+([\w\s]+)\b/)
  if (putb) {
    const a = pickColumnFromText(putb[1]!.trim().toLowerCase())
    const b = pickColumnFromText(putb[2]!.trim().toLowerCase())
    if (a && b && a !== "grant" && b !== "grant") return { type: "move_column_before", moved: a, before: b }
  }
  return null
}

function parseColumnVisibility(t: string): { column: ColKey; visible: boolean } | null {
  const mentionsCol =
    /\b(column|columns)\b/.test(t) ||
    /\b(hide|show|add|remove)\b/.test(t) ||
    /\bturn (?:on|off)\b/.test(t)
  if (!mentionsCol) return null
  const hide =
    /\b(hide|remove|turn off)\b/.test(t) &&
    !/\bshow\b/.test(t) &&
    !/\badd\b/.test(t) &&
    !/\bturn on\b/.test(t)
  const show = /\b(show|add|turn on)\b/.test(t) || (t.includes("display") && t.includes("column"))
  if (!hide && !show) return null
  const col = pickColumnFromText(t)
  if (!col || col === "grant") return null
  return { column: col, visible: show }
}

function parseFiscalYearFromText(t: string, labels: string[]): string | null {
  const m = t.match(/\bfy\s*(\d{4})\b/) || t.match(/\bfiscal\s*(?:year\s*)?(\d{4})\b/)
  if (!m) return null
  const label = `FY${m[1]}`
  if (labels.length > 0 && !labels.includes(label)) return null
  return label
}

export function mixAltSaveViewNudgeViz(): ChatViz[] {
  return [
    {
      kind: "inline_actions",
      actions: [
        { label: "Save view…", href: "mixalt://open-save-view" },
        { label: "Not now", href: "mixalt://dismiss-save-nudge" },
      ],
    },
  ]
}

const TABLE_LAYOUT_EFFECT_TYPES = new Set<MixAltEffect["type"]>([
  "set_owner_filter",
  "clear_owner_filter",
  "set_foundation_filter",
  "clear_foundation_filter",
  "set_group_by",
  "clear_grant_toolbar_filters",
  "set_funder_type_filter",
  "set_sort",
  "set_fiscal_year_filter",
  "set_column_visible",
  "move_column_before",
  "move_column_after",
])

/** Effects that mutate the All grants toolbar / table layout (for save-view nudges). */
export function countTableLayoutEffects(effects: MixAltEffect[]): number {
  let n = 0
  for (const e of effects) {
    if (TABLE_LAYOUT_EFFECT_TYPES.has(e.type)) n += 1
  }
  return n
}

/** Natural-language signals that the user wants a toolbar / table scope change (not Q&A). */
function wantsToolbarScopeMutation(t: string): boolean {
  return (
    t.includes("filter") ||
    t.includes("show") ||
    t.includes("only") ||
    t.includes("narrow") ||
    t.includes("apply") ||
    t.includes("switch") ||
    /\bset\b/.test(t) ||
    t.includes("subset") ||
    t.includes("limit") ||
    (t.includes("table") && /\b(grants?|portfolio|rows?)\b/.test(t))
  )
}

/** Message is only a funder lane (e.g. "federal", "only private grants") — still apply chip. */
function isBareFunderFilterMessage(t: string): boolean {
  const s = t.replace(/\s+/g, " ").trim()
  return /^(?:only\s+)?(?:federal|private|(?:private\s+)?foundations?|corporate|state|local)(?:\s+only)?(?:\s+grants)?\.?$/.test(
    s,
  )
}

function isBareOwnerFilterMessage(t: string, ownerId: string): boolean {
  const member = team.find((m) => m.id === ownerId)
  if (!member) return false
  const first = member.name.split(" ")[0]!.toLowerCase()
  if (first.length < 2) return false
  const s = t.replace(/\s+/g, " ").trim()
  return new RegExp(`^(?:only\\s+)?${first}(?:\\s+only)?(?:\\s+grants)?\\.?$`, "i").test(s)
}

function parseSortFromText(t: string): { column: ColKey; dir: SortDir } | null {
  if (!/\bsort\b/.test(t)) return null
  let dir: SortDir | undefined
  if (t.includes("ascending") || /\basc\b/.test(t)) dir = "asc"
  if (t.includes("descending") || /\bdesc\b/.test(t)) dir = "desc"
  if (t.includes("deadline")) return { column: "deadline", dir: dir ?? "asc" }
  if (t.includes("requested") || t.includes("weighted")) return { column: "amountRequested", dir: dir ?? "desc" }
  if (t.includes("award") || /\bamount\b/.test(t)) return { column: "award", dir: dir ?? "desc" }
  if (t.includes("grant") || t.includes("title")) return { column: "grant", dir: dir ?? "asc" }
  if (t.includes("stage") || t.includes("status")) return { column: "status", dir: dir ?? "asc" }
  if (t.includes("funder")) return { column: "funder", dir: dir ?? "asc" }
  if (t.includes("owner")) return { column: "owner", dir: dir ?? "asc" }
  if (t.includes("updated")) return { column: "lastUpdated", dir: dir ?? "desc" }
  return null
}

export function matchMixAltAgentTurn(raw: string, snap: MixAltAgentSnapshot): MixAltAgentTurn | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null

  const openIssues = snap.workQueueItems.filter((i) => !i.done && !i.snoozed && !snap.snoozedIssueIds.has(i.id))

  const byCat = (cat: ActionItem["issueCategory"]) => openIssues.filter((i) => i.issueCategory === cat).length

  if (t.includes("what needs my attention") || (t.includes("needs my attention") && t.includes("today"))) {
    const upcoming = countEffectiveUpcoming(snap.workQueueItems, snap.upcomingThresholdDays, snap.snoozedIssueIds)
    return {
      agentBody:
        `Here's what needs attention today: ${openIssues.length} open issues.\n\n` +
        `· Overdue: ${byCat("overdue")}\n· Upcoming (within ${snap.upcomingThresholdDays}d): ${upcoming}\n· Spend: ${byCat("spend")}\n· Setup / data gaps: ${openIssues.filter((i) => ["missing_data", "setup", "inactive"].includes(i.issueCategory)).length}\n\nTriage overdue first, then spend flags.`,
      effects: [],
    }
  }

  if (t.includes("what changed") && (t.includes("yesterday") || t.includes("since yesterday"))) {
    return {
      agentBody: `Since yesterday: Versafund stayed overdue, two SAMHSA threads gained replies on matching funds, and nothing newly flipped to Declined. ${openIssues.length} active issues remain—mostly the same shape as yesterday morning.`,
      effects: [],
    }
  }

  if (
    t.includes("adjust my alert thresholds") ||
    (t.includes("adjust") && t.includes("alert") && t.includes("threshold"))
  ) {
    return {
      agentBody:
        'Say “change upcoming to 10 days” or “change upcoming to 30 days” to tighten or widen what lands in Upcoming. Threshold updates apply immediately.',
      effects: [],
    }
  }

  if (t.includes("at risk") && (t.includes("show") || t.includes("what"))) {
    const flaggedGrants = snap.filteredBaseGrants.filter((g) => g.flagged || g.blocked).length
    return {
      agentBody: `At a glance: ${openIssues.length} open queue issues (${byCat("overdue")} overdue). Portfolio-side there are ${flaggedGrants} grants flagged or blocked in the current tracker slice—click through from My work rows or filter grants by Owner/Funder to dig in.`,
      effects: [],
    }
  }

  const whereAreWePipeline = snap.grain === "all-grants" && snap.operatorViewId === "all"

  if (
    !whereAreWePipeline &&
    (/\breplace\b.*\bwin\s*rate\b.*\bteam\s*capacity\b/.test(t) ||
      /\bteam\s*capacity\b.*\binstead\b.*\bwin\s*rate\b/.test(t))
  ) {
    return {
      agentBody:
        "Switch to **Where are we?** in the grants View menu first—that’s where the pipeline KPI strip (and the fourth tile) lives—then ask me to swap win rate for team capacity.",
      effects: [],
    }
  }

  if (
    whereAreWePipeline &&
    t.includes("team capacity") &&
    (/\breplace\b.*\bwin\s*rate\b/.test(t) ||
      /\bwin\s*rate\b.*\bteam\s*capacity\b/.test(t) ||
      /\bteam\s*capacity\b.*\binstead\b.*\bwin\s*rate\b/.test(t) ||
      (t.includes("fourth") && t.includes("tile") && (t.includes("show") || t.includes("use")) && t.includes("team")))
  ) {
    return {
      agentBody:
        "Done. The fourth pipeline tile now shows **Team capacity**—the **top four owners** by **share of weighted pipeline** in the current view (each row is % of total weighted dollars). Click the tile to filter the table to those owners’ grants. Ask to **restore win rate** when you want the original tile back.",
      effects: [{ type: "set_pipeline_fourth_metric", metric: "team_capacity" }],
    }
  }

  if (
    whereAreWePipeline &&
    (t.includes("win rate") || t.includes("winrate")) &&
    (/\breplace\b.*\bteam\s*capacity\b/.test(t) ||
      /\bteam\s*capacity\b.*\bwith\b.*\bwin\s*rate\b/.test(t) ||
      (t.includes("restore") && t.includes("win")) ||
      /\bback\b.*\bwin\s*rate\b/.test(t))
  ) {
    return {
      agentBody:
        "Done. Restored **Win rate** on the fourth pipeline tile. Click it to filter to the usual win-rate cohort.",
      effects: [{ type: "set_pipeline_fourth_metric", metric: "winrate" }],
    }
  }

  // Grants table — toolbar filters, grouping, sort (wired via AllGrantsFilterApi)
  if (
    (t.includes("clear") && t.includes("filter")) ||
    t.includes("reset filters") ||
    t.includes("clear all filters")
  ) {
    return {
      agentBody: "Done. Cleared funder type, owner, and period filters on the grants toolbar — period reset to this year (YTD).",
      effects: [{ type: "clear_grant_toolbar_filters" }],
    }
  }

  if (t.includes("clear sort") || (/\bsort\b/.test(t) && (t.includes("reset") || t.includes("clear")))) {
    return {
      agentBody: "Done. Cleared column sort—the table uses the view default row order.",
      effects: [{ type: "set_sort", column: null }],
    }
  }

  if ((t.includes("clear") || t.includes("reset")) && t.includes("fiscal")) {
    return {
      agentBody: "Done. Period filter reset to this year (YTD).",
      effects: [{ type: "set_fiscal_year_filter", fiscalYear: null }],
    }
  }

  const fyPick = parseFiscalYearFromText(t, snap.fiscalYearLabels)
  if (
    fyPick &&
    (t.includes("filter") ||
      t.includes("set") ||
      t.includes("show") ||
      t.includes("only") ||
      t.includes("narrow") ||
      t.includes("fiscal") ||
      /\bto\s+fy/.test(t))
  ) {
    return {
      agentBody: `Done. Period filter set to ${fyPick.replace(/^FY(\d{4})$/, "FY $1")}.`,
      effects: [{ type: "set_fiscal_year_filter", fiscalYear: fyPick }],
    }
  }
  if ((/\bfy\s*\d{4}\b/.test(t) || /\bfiscal\s*(?:year\s*)?\d{4}/.test(t)) && fyPick === null) {
    return {
      agentBody:
        "That fiscal year isn’t in the current data set—pick an FY that appears in the Period filter on the toolbar.",
      effects: [],
    }
  }

  const colMove = parseColumnMove(t)
  if (colMove) {
    return {
      agentBody: "Done. Reordered columns.",
      effects: [colMove],
    }
  }

  const colVis = parseColumnVisibility(t)
  if (colVis) {
    return {
      agentBody: `Done. ${colVis.visible ? "Showing" : "Hiding"} the ${colVis.column} column.`,
      effects: [{ type: "set_column_visible", column: colVis.column, visible: colVis.visible }],
    }
  }

  const gbChat = parseTableGroupBy(t)
  if (gbChat) {
    const gbLabel: Record<GroupBy, string> = {
      stage: "Stage",
      owner: "Owner",
      funderType: "Funder type",
      funder: "Funder portfolio",
      projectGroup: "Project group",
      deadline: "Deadline",
      cultivationStage: "Cultivation stage",
      none: "No grouping",
    }
    return {
      agentBody: `Done. Grouped by ${gbLabel[gbChat]}.`,
      effects: [{ type: "set_group_by", groupBy: gbChat }],
    }
  }

  const sortParsed = parseSortFromText(t)
  if (sortParsed) {
    return {
      agentBody: `Done. Sorted by ${sortParsed.column} (${sortParsed.dir}).`,
      effects: [{ type: "set_sort", column: sortParsed.column, dir: sortParsed.dir }],
    }
  }

  const funderKw = parseFunderTypeKeyword(t)
  if (funderKw && (wantsToolbarScopeMutation(t) || isBareFunderFilterMessage(t))) {
    return {
      agentBody: `Done. Funder type filter set to ${funderKw}.`,
      effects: [{ type: "set_funder_type_filter", funderType: funderKw }],
    }
  }

  const ownerPick = resolveOwnerFilterFromText(t)
  if (
    ownerPick &&
    !/\bgroup\b/.test(t) &&
    !/\bsort\b/.test(t) &&
    !parseColumnMove(t) &&
    (wantsToolbarScopeMutation(t) ||
      /\bowner\s+[a-z]+\b/.test(t) ||
      t.includes("filter to me") ||
      isBareOwnerFilterMessage(t, ownerPick))
  ) {
    const label = team.find((m) => m.id === ownerPick)?.name ?? ownerPick
    return {
      agentBody: `Done. Owner filter set to ${label}.`,
      effects: [{ type: "set_owner_filter", ownerId: ownerPick }],
    }
  }

  if (t.includes("pipeline") && t.includes("quarter")) {
    const scope = snap.tableScopeGrants.length ? snap.tableScopeGrants : snap.filteredBaseGrants
    const pursued = scope.filter((g) => g.stage !== "Closed" && g.stage !== "Declined")
    const sum = pursued.reduce((a, g) => a + (g.weighted ?? 0), 0)
    return {
      agentBody: `Pipeline this quarter (current table scope): ${scope.length} grants visible; ${pursued.length} active pursuits totaling about ${formatMoney(sum)} in weighted value. Narrow Owner or Funder filters before exporting if this needs to be exec-ready.`,
      effects: [],
    }
  }

  if (
    (t.includes("touched") || t.includes("touch")) &&
    t.includes("30") &&
    (t.includes("grant") || t.includes("show") || t.includes("haven") || t.includes("havent"))
  ) {
    return {
      agentBody:
        "Relative phrases like “30 days since touch” aren’t wired into an automated filter in this prototype—toggle Last updated column sorting or export with notification timestamps once absolute dates land.",
      effects: [],
    }
  }

  if (t.includes("make a board version") || (t.includes("board version") && t.includes("this"))) {
    return {
      agentBody:
        'Choose View → “Board / Leadership” for period anchoring, board-friendly labels, and the prominent Export affordance—or export here as PDF with audience “Board”.',
      effects: [],
    }
  }

  // Generalized quick prompts (Mix Alt chips)
  if (t.includes("explain") && (t.includes("flagged") || t.includes("flag"))) {
    return {
      agentBody:
        "Open a row in My work or name a grant, then ask why it's flagged — for example “Why underspend on Racine?”. If you already opened an issue, “why” alone uses that context.",
      effects: [],
    }
  }
  if (t.includes("adjust") && (t.includes("remind") || t.includes("deadline"))) {
    return {
      agentBody:
        'Change how many days count as “upcoming” — try “change upcoming to 10 days” or “change upcoming to 30 days”.',
      effects: [],
    }
  }
  if ((t.includes("defer") || t.includes("batch")) && t.includes("queue")) {
    return {
      agentBody:
        'To quiet the queue temporarily, say “snooze all upcoming”. To shrink who lands in Upcoming, narrow the day threshold (e.g. “change upcoming to 10 days”).',
      effects: [],
    }
  }
  if (t.includes("portfolio") && (t.includes("total") || t.includes("totals"))) {
    const scope = snap.tableScopeGrants.length ? snap.tableScopeGrants : snap.filteredBaseGrants
    const awarded = scope.filter((g) => g.stage === "Awarded - Active")
    const sum = awarded.reduce((a, g) => a + g.award, 0)
    return {
      agentBody: `In the current table scope: ${awarded.length} active awards totaling ${formatMoney(sum)}. You have ${openIssues.length} open issues. Ask “how many awarded” to include closed grants, or “how many issues” for a tab breakdown.`,
      effects: [],
    }
  }

  // Pattern 8 / discovery-style (before generic filters)
  if (
    t.includes("show me grants due next month") ||
    (t.includes("due next month") && t.includes("without") && t.includes("task"))
  ) {
    const matched = matchDiscoveryGrants(snap.tableScopeGrants, snap.workQueueItems, true, true)
    const n = matched.length
    return {
      agentBody:
        `Found ${n} grants matching that. Want me to save this as a view?\n\n` +
        `Filters applied — check the chips above the table.`,
      effects: [{ type: "set_discovery", deadlineNextMonth: true, tasksNone: true }],
      viz: [
        {
          kind: "inline_actions",
          actions: [
            {
              label: "Name & save view",
              href: `mixalt://open-save-view/suggested/${encodeURIComponent("Due next month · no open tasks")}`,
            },
          ],
        },
      ],
    }
  }

  // Discovery help / capability
  if (t.includes("what can you do") || (t === "help") || t.includes("what can you")) {
    return {
      agentBody:
        "I can set the period range, funder type, and owner filters on the grants toolbar; change grouping and sort; show, hide, or reorder columns; save views; and on **Where are we?** swap the fourth pipeline tile between **win rate** and **team capacity** (top-owner **weighted pipeline** share). Try phrases like “replace win rate with team capacity”, “show only federal grants”, or “clear all filters”.",
      effects: [],
    }
  }

  // Export
  if (
    (t.includes("export") && (t.includes("pdf") || t.includes("report"))) ||
    t.includes("generate a report") ||
    t.includes("export this view") ||
    (t.includes("export") && t.includes("as a pdf")) ||
    (/\bsave\s+(?:this\s+)?(?:the\s+)?view\b/.test(t) && t.includes("pdf"))
  ) {
    return {
      agentBody: `I'll export this view (${snap.currentViewLabel}) as PDF. Which audience should it speak to?`,
      effects: [],
      viz: [
        {
          kind: "inline_actions",
          actions: [
            { label: "Internal", href: "mixalt://export-audience/Internal" },
            { label: "Board", href: "mixalt://export-audience/Board" },
            { label: "Exec Leadership", href: "mixalt://export-audience/Exec%20Leadership" },
            { label: "Finance", href: "mixalt://export-audience/Finance" },
            { label: "Program Director", href: "mixalt://export-audience/Program%20Director" },
          ],
        },
      ],
    }
  }

  // Save view — always open naming dialog (optional prefill from quoted / "save view as …")
  if (
    !/\b(don't|do not)\s+save\b/.test(t) &&
    (/\bsave\s+(?:this\s+)?(?:the\s+)?view\b/.test(t) ||
      /\bsave\s+view\b/.test(t) ||
      /\bsave\s+(?:the\s+)?current\s+layout\b/.test(t))
  ) {
    const quoted = raw.match(/["']([^"']+)["']/)
    const saveAs = raw.match(/\bsave\s+(?:this\s+)?(?:the\s+)?view\s+as\s+(.+)$/i)
    let suggested: string | undefined
    if (quoted?.[1]?.trim()) suggested = quoted[1].trim()
    else if (saveAs?.[1]) {
      const cap = saveAs[1]
        .trim()
        .replace(/\.$/, "")
        .split("\n")[0]!
        .trim()
        .replace(/^["']|["']$/g, "")
      if (cap.length > 0 && cap.length <= 120) suggested = cap
    }
    if (suggested) {
      return {
        agentBody: `Opening Save view with "${suggested}" filled in — change it if you want, then confirm.`,
        effects: [{ type: "open_save_view_dialog", suggestedName: suggested }],
      }
    }
    return {
      agentBody:
        "Opening Save view — type a name for this layout, then confirm. It will store filters, grouping, columns, and sort.",
      effects: [{ type: "open_save_view_dialog" }],
    }
  }

  if (t.includes("what views do i have") || t.includes("list views")) {
    const custom = snap.chatSavedViewLabels.length
      ? snap.chatSavedViewLabels.join(", ")
      : "(none saved yet)"
    return {
      agentBody: `Your saved views: ${custom}. Plus 3 templates: Where are we?, Board / Leadership, At-Risk Pipeline.`,
      effects: [],
    }
  }

  // Snooze
  if (
    t.includes("snooze all upcoming") ||
    (t.includes("snooze") &&
      t.includes("upcoming") &&
      (t.includes("week") || t.includes("7 days") || t.includes("seven") || /\b7\b/.test(t)))
  ) {
    const n = countEffectiveUpcoming(snap.workQueueItems, snap.upcomingThresholdDays, snap.snoozedIssueIds)
    return {
      agentBody: `Done. Snoozed ${n} upcoming issues for 7 days.`,
      effects: [{ type: "snooze_upcoming" }],
    }
  }

  // Threshold
  if (t.includes("change upcoming")) {
    const to10 = /\b10\b/.test(t) || t.includes("ten")
    const to30 = /\b30\b/.test(t) || t.includes("thirty")
    if (to10) {
      const prev = snap.upcomingThresholdDays
      const before = countEffectiveUpcoming(snap.workQueueItems, prev, snap.snoozedIssueIds)
      const after = countEffectiveUpcoming(snap.workQueueItems, 10, snap.snoozedIssueIds)
      const moved = Math.max(0, before - after)
      return {
        agentBody: `Done. Your alert threshold for upcoming deadlines is now 10 days, down from ${prev}. ${moved === 1 ? "One issue moved out of Upcoming." : moved > 1 ? `${moved} issues moved out of Upcoming.` : "Counts updated."}`,
        effects: [{ type: "set_threshold", days: 10 }],
      }
    }
    if (to30) {
      const prev = snap.upcomingThresholdDays
      const before = countEffectiveUpcoming(snap.workQueueItems, prev, snap.snoozedIssueIds)
      const after = countEffectiveUpcoming(snap.workQueueItems, 30, snap.snoozedIssueIds)
      const moved = Math.max(0, after - before)
      return {
        agentBody: `Done. Your alert threshold for upcoming deadlines is now 30 days, up from ${prev}. ${moved >= 2 ? `${moved} more issues moved into Upcoming.` : moved === 1 ? "One more issue moved into Upcoming." : "Counts updated."}`,
        effects: [{ type: "set_threshold", days: 30 }],
      }
    }
  }

  if (t.includes("show me foundation grants") || t.includes("show foundation grants")) {
    return {
      agentBody: "Done. Funder type filter set to Private (foundation lane).",
      effects: [{ type: "set_funder_type_filter", funderType: "Private" }],
    }
  }

  // Q&A — amounts scoped to tableScopeGrants when on grants grain idea
  const scope = snap.tableScopeGrants.length ? snap.tableScopeGrants : snap.filteredBaseGrants

  if (t.includes("how many") && t.includes("awarded")) {
    const awarded = scope.filter((g) => g.stage === "Awarded - Active")
    const closed = scope.filter((g) => g.stage === "Closed")
    const sumAwarded = awarded.reduce((a, g) => a + g.award, 0)
    const sumClosed = closed.reduce((a, g) => a + g.award, 0)
    const totalSum = sumAwarded + sumClosed
    return {
      agentBody: `${awarded.length + closed.length} grants — totaling ${formatMoney(totalSum)} in awards. ${awarded.length} are active, ${closed.length} are closed.`,
      effects: [],
    }
  }

  if (t.includes("how many") && t.includes("issues")) {
    const by = (cat: ActionItem["issueCategory"]) => openIssues.filter((i) => i.issueCategory === cat).length
    return {
      agentBody:
        `You have ${openIssues.length} active issues across your portfolio.\n\n` +
        `· Overdue: ${by("overdue")}\n· Upcoming (within threshold): ${countEffectiveUpcoming(snap.workQueueItems, snap.upcomingThresholdDays, snap.snoozedIssueIds)}\n· Spend: ${by("spend")}\n· Data gaps (missing/setup/inactive): ${openIssues.filter((i) => ["missing_data", "setup", "inactive"].includes(i.issueCategory)).length}`,
      effects: [],
    }
  }

  if (t.includes("what's the total amount") || t.includes("what is the total amount")) {
    const awarded = scope.filter((g) => g.stage === "Awarded - Active")
    const pursued = scope.filter((g) => g.stage !== "Closed" && g.stage !== "Declined")
    if (t.includes("requested") || t.includes("pursued")) {
      const sum = pursued.reduce((a, g) => a + (g.weighted ?? 0), 0)
      return {
        agentBody: `Total pursued / weighted this quarter: ${formatMoney(sum)} across ${pursued.length} grants.`,
        effects: [],
      }
    }
    const sum = awarded.reduce((a, g) => a + g.award, 0)
    return {
      agentBody: `Total awarded this quarter: ${formatMoney(sum)} across ${awarded.length} grants.`,
      effects: [],
    }
  }

  // Why patterns (specific first)
  if (t.includes("why")) {
    if (t.includes("racine") || t.includes("underspend")) {
      return {
        agentBody:
          "Racine Community Foundation is tracking well behind its spend plan. At May 11 (36% through a 12-month period), the team has spent $42K of the $185K award — versus ~$67K expected by now, leaving a ~$25K gap. That trips our underspend flag (>$20K behind plan). To finish on plan they’d need to step burn up from ~$9K / mo to ~$19K / mo across the remaining ~7.5 months. Spenddown snapshot below.",
        viz: mixAltUnderspendSpendCharts(),
        effects: [],
        followUps: [
          {
            delayMs: 2600,
            agentBody:
              "Want to dig in? I can take you straight to the spenddown view on the Racine grant.",
            viz: [mixAltRacineGrantFollowUp()],
          },
        ],
      }
    }
    if (t.includes("america") || /\bover\b/.test(t) || t.includes("overspend")) {
      return {
        agentBody:
          "This grant has used 95% of its budget but is only 60% through its grant period. We flag overspend when usage is more than 20% ahead of expected pace. Reach out to the program lead, or review pace in the chart.",
        viz: [
          {
            kind: "tasks",
            items: [
              {
                title: "Follow up",
                tone: "action",
                actions: [
                  { label: "Compose email", href: "mixalt://toast/compose-email" },
                  { label: "Show pace chart", href: "mixalt://chart/spend-overspend" },
                ],
              },
            ],
          },
        ],
        effects: [],
      }
    }
    if (t.includes("versafund") || t.includes("kresge")) {
      const deadline = "March 15, 2026"
      return {
        agentBody: `Versafund is overdue because the full proposal deadline was ${deadline} and it's currently ${todayLong()}. We flag any grant whose deadline has passed without status moving to Submitted, Awarded, or Declined.`,
        effects: [],
      }
    }

    const ctx = snap.lastIssueContext
    if (ctx) {
      return {
        agentBody:
          `Here's why ${ctx.fieldLabel} is flagged: ${ctx.reason}\n\n` +
          `We surface issues when metadata or deadlines imply risk before submission.`,
        effects: [],
      }
    }
    return {
      agentBody:
        'Tell me which grant or flag (or open an issue row first). Example: “Why underspend on Racine?”',
      effects: [],
    }
  }

  return null
}

export function mixAltFallbackBody(): string {
  return MIXALT_FALLBACK
}
