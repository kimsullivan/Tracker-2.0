import type { StandaloneAgentMessage } from "@/components/manage/chat-panel.standalone"

/** Narrative + task cards — KPIs render in the table header (operator workspace) */
const SHARON_OPENING_MD = `Good morning, Sharon.

You're tracking **64%** to your **$7M** annual target. Federal pipeline is up **2.4×** from Q1 — most of the upside **and** most of the risk this quarter.`

/** Operator prototype: first-thread Sharon briefing (side rail over All grants) */
export const OPERATOR_INITIAL_MESSAGES: StandaloneAgentMessage[] = [
  {
    id: "operator-sharon-brief",
    role: "agent",
    markdown: true,
    at: Date.now(),
    body: SHARON_OPENING_MD,
    sources: [
      {
        title: "Federal match model",
        detail: "SAMHSA trajectory · finance dependency",
        href: "https://example.com/federal-match",
      },
      {
        title: "Skoll · warm intro path",
        detail: "Board routing · Nina thread",
        href: "https://example.com/skoll",
      },
      {
        title: "Capacity signal · Maria",
        detail: "142% load · 3-week streak",
        href: "https://example.com/capacity",
      },
    ],
    viz: [
      {
        kind: "tasks",
        title: "Decisions & actions",
        items: [
          {
            tone: "decision",
            badge: "$1.49M at risk",
            title: "Federal match capacity",
            subtitle:
              "Three federal apps in flight require ~$370K in matching funds. Finance hasn’t confirmed availability. If we can’t match, we’d pull one application — likely SAMHSA (lowest strategic fit).",
            actions: [
              { label: "Loop in finance", href: "https://example.com/finance" },
              { label: "See the math", href: "https://example.com/match-model" },
            ],
          },
          {
            tone: "action",
            badge: "$1.25M opportunity",
            title: "Skoll warm intro",
            subtitle:
              "Nina flagged this needs a board-level connection. M. Reyes and K. Chen have past Skoll relationships per LinkedIn.",
            actions: [{ label: "Draft outreach", href: "https://example.com/skoll-draft" }],
          },
          {
            tone: "signal",
            badge: "Team load",
            title: "Maria at 142% — sustained 3 weeks",
            subtitle:
              "Operating fix is in motion (Jane is rebalancing). Worth a check-in — burnout risk on your strongest grant writer.",
            foot: "Optional: schedule a 15m touchpoint this week.",
          },
        ],
      },
    ],
  },
]

export const OPERATOR_SUGGESTIONS = [
  "What changed since the last board meeting?",
  "Draft the board update",
  "Where will we land at year-end?",
]
