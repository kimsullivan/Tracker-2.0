# GrantOS Tracker — PRD / Understanding Doc

**Status:** Working draft for prototyping
**Owner:** Product
**Persona:** Elizabeth, Grants Manager at a mid-sized nonprofit
**Use:** Standalone reference for prototype prompts, design exploration, and team alignment

---

## 1. North Star

> Elizabeth opens Instrumentl Monday morning, understands her portfolio in 10 seconds, and sends her board report in 2 minutes — without touching a spreadsheet.

If a grant manager still needs to export and massage data in a spreadsheet, we've failed.

We are building the system where a grants manager opens Instrumentl and instantly knows the state of every grant in their portfolio — and trusts it enough to report from it.

---

## 2. Primary persona

**Elizabeth — Grants Manager**

- Primary operator of the grants business; responsible for org performance with grants
- Reports grant performance to management and board
- Grants team of 1–3, possibly with consultants
- Has some public funding (post-award compliance need)
- Currently maintains a side spreadsheet because the existing tracker doesn't tell her what she needs in the form she needs it
- Decisive on switching tools: *"I'll switch if I can send my board a report without touching Excel. If I have to do more steps, I won't switch."*

Secondary users (consume but don't operate):
- **Executive Director** — receives weekly/monthly summaries; uses them to brief the board
- **Board members** — receive PDF in board packets
- **Department/program directors** — receive scoped spend-down updates
- **Finance team** — receives receivables and spend-down views
- **Program staff** — operate on their assigned grants only (permission-scoped)

---

## 3. Core principle: One canonical tracker, three view classes

There is **one** workspace. Not two. Not four.

```
            ┌────────────────────────────────────────┐
            │   Canonical grant data (dumb table)    │
            │   All fields, all grants, raw          │
            └────────────────────────────────────────┘
                              ▲
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────┴─────┐       ┌───────┴────────┐    ┌──────┴───────┐
   │ My Work  │       │  All Grants    │    │ Saved Views  │
   │          │       │                │    │              │
   │ Issue-   │       │ Customizable   │◄───│ Canned       │
   │ shaped;  │       │ saved-view     │    │ templates +  │
   │ rules    │       │ config:        │    │ user-saved   │
   │ engine;  │       │ filter, sort,  │    │ forks        │
   │ dedicated│       │ group, cols,   │    │              │
   │ actions  │       │ KPI tiles      │    │              │
   └────┬─────┘       └───────┬────────┘    └──────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                  ┌───────────┴────────────┐
                  │  Bridges + Export +    │
                  │  Agent layer (chat)    │
                  └────────────────────────┘
```

**Why one workspace, not separate Operating + Reporting surfaces:**
The tracker IS the report. The difference between a working view and a board-ready view is *configuration* (which fields, what filter, audience translation, export format) — not a different system. There is no separate reporting tool.

---

## 4. The three primary JTBDs

### P1 — "Am I OK?" (My Work)

The most-used, most-important view. The **daily destination.** Answers:
- What's at risk?
- What needs my attention?
- What's wrong?

**Solution principle:** We can't give them another spreadsheet — that forces them to mentally compute their answer. Instead, we pass judgment on their canonical data so they don't need to think. They look at this for 10 seconds and immediately know what to do with their time.

**The flow:** See → Understand → Fix.

### P2 — "Where are we across everything?" (All Grants)

The source-of-truth view.
- Full pipeline
- What's applied / awarded / declined
- What's coming up

### P3 — "I can report instantly" (Saved Views + Export)

Sharing tracker confidence externally. The Tracker IS the report. No rebuilding.

---

## 5. Surface specifications

### 5.1 My Work / "Am I OK?"

**Cognitive mode:** Triage. *"What needs my attention right now?"*

**Default landing:** This is what Elizabeth opens to on Monday morning.

**Structural shape:** Issue-shaped rows, NOT grant-shaped. A grant can appear multiple times (once per active issue).

**Why this can't be a saved view of the tracker:**
- Rows are derived issues, not stored grant records
- Rules can't be expressed as filters — they're computed across multiple fields with thresholds
- Actions are issue-aware (snoozing an Inactive issue ≠ snoozing an Upcoming deadline)
- Intentionally opinionated — users can't create new issue types or rules

**Tabs (six issue types):**

| Tab | Rule |
|---|---|
| **Overdue** | Missed LOI / full proposal / any task deadline (deadline < today AND status not in [Submitted, Awarded, Declined]) |
| **Upcoming** | LOI / full proposal / any task within N days (default: 14) |
| **Spend** | Over- or under-spend vs. plan beyond threshold (default: ±20% of expected pace) |
| **Missing Data** | No next step set up; required field empty (e.g., owner unassigned, deadline missing) |
| **Set Up** | Integration not set up; awarded-active without budget; fields partially mapped |
| **Inactive** | No activity for X days (default: 30) |

**Each issue row shows:**
- Issue type pill (color-coded by severity, tasteful — no traffic-light blocks)
- Item description (e.g., "Full Proposal Deadline overdue by 3 days")
- Grant name
- Owner
- Status
- Last updated

**Dedicated actions:**
- Click row → grant detail with relevant field highlighted
- Snooze (7 days default, configurable)
- Mark OK (with 5-second undo)
- Bulk select → bulk snooze, mark OK, assign, update
- Deep-link to grant detail

**Design principles:**
- Calm, not alarming. "Here's what to do," not "you're failing."
- No charts. This is a do-list, not a dashboard.
- Progressive disclosure for large issue counts ("showing 8 of 17, view all")

**What users CAN'T do here (intentional):**
- Create new issue types
- Define new rules
- Add custom fields/columns
- Override the judgment

This is where Instrumentl owns the opinion.

---

### 5.2 All Grants

**Cognitive mode:** Comprehension. *"What's the state of everything?"*

**Structural shape:** Customizable table over the canonical data.

**Top of view:** Six dynamic KPI tiles aggregated to current scope:

| Tile | Aggregation |
|---|---|
| Total Prospects | Count of researched grants |
| Applications In Progress | Count + $ requested |
| Submitted | Count + $ requested |
| Awarded | Count + $ |
| Lost | Count + $ |
| Win Rate | Awarded / (Awarded + Lost) |

**KPI behavior:** Tiles re-aggregate live as the user filters/groups. Filter to Q1 → KPIs reflect Q1. Filter by owner → KPIs reflect that owner's portfolio.

**Customization controls:**
- Filter bar with chips (status, owner, funder type, period, custom fields)
- Group by dropdown (status, owner, funder type, program, custom)
- Columns panel (show/hide/reorder/resize)
- Sort by any column (asc/desc)
- "Save as view…" button — promotes current configuration to a saved view

**Default columns:**
Status | Grant Name | Funder | Amount | Deadline | Owner | Last Updated

**Available columns (full canonical):**
All fields exist; user adds them via the Columns panel. Columns are organized by phase (Application, Award, Financial, Prospecting, Research, Compliance, Reporting) so users can show "all award-phase columns" with one action.

---

### 5.3 Saved Views

**Cognitive mode:** Communication / recurring use. *"I want this configuration available again."*

**Two classes of saved view:**

**Canned templates** (ship with product, marked "Template"):
1. **Where are we?** — source-of-truth pipeline. KPIs full-width. All statuses. Same as default All Grants but pre-saved.
2. **Board / Leadership** — period-anchored (YTD), audience-translated labels, simplified columns, prominent Export button.
3. **At-Risk Pipeline** — pre-filtered to grants with deadline within 30 days AND (no submission goal OR no owner). KPIs: Total At-Risk | $ at risk | Avg days to deadline | Unowned count.

**User-saved views:**
- Created from any All Grants configuration via "Save as view…"
- Live in left nav under "My views"
- Context menu: rename, share, delete, export

**Fork-on-edit behavior:**
- Editing a canned template (changing a filter, hiding a column, etc.) triggers a banner: *"You're editing a copy of '[Template Name]'. Save as new view?"*
- Original template remains untouched
- "Save as…" creates the user's forked copy
- This protects best-practice templates from accidental modification AND lets templates evolve over time without overwriting user work

**Audience archetypes** (used by Board template and Export):
| Archetype | Behavior |
|---|---|
| Internal | All fields, internal status labels |
| Board | Plain-English status ("LOI In Progress" → "Initial Outreach"), sensitive columns hidden, period-anchored |
| Executive Leadership | KPI-forward, internal labels OK, less detail than internal |
| Finance | Receivables and spend-anchored fields prominent |
| Program Director | Scoped to specific program; spend-down fields prominent |

---

### 5.4 Bridges (cross-cutting click-throughs)

**Principle:** Every aggregate and every issue is clickable. There are no dead numbers in the product.

**From My Work:**
- Click any issue row → grant detail with relevant field highlighted
- Click bulk action → applies to selected issues, returns to issue list with toast confirmation

**From any KPI tile (in All Grants or saved view):**
- Click → table reconfigures with filter chip showing provenance
- Filter chip language: *"From: Q1 2026 Awarded — $400k"*
- KPIs above re-aggregate to filtered scope
- Back affordance preserves source view state

**From any chart segment (in saved views with charts):**
- Same as KPI tile — click drills into contributing records

**Back affordance:**
- Breadcrumb-style at top-left: *"← Back to Where are we?"*
- Preserves period, filter, audience, scroll position

---

### 5.5 Export as visual-rich report

**Principle:** Any saved view (canned or user-built) can be exported. The export is visual-rich — KPIs render as visuals, charts render as charts, formatting carries through.

**Trigger:** "Export" button on any saved view, OR via chat: "Export this as PDF."

**Export modal:**
- Format selector: **PDF** (default) | Excel | CSV | Share-link
- Audience archetype selector: Internal | Board | Executive Leadership | Finance | Program Director
- Live preview pane updates as audience changes (different labels, hidden columns, different title)
- Section-level export: checkboxes next to each chart/KPI section
- "Generate" button → toast confirmation with download link

**Format behaviors:**
| Format | What it preserves |
|---|---|
| **PDF** | Full visual: KPI tiles, charts, audience-translated labels, formatting |
| **Excel** | Underlying data with audience-translated column headers |
| **CSV** | Raw data, audience-translated column headers |
| **Share-link** | Live, read-only web view; recipient can click charts but can't edit |

**v1 scope:** Export-as-snapshot (each export is independent).
**v2 candidates:** Scheduled recurring delivery; edit audit log; multi-view report composition.

---

## 6. Agent layer (cross-cutting)

**Principle:** The agent does anything the UI can do, through natural language. It does not introduce capabilities that have no UI equivalent (avoiding a divided product).

**UI:** Docked right panel (~360px), collapsible. Empty state shows suggested prompts that change with current view. Message thread; user right-aligned, agent left-aligned.

### Agent capabilities by surface

**My Work:**
- Tune thresholds: *"Change upcoming deadlines to within 10 days"* → applies, count updates, toast confirms
- Scope: *"Only show my grants"* → filter applied with chip
- Explain: *"Why is Racine flagged as underspend?"* → articulates the rule
- Bulk: *"Snooze all upcoming deadlines for 7 days"* → applies to all rows in tab

**All Grants:**
- Filter: *"Show me foundation grants"* / *"Show grants with amount > $50k"*
- Sort: *"Sort by deadline"* / *"Order by amount descending"*
- Group: *"Group by status"* / *"Group by owner"*
- Columns: *"Show only application phase columns"* / *"Hide notes"*
- Update: *"Update Skoll Wetlands status to Awarded"*
- Add: *"Create a new grant for the Apple Children's Education Fund with deadline December 12"*
- Import: *"Take this spreadsheet of grants and put it into my tracker"*

**Saved Views:**
- Save: *"Save this view as 'Q2 Awards'"*
- Load: *"Load view 'Upcoming Deadlines'"*
- List: *"What views do I have?"*
- Create by language: *"Show me all grants due next month without an assigned task"* → view materializes; user can save it

**Bridges:**
- Drill via language: *"Show me the records behind the Q1 awarded number"* → same as clicking the KPI
- Q&A: *"How many grants are awarded?"* / *"What's the total amount requested this quarter?"*

**Export:**
- Export by language: *"Export this as PDF"* / *"Generate a board report"*

### Design principles for agents

- **Suggest, don't auto-apply.** Every action confirmed by the user. The agent makes the change in the UI; the user sees what changed.
- **Explain on request.** "Why?" is always answerable — the agent should articulate the rule that produced any flag, count, or KPI.
- **No new ground.** Agents do what the UI can do, faster. Same data model, same actions, different interface.
- **Peer to UI.** Power users prefer chat; visual users prefer clicks. Both work; both are first-class.
- **Confirm destructive actions.** Delete, status changes to terminal states (Awarded/Declined), bulk operations require confirmation.

### Sample agent exchanges (use as canonical)

1. *"Why is the Racine Community Foundation grant flagged as underspend?"*
   → "This grant has used 40% of its budget but is 80% through its timeline. We flag underspend when usage is more than 20% behind expected pace. Want me to show you the spend chart?"

2. *"Only show my grants"*
   → "Done. Filtered to grants where owner is Elizabeth." [filter chip appears]

3. *"Change upcoming deadlines to within 10 days instead of 14"*
   → "Done. Your alert threshold for upcoming deadlines is now 10 days. Three issues moved out of Upcoming."

4. *"Show me grants due next month without an assigned task"*
   → "Found 4 grants. Want me to save this as a view?" [filtered table appears]

5. *"Export this as PDF"*
   → "I'll export the current view as a Board / Leadership report. Confirm audience archetype?" [audience dropdown defaults to 'Board']
   [User confirms]
   → "Done. Board Report — May 2026.pdf is ready."

6. *"Create a new grant for the Apple Children's Education Fund with a deadline on December 12"*
   → "Created. Apple Children's Education Fund, deadline Dec 12, 2026. Status: Researching, owner: unassigned. Want to add more details?"

7. *"How many grants are awarded?"*
   → "10 grants — totaling $400k in awards. 7 are active, 3 are closed."

8. *"Why?"* (after any filter or flag)
   → Articulate the rule that produced the flag/filter, in 1–2 sentences.

---

## 7. Data model essentials

### Canonical grant fields

**Identity:** Grant ID, Grant Name, Funder, Funder Type (Foundation / Government / Corporate / Federal / State / Local / Private Foundation / Public Foundation), Funder Subtype

**Status & lifecycle:** Status (Researching / LOI In Progress / Application In Progress / Submitted / Awarded - Active / Awarded - Closed / Declined / Rolling / Planned), Phase (Prospecting / Application / Award / Financial / Compliance / Reporting), Lifecycle stage

**Dates:** LOI Deadline, Pre-proposal Deadline, Full Proposal Deadline, Submission Date, Notification Date (anticipated + actual), Award Period Start, Award Period End, Reporting Deadlines (multiple)

**Financials:** Amount Requested, Amount Awarded, Amount Received, Spend Pace (computed), Budget, Actual Spend (computed)

**Ownership & assignment:** Owner, Assigned Team, Last Updated, Last Activity Date

**Categorization:** Category / Field of Work, Project, Program (multi-value, primary/secondary, hierarchy-aware), Department

**Custom fields:** User-defined fields with proper data types (text, date, number, currency, single-select, multi-select)

**Compliance:** Reporting requirements, audit-ready flag, integration status

### Issue derivations (My Work)

Issues are **computed**, not stored. Rules:

| Issue | Trigger |
|---|---|
| Overdue | `deadline < today AND status NOT IN [Submitted, Awarded, Declined]` |
| Upcoming | `deadline BETWEEN today AND today + N_days` (default N=14, user-configurable) |
| Spend (under) | `actual_spend / budget < 0.8 * (time_elapsed / time_total)` |
| Spend (over) | `actual_spend / budget > 1.2 * (time_elapsed / time_total)` |
| Missing Data | `owner IS NULL OR deadline IS NULL OR (status = 'Awarded - Active' AND budget IS NULL)` |
| Set Up | `accounting_integration_status != 'connected' OR fields_partially_mapped` |
| Inactive | `last_activity_date < today - X_days` (default X=30) |

### Saved view definition

A saved view is the union of:
- Filter (multiple conditions, AND/OR composition)
- Sort (column + direction, multi-level)
- Group (single column, with subtotal aggregation)
- Visible columns (ordered list)
- KPI tiles (which to show, in what order)
- Audience archetype (Internal | Board | Executive Leadership | Finance | Program Director)

A canned template is a saved view shipped by Instrumentl, marked read-only with fork-on-edit.

---

## 8. Demo narrative — Elizabeth's Monday morning

**8:47 AM.** Elizabeth opens Instrumentl. She lands on **My Work**.

She sees 8 issues across tabs: 2 Overdue, 3 Upcoming, 1 Spend, 1 Missing Data, 1 Set Up. The Overdue tab shows *Versafund Grant Program — Full Proposal Deadline overdue by 3 days.* She clicks the row, lands on the grant, sees the deadline field highlighted, updates status to Submitted, adds a note. **Issue resolved in 30 seconds.**

Next: Spend. *Racine Community Foundation grant — Under-spend $25k under plan.* She types in chat: *"Why is this flagged?"* The agent answers: *"This grant has used 40% of its budget but is 80% through its timeline. We flag underspend when usage is more than 20% behind expected pace."* She clicks through to the grant, reaches out to the program lead. **Issue understood, action delegated.**

Missing Data: *Fry Foundation grant — Owner not assigned.* She bulk-selects three Researching-stage grants and assigns them to Lauren in one action.

Four issues fixed in under 5 minutes. **Now she wants the bigger picture.**

She switches to **Where are we?** — a canned saved view. The KPI tiles aggregate live: 2,000 Prospects | 10 Applications In Progress | 21 Submitted | 10 Awarded ($400k) | 100 Lost | 25% Win Rate. She clicks the Awarded tile. The All Grants table reconfigures, filter chip showing *"From: Awarded."* She scans the 10 awarded grants — looks healthy.

**The board email is at 10 AM.**

She opens the **Board / Leadership** canned saved view. KPIs are period-anchored (YTD), labels are board-language, internal columns hidden. She types in chat: *"Export this as PDF."* The agent confirms the audience archetype, generates the PDF with KPIs, charts, and audience-translated content. She attaches it to the email and hits send. **Two minutes.**

No spreadsheet was opened. No data was massaged. The tracker WAS the report.

---

## 9. Visual & aesthetic direction

**Tone:** Confident, calm, data-rich. Not generic SaaS. Not a dashboard.

**Reference:** "FT.com meets Linear." Editorial discipline, restrained color, generous whitespace, distinctive typography.

**Avoid:**
- Purple gradients on white
- Generic system fonts (Inter, Roboto, Arial)
- Predictable shadcn-default look
- Traffic-light color coding
- Alarming red/yellow/green dashboards

**Lean toward:**
- A distinctive serif display font for headers (e.g., Tiempos, Söhne Mono, Domaine, EB Garamond) paired with a clean modern sans for body
- One deliberate accent color for action — not blue. Consider deep ochre, forest, oxblood, or graphite-with-amber.
- Subtle dividers and grid structure
- Issue-type pills should feel like editorial labels, not alerts
- Calm typographic hierarchy — let the content do the work, not the chrome

---

## 10. Sample data (use across surfaces)

### Grants (15 records)

| # | Grant | Funder | Amount | Deadline | Status | Owner | Last Updated |
|---|---|---|---|---|---|---|---|
| 1 | Skoll Wetlands Grant | Skoll Foundation | $75k | May 5, 2026 | Application In Progress | Lauren | Apr 29 |
| 2 | Hewlett Climate Grant | Hewlett Foundation | $150k | n/a | Awarded - Active | Elizabeth | Apr 30 |
| 3 | Racine Community Foundation | Racine Community Foundation | $50k | n/a | Awarded - Active | Elizabeth | May 1 |
| 4 | America's Healthy Food Financing Initiative | USDA | $250k | n/a | Awarded - Active | Elizabeth | May 1 |
| 5 | CenterPoint Foundation Charitable Giving | CenterPoint Foundation | $40k | n/a | Awarded - Active | Elizabeth | Apr 30 |
| 6 | Old National Bank | Old National Bank | $25k | n/a | Application In Progress | Elizabeth | Jan 1, 2023 |
| 7 | Versafund Grant Program | Versafund | $100k | May 1, 2026 (overdue) | Application In Progress | Lauren | May 1 |
| 8 | Fry Foundation: Employment Grant | Fry Foundation | $80k | Jul 15, 2026 | Researching | (unassigned) | Apr 30 |
| 9 | Kresge Foundation | Kresge Foundation | $200k | May 4, 2026 (overdue LOI) | LOI In Progress | Elizabeth | May 4 |
| 10 | Bezos Earth Fund | Bezos Earth Fund | $300k | May 12, 2026 | Researching | Lauren | May 2 |
| 11 | NEA Arts Grant | National Endowment for the Arts | $60k | Jun 30, 2026 | LOI In Progress | Lauren | Apr 28 |
| 12 | Ford Foundation Equity Initiative | Ford Foundation | $500k | n/a | Awarded - Active | Elizabeth | Apr 15 |
| 13 | MacArthur Capacity Building | MacArthur Foundation | $120k | n/a | Declined | Lauren | Mar 20 |
| 14 | Walmart Community Grant | Walmart Foundation | $15k | Aug 1, 2026 | Researching | Elizabeth | Apr 25 |
| 15 | Robert Wood Johnson | RWJ Foundation | $400k | Sep 15, 2026 | Application In Progress | Lauren | May 3 |

### Issues (8 active for Elizabeth)

**Overdue (2):**
- Versafund Grant Program — Full Proposal Deadline overdue by 3 days. Owner: Lauren. Status: Application In Progress.
- Kresge Foundation — LOI Deadline overdue by 1 day. Owner: Elizabeth. Status: LOI In Progress.

**Upcoming (3):**
- Skoll Wetlands Grant — Full Proposal Deadline due May 5, 2026. Owner: Lauren.
- Hewlett Climate Grant — Task: Report due May 15, 2026. Owner: Elizabeth.
- Bezos Earth Fund — LOI Deadline due May 12, 2026. Owner: Lauren.

**Spend (2):**
- Racine Community Foundation Grant — Under-spend, $25k under plan. Owner: Elizabeth.
- America's Healthy Food Financing Initiative — Over-spend, $50k over plan. Owner: Elizabeth.

**Missing Data (1):**
- Fry Foundation: Employment Grant — Owner not assigned. Status: Researching.

**Set Up (1):**
- CenterPoint Foundation Charitable Giving — Accounting Integration incomplete. Owner: Elizabeth.

**Inactive (0):** [Show empty state — *"Nothing inactive. Nice."*]

### KPI initial values (full portfolio scope)

- Total Prospects: 2,000 (researched)
- Applications In Progress: 10 ($500k requested)
- Submitted: 21 ($1M requested)
- Awarded: 10 ($400k)
- Lost: 100 ($4M)
- Win Rate: 25%

---

## 11. Open questions (track these, don't block on them)

**My Work:**
- 6 issue types or 7? (Reporting deadline approaching is a likely add — Becki's #1 ask)
- Tabbed-by-type or single grouped feed?
- Per-user threshold tuning v1 or v2?

**All Grants:**
- Are dynamic KPI tiles the right top-of-view aggregation, or sticky?
- Should saved views be team-shareable by default or personal?

**Saved Views:**
- 3 canned templates the right starting set, or more/fewer?
- Fork-on-edit UX: silent toast vs. banner vs. explicit prompt?

**Bridges:**
- Filter-chip provenance language — what does "From: Q1 Awarded" actually say?
- Back affordance: breadcrumb, side panel, or modal layering?

**Export:**
- Scheduled recurring delivery v1 or v2?
- Audience archetypes — how many, how editable?

**Agent:**
- Confirmation UX for destructive actions — modal, inline, or just a toast with undo?

---

## 12. What's NOT in v1 (explicit cuts)

- Real spend pacing logic (mocked in prototype)
- Permission scoping (program staff seeing only their grants)
- Scheduled email delivery of saved views
- Multi-view report composition (combining multiple views into one report)
- Edit audit log on saved views
- Real LLM-powered agent (scripted in prototype)
- Mobile responsive design (desktop-first for Elizabeth's use case)
- Real-time collaboration (Lauren and Elizabeth editing simultaneously)

---

## 13. Success criteria

The prototype is successful if a viewer:
- Lands on My Work and immediately understands what each tab means without explanation
- Can articulate the difference between My Work and All Grants after one walk-through
- Can describe how a saved view becomes a board report
- Believes Elizabeth could send her board email in 2 minutes
- Asks "wait, where's the reporting tool?" — and we get to answer "the tracker IS the report"

The product is successful if Elizabeth:
- Stops opening Excel
- Trusts the tracker enough to send board reports straight from it
- Finds new things to use the agent for that we didn't anticipate

---

## 14. Glossary

- **Canonical tracker** — the dumb table holding every grant. The single source of truth.
- **My Work** — the issue-shaped view; the daily landing.
- **Issue** — a derived (not stored) condition that needs the user's attention. Six types: Overdue, Upcoming, Spend, Missing Data, Set Up, Inactive.
- **Saved view** — a configuration of the All Grants table (filter + sort + group + columns + KPIs + audience).
- **Canned template** — a saved view shipped by Instrumentl as best practice. Read-only original; forks on edit.
- **Audience archetype** — a preset translation layer (Board, Executive Leadership, Finance, Program Director, Internal) that swaps labels and hides sensitive columns.
- **Bridge** — a click-through from an aggregate (KPI, issue count, chart segment) to the underlying records.
- **Agent** — the chat-based interface to all UI actions. Same data, different interface.
- **Fork-on-edit** — the behavior where editing a canned template auto-creates a copy, preserving the original.
