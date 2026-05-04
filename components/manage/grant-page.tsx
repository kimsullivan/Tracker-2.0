"use client"

import { useState } from "react"
import { grants, team } from "@/lib/manage/data"
import { StagePill } from "./status-pill"
import { OwnerAvatar } from "./owner-avatar"
import { ArrowRight, Check, FileText, MoreHorizontal, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

const TABS = ["Work", "Notes", "Applications", "Opportunity", "Financials", "Documents"] as const
type Tab = (typeof TABS)[number]

const LIFECYCLE = [
  "Researching",
  "Planned",
  "LOI",
  "Application",
  "Submitted",
  "Awarded",
  "Closed",
] as const

export function GrantPage({ grantId }: { grantId: string }) {
  const grant = grants.find((g) => g.id === grantId) || grants[0]
  const [tab, setTab] = useState<Tab>("Work")
  const owner = team.find((t) => t.id === grant.ownerId)

  const stageIndex =
    grant.stage === "Awarded - Active" ? 5 :
    grant.stage === "Application Submitted" ? 4 :
    grant.stage === "Application In Progress" ? 3 :
    grant.stage.startsWith("LOI") ? 2 :
    grant.stage === "Planned" ? 1 :
    grant.stage === "Researching" ? 0 :
    grant.stage === "Closed" ? 6 : 0

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
              {grant.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StagePill stage={grant.stage} />
              <span className="font-mono text-[11px]">{grant.id}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{grant.funder}</span>
              {grant.fain && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono text-[11px]">{grant.fain}</span>
                </>
              )}
              <span className="text-muted-foreground/40">·</span>
              <div className="flex items-center gap-1.5">
                <OwnerAvatar id={grant.ownerId} size={18} />
                <span>{owner?.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => toast("Activity logged", { description: "Visible on the timeline." })}>
              Log activity
            </Button>
            <Button size="sm" onClick={() => toast("Stage advanced", { description: "Confirmation modal in production." })}>
              Mark as Closed
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Lifecycle ribbon */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-3">
          {LIFECYCLE.map((stage, i) => {
            const isComplete = i < stageIndex
            const isCurrent = i === stageIndex
            const isFuture = i > stageIndex
            return (
              <div key={stage} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                  <button
                    onClick={() => toast(stage, { description: isFuture ? "Not yet reached." : isCurrent ? "Currently here." : "Completed." })}
                    className={[
                      "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                      isComplete && "bg-chart-3 text-white",
                      isCurrent && "ring-4 ring-primary/15 bg-primary text-primary-foreground",
                      isFuture && "border border-dashed border-border bg-background text-muted-foreground/60",
                    ].filter(Boolean).join(" ")}
                  >
                    {isComplete ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </button>
                  <span
                    className={[
                      "text-[10px] font-medium",
                      isCurrent ? "text-foreground" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {stage}
                  </span>
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div
                    className={[
                      "h-px flex-1 mx-1 -mt-5",
                      isComplete ? "bg-chart-3" : "bg-border",
                    ].join(" ")}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="bg-transparent p-0 h-auto border-b border-border w-full justify-start rounded-none gap-1">
          {TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs font-medium data-[state=active]:text-foreground text-muted-foreground"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Work" className="mt-6">
          <WorkTab grantId={grant.id} />
        </TabsContent>
        <TabsContent value="Notes" className="mt-6">
          <NotesTab />
        </TabsContent>
        <TabsContent value="Applications" className="mt-6">
          <ApplicationsTab />
        </TabsContent>
        <TabsContent value="Opportunity" className="mt-6">
          <OpportunityTab />
        </TabsContent>
        <TabsContent value="Financials" className="mt-6">
          <FinancialsTab />
        </TabsContent>
        <TabsContent value="Documents" className="mt-6">
          <DocumentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ---------------- Work tab ---------------- */

const workItems = [
  { id: "w1", title: "Q2 drawdown package", type: "Drawdown", owner: "maria", due: "May 5", status: "In progress", desc: "Personnel + indirect, $112K." },
  { id: "w2", title: "Mid-year progress report", type: "Report", owner: "maria", due: "May 31", status: "Not started", desc: "Enrollment + utilization data from Epic." },
  { id: "w3", title: "Site visit prep — HRSA PO", type: "Outreach", owner: "grace", due: "Jun 3", status: "Not started", desc: "Coordinate with clinical team." },
  { id: "w4", title: "Logic model revision", type: "Deliverable", owner: "laurie", due: "May 20", status: "Blocked", desc: "Awaiting CFO sign-off on budget alignment.", blocked: true, blockedReason: "CFO budget review" },
  { id: "w5", title: "Update equity metrics dashboard", type: "Task", owner: "nina", due: "Jun 1", status: "In progress" },
]

const activity = [
  { id: "ac1", color: "chart-3", title: "Drawdown approved", body: "$87,500 disbursed via PMS — Apr 28", time: "3 days ago" },
  { id: "ac2", color: "primary", title: "Note from Maria", body: "PO confirmed willingness to extend match deadline 30 days if needed.", time: "1 week ago" },
  { id: "ac3", color: "muted", title: "Stage advanced", body: "Application Submitted → Awarded - Active", time: "Mar 12" },
  { id: "ac4", color: "muted", title: "Award letter received", body: "Dr. Patel countersigned. Period of performance 09/01/24 — 08/31/25.", time: "Mar 10" },
]

function WorkTab({ grantId }: { grantId: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        {/* Open work */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="font-heading text-sm font-bold text-card-foreground">Open work</h3>
              <p className="text-[11px] text-muted-foreground">{workItems.length} items · {workItems.filter(i => i.blocked).length} blocked</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              <Plus className="mr-1 h-3 w-3" />
              Add item
            </Button>
          </div>
          <div className="grid grid-cols-[24px_1fr_100px_80px_90px_90px] items-center gap-px border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span />
            <span>Item</span>
            <span>Type</span>
            <span>Owner</span>
            <span>Due</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {workItems.map((item) => (
              <li
                key={item.id}
                className={[
                  "grid grid-cols-[24px_1fr_100px_80px_90px_90px] items-center gap-px px-4 py-2.5 hover:bg-muted/40",
                  item.blocked && "bg-chart-5/[0.04]",
                ].filter(Boolean).join(" ")}
              >
                <input type="checkbox" className="h-3.5 w-3.5 rounded border-input" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-card-foreground">
                    <span className="truncate">{item.title}</span>
                    {item.blocked && (
                      <span className="rounded bg-chart-5/10 px-1 py-0 text-[10px] font-medium text-chart-5">
                        Blocked: {item.blockedReason}
                      </span>
                    )}
                  </div>
                  {item.desc && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.desc}</div>}
                </div>
                <span className="text-[11px] text-muted-foreground">{item.type}</span>
                <OwnerAvatar id={item.owner} size={20} />
                <span className="text-[11px] tabular-nums text-foreground">{item.due}</span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-medium w-fit",
                    item.status === "In progress" && "bg-chart-1/10 text-chart-1",
                    item.status === "Not started" && "bg-muted text-muted-foreground",
                    item.status === "Blocked" && "bg-chart-5/10 text-chart-5",
                    item.status === "Complete" && "bg-chart-3/10 text-chart-3",
                  ].filter(Boolean).join(" ")}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Activity */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-heading text-sm font-bold text-card-foreground">Activity</h3>
          </div>
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-3">
                <div
                  className={[
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    a.color === "chart-3" && "bg-chart-3",
                    a.color === "primary" && "bg-primary",
                    a.color === "muted" && "bg-muted-foreground/40",
                  ].filter(Boolean).join(" ")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-card-foreground">{a.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{a.time}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{a.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right rail */}
      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="font-heading text-xs font-bold uppercase tracking-wide text-muted-foreground">Quick reference</h4>
          <Reference label="Award" value="$487,500" />
          <Reference label="Drawn to date" value="$184,250 · 38%" />
          <Reference label="Period ends" value="Aug 31, 2025" />
          <Reference label="PO" value="Dr. Aisha Patel" />
          <Reference label="Last contact" value="Apr 28 — drawdown call" />
          <button className="w-full rounded-md bg-secondary py-1.5 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80">
            See full Opportunity →
          </button>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Agent suggestions
          </div>
          <p className="text-[11px] leading-relaxed text-foreground">
            Hartford burn is 18% over plan. Want me to draft a budget realignment memo for Dr. Patel?
          </p>
          <div className="flex gap-1.5">
            <button className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90">
              Draft memo
            </button>
            <button className="rounded-md border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted">
              Skip
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Reference({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium text-card-foreground">{value}</span>
    </div>
  )
}

/* ---------------- Notes ---------------- */

function NotesTab() {
  const [notes, setNotes] = useState([
    {
      id: "n1",
      author: "Maria Chen",
      ownerId: "maria",
      time: "2 hours ago",
      body: "PO confirmed she's flexible on the match if we hit Q2 drawdown by 5/15. Let's pull the package together this week and circulate to James for sign-off Friday.",
    },
    {
      id: "n2",
      author: "Laurie Park",
      ownerId: "laurie",
      time: "yesterday",
      body: "Pulled Q2 enrollment numbers from Epic. We're at 412 of 500 target. On track but tight; might want to think about what we tell HRSA in the mid-year report if we land at 460 instead of 500.",
    },
    {
      id: "n3",
      author: "James Wu",
      ownerId: "james",
      time: "Apr 22",
      body: "Approved the $112K Q2 drawdown package. Move forward.",
    },
  ])
  const [composer, setComposer] = useState("")

  function postNote() {
    if (!composer.trim()) return
    setNotes((prev) => [
      { id: `n-${Date.now()}`, author: "Maria Chen", ownerId: "maria", time: "just now", body: composer.trim() },
      ...prev,
    ])
    setComposer("")
    toast("Note posted")
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-3">
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postNote()
          }}
          placeholder="Add a note about this grant — context, decisions, things to remember…"
          className="min-h-[72px] w-full resize-none bg-transparent text-sm text-foreground placeholder:italic placeholder:text-muted-foreground/70 outline-none"
        />
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] text-muted-foreground">Cmd+Enter to post</span>
          <Button size="sm" onClick={postNote} disabled={!composer.trim()}>
            Post note
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {notes.map((n) => (
          <article key={n.id} className="flex gap-3 animate-in fade-in slide-in-from-top-1 duration-500">
            <OwnerAvatar id={n.ownerId} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-foreground">{n.author}</span>
                <span className="text-[11px] text-muted-foreground">{n.time}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {n.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Applications / Cycles ---------------- */

function ApplicationsTab() {
  const cycles = [
    { id: "y1", label: "Y1 — 2024", status: "Won", dot: "chart-3" },
    { id: "y2", label: "Y2 — 2025", status: "Awarded · Active", dot: "primary", active: true },
    { id: "y3", label: "Y3 Renewal — 2026", status: "Upcoming", dot: "muted" },
  ]
  const requirements = [
    { id: "r1", label: "Letter of intent", done: true },
    { id: "r2", label: "Full application narrative (25 pages)", done: true },
    { id: "r3", label: "Logic model + outcomes framework", done: true },
    { id: "r4", label: "Budget + budget narrative", done: true },
    { id: "r5", label: "Letters of support (3)", done: true },
    { id: "r6", label: "Mid-year progress report", done: false },
    { id: "r7", label: "Annual narrative report", done: false },
  ]
  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cycles.map((c) => (
          <button
            key={c.id}
            className={[
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
              c.active ? "border-foreground bg-card text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                c.dot === "chart-3" && "bg-chart-3",
                c.dot === "primary" && "bg-primary",
                c.dot === "muted" && "bg-muted-foreground/40",
              ].filter(Boolean).join(" ")}
            />
            <span className="font-medium">{c.label}</span>
            <span className="text-[11px] text-muted-foreground">· {c.status}</span>
          </button>
        ))}
        <button className="shrink-0 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          + New cycle
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-sm font-bold text-card-foreground">Y2 — 2025 summary</h4>
            <span className="rounded-full bg-chart-3/10 px-2 py-0.5 text-[10px] font-medium text-chart-3">Awarded</span>
          </div>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Applied Jan 15, 2025. Award notification Mar 10, 2025. Cycle owner Maria Chen, supported by Laurie Park
            (research) and Grace Okafor (writing).
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <Reference label="Submitted" value="Jan 15, 2025" />
            <Reference label="Notification" value="Mar 10, 2025" />
            <Reference label="Result" value="$487,500 / $487,500 ask" />
            <Reference label="Cycle owner" value="Maria Chen" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="font-heading text-sm font-bold text-card-foreground">Requirements checklist</h4>
          <ul className="space-y-1.5">
            {requirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <span
                  className={[
                    "flex h-4 w-4 items-center justify-center rounded border",
                    r.done ? "bg-chart-3 border-chart-3" : "border-input",
                  ].join(" ")}
                >
                  {r.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
                <span className={r.done ? "text-muted-foreground line-through" : "text-foreground"}>{r.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Opportunity ---------------- */

function OpportunityTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="font-heading text-base font-bold text-foreground">About this grant</h3>
          <p className="text-sm leading-relaxed text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            HRSA's Diabetes Prevention Program supports community-based organizations in delivering evidence-based
            lifestyle change programs to adults at risk for type 2 diabetes. Year 2 funding continues our work in
            Hartford and East Hartford with a focus on Spanish-speaking populations and adults over 55.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            The program runs on a 5-year cycle. We are currently in Year 2 of 5; Y3 renewal application opens September 2026.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading text-base font-bold text-foreground">Eligibility & fit</h3>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {[
              ["Geographic scope", "CT — Hartford County"],
              ["Population focus", "Adults 18-75 with prediabetes"],
              ["Funder priority", "Health equity (high alignment)"],
              ["Restrictions", "No lobbying; no construction"],
              ["Reporting cadence", "Semi-annual + annual narrative"],
              ["Renewal pathway", "Non-competing continuation Y3-Y5"],
            ].map(([k, v]) => (
              <div key={k} className="bg-card p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{k}</div>
                <div className="mt-0.5 text-xs text-card-foreground">{v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading text-base font-bold text-foreground">Award terms</h3>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {[
              ["Ask", "$487,500"],
              ["Match required", "25% non-federal"],
              ["Indirect rate", "15.5% MTDC"],
              ["Instrument", "Cooperative agreement"],
              ["Period", "09/01/24 — 08/31/25"],
              ["Certifying official", "James Wu, ED"],
            ].map(([k, v]) => (
              <div key={k} className="bg-card p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{k}</div>
                <div className="mt-0.5 text-xs font-medium text-card-foreground">{v}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="font-heading text-xs font-bold uppercase tracking-wide text-muted-foreground">Funder</h4>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-chart-1/10 text-chart-1 font-bold text-sm">
              H
            </div>
            <div>
              <div className="text-sm font-semibold text-card-foreground">HHS / HRSA</div>
              <div className="text-[11px] text-muted-foreground">Federal · 4 active grants</div>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-border pt-3">
            <div className="text-[11px] font-medium text-card-foreground">Dr. Aisha Patel</div>
            <div className="text-[10px] text-muted-foreground">Program Officer · since 2023</div>
            <div className="text-[10px] text-muted-foreground">Last contact: Apr 28, drawdown call</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="font-heading text-xs font-bold uppercase tracking-wide text-muted-foreground">Identifiers</h4>
          <Reference label="Grant ID" value="G-2024-118" />
          <Reference label="FAIN" value="U58DP007214" />
          <Reference label="UEI" value="JG7FXM82HPK4" />
          <Reference label="CFDA" value="93.426" />
          <Reference label="Saved" value="Sep 2, 2024" />
        </div>
      </aside>
    </div>
  )
}

/* ---------------- Financials ---------------- */

function FinancialsTab() {
  const summary = [
    { label: "Award", value: "$487,500" },
    { label: "Drawn to date", value: "$184,250", sub: "38%" },
    { label: "Remaining", value: "$303,250", sub: "62%" },
    { label: "Match committed", value: "$121,875", sub: "67% spent" },
    { label: "Indirect", value: "15.5%", sub: "$28,549 alloc" },
  ]
  const drawdowns = [
    { date: "Apr 28, 2025", personnel: 62000, ops: 18500, indirect: 12450, total: 92950 },
    { date: "Mar 14, 2025", personnel: 28000, ops: 9200, indirect: 5800, total: 43000 },
    { date: "Feb 15, 2025", personnel: 31000, ops: 11500, indirect: 5800, total: 48300 },
  ]
  const expenses = [
    { cat: "Personnel", budgeted: 280000, spent: 121000, pacing: "ahead" },
    { cat: "Operations", budgeted: 95000, spent: 39200, pacing: "on" },
    { cat: "Materials", budgeted: 42000, spent: 12500, pacing: "behind" },
    { cat: "Travel", budgeted: 18000, spent: 5800, pacing: "on" },
    { cat: "Indirect", budgeted: 52549, spent: 24050, pacing: "ahead" },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-heading text-lg font-bold tabular-nums text-card-foreground">{s.value}</div>
            {s.sub && <div className="text-[10px] text-muted-foreground">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-heading text-sm font-bold text-card-foreground">Drawdowns ledger</h3>
          </div>
          <div className="grid grid-cols-[1fr_70px_70px_70px_80px] items-center gap-px bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Date</span>
            <span className="text-right">Personnel</span>
            <span className="text-right">Ops</span>
            <span className="text-right">Indirect</span>
            <span className="text-right">Total</span>
          </div>
          <ul className="divide-y divide-border">
            {drawdowns.map((d, i) => (
              <li key={i} className="grid grid-cols-[1fr_70px_70px_70px_80px] items-center gap-px px-4 py-2 text-xs">
                <span className="text-card-foreground">{d.date}</span>
                <span className="text-right tabular-nums text-muted-foreground">${(d.personnel / 1000).toFixed(1)}K</span>
                <span className="text-right tabular-nums text-muted-foreground">${(d.ops / 1000).toFixed(1)}K</span>
                <span className="text-right tabular-nums text-muted-foreground">${(d.indirect / 1000).toFixed(1)}K</span>
                <span className="text-right tabular-nums font-medium text-card-foreground">${(d.total / 1000).toFixed(1)}K</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-heading text-sm font-bold text-card-foreground">Expenses by category</h3>
          </div>
          <div className="grid grid-cols-[1fr_60px_60px_70px] gap-px bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Category</span>
            <span className="text-right">Budget</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Pacing</span>
          </div>
          <ul className="divide-y divide-border">
            {expenses.map((e) => {
              const pct = (e.spent / e.budgeted) * 100
              const color =
                e.pacing === "ahead" ? "bg-chart-4" : e.pacing === "behind" ? "bg-chart-1" : "bg-chart-3"
              return (
                <li key={e.cat} className="grid grid-cols-[1fr_60px_60px_70px] items-center gap-px px-4 py-2 text-xs">
                  <span className="text-card-foreground">{e.cat}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    ${(e.budgeted / 1000).toFixed(0)}K
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    ${(e.spent / 1000).toFixed(0)}K
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="relative h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                      <div className={["absolute inset-y-0 left-0", color].join(" ")} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Documents ---------------- */

function DocumentsTab() {
  const groups = [
    {
      label: "Award documents",
      items: [
        { name: "DPP Y2 Award Letter", type: "PDF", date: "Mar 12, 2025", size: "284 KB", uploader: "maria" },
        { name: "Notice of Award (NOA)", type: "PDF", date: "Mar 10, 2025", size: "412 KB", uploader: "maria" },
      ],
    },
    {
      label: "Application materials",
      items: [
        { name: "DPP Y2 Narrative — final", type: "DOCX", date: "Jan 15, 2025", size: "1.2 MB", uploader: "grace", version: "v6" },
        { name: "DPP Y2 Budget", type: "XLSX", date: "Jan 15, 2025", size: "284 KB", uploader: "maria" },
        { name: "Logic Model", type: "PDF", date: "Jan 13, 2025", size: "186 KB", uploader: "laurie" },
      ],
    },
    {
      label: "Reports & deliverables",
      items: [
        { name: "Q1 Progress Report", type: "PDF", date: "Apr 15, 2025", size: "344 KB", uploader: "maria" },
        { name: "Mid-year Report (DRAFT)", type: "DOCX", date: "May 1, 2025", size: "612 KB", uploader: "maria", version: "v2" },
      ],
    },
  ]
  const typeColor: Record<string, string> = {
    PDF: "bg-chart-4/10 text-amber-950 border-chart-4/20",
    DOCX: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    XLSX: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-3 w-3" />
          Upload
        </Button>
      </div>
      {groups.map((g) => (
        <div key={g.label} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-heading text-sm font-bold text-card-foreground">{g.label}</h3>
            <p className="text-[11px] text-muted-foreground">{g.items.length} items</p>
          </div>
          <ul className="divide-y divide-border">
            {g.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <span
                  className={[
                    "inline-flex w-12 justify-center rounded border px-1.5 py-0.5 text-[10px] font-bold",
                    typeColor[item.type],
                  ].join(" ")}
                >
                  {item.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate text-xs font-medium text-card-foreground">{item.name}</span>
                    {"version" in item && item.version && (
                      <span className="rounded bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">{item.version}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.date} · {item.size}
                  </div>
                </div>
                <OwnerAvatar id={item.uploader} size={20} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
