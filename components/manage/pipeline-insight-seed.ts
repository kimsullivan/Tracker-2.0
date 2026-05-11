import type { ChatSource } from "@/components/manage/chat-inline-viz"
import type { StandaloneAgentMessage } from "@/components/manage/chat-panel.standalone"
import type { MixAltAgentTurn } from "@/components/manage/mix-alt-agent"

const INSIGHT_PORTFOLIO_SOURCE: ChatSource = {
  title: "All grants · Where are we?",
  detail: "Funnel counts, win rate, and in-flight dollars · FY 2026 view",
  href: "https://www.instrumentl.com/blog/grant-management/",
}

const INSIGHT_PROSPECT_MIX_SOURCE: ChatSource = {
  title: "Prospect mix (considered)",
  detail: "Funder-type split on considered prospects vs. submitted / awarded",
  href: "https://www.instrumentl.com/",
}

const UG_COMPLIANCE_SOURCE: ChatSource = {
  title: "Uniform Guidance (2 CFR 200)",
  detail: "Cost principles, indirects, and single audit thresholds — federal posture",
  href: "https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200",
}

const BOARD_GOVERNANCE_SOURCE: ChatSource = {
  title: "Board oversight of reserves & concentration",
  detail: "Narrative risk framing for diversified revenue (prototype crib)",
  href: "https://www.councilofnonprofits.org/tools-resources",
}

export const PIPELINE_INSIGHT_FOLLOW_UP_CHIPS: string[] = [
  "Which Private funders should I prioritize?",
  "What Federal funders match my org profile?",
  "Show me how to interpret this for my board",
]

const PIPELINE_INSIGHT_OPENING = `I flagged this because two things are happening at once in your pipeline:

Your win rate jumped from 22% to 31% — a 9-point gain. That's a strong signal your team is qualifying better.

But your prospect base has narrowed. 978 of your 1,258 considered prospects (78%) are Private funders. You have zero applications in flight from Federal or State sources, even though you considered them earlier in the year.

The risk: your $4.0M in flight is concentrated in 11 applications, averaging $364K each. A single loss in the in-progress pool would erase roughly 9% of your awarded total. With no Federal or State pipeline to backstop, you don't have a diversified base to fall back on if Private foundation giving softens.`

export function getPipelineInsightInitialMessages(): StandaloneAgentMessage[] {
  const t = Date.now()
  return [
    {
      id: "pipeline-insight-user",
      role: "user",
      markdown: false,
      at: t,
      body: "What's going on with my pipeline?",
    },
    {
      id: "pipeline-insight-open",
      role: "agent",
      markdown: false,
      at: t + 1,
      body: PIPELINE_INSIGHT_OPENING,
      sources: [INSIGHT_PORTFOLIO_SOURCE, INSIGHT_PROSPECT_MIX_SOURCE, UG_COMPLIANCE_SOURCE],
    },
  ]
}

/** Scripted assistant replies for the three “Suggested follow-ups” chips (pipeline insight chat). */
export function matchPipelineInsightChips(trimmed: string): MixAltAgentTurn | null {
  const t = trimmed.trim()
  const [chipPrivate, chipFederal, chipBoard] = PIPELINE_INSIGHT_FOLLOW_UP_CHIPS

  if (t === chipPrivate) {
    return {
      effects: [],
      sources: [
        INSIGHT_PORTFOLIO_SOURCE,
        {
          title: "Relationship velocity (demo)",
          detail: "Last-touch + stage movement heuristics used to stack-rank prospects",
          href: "https://www.instrumentl.com/blog/grant-prospect-research/",
        },
      ],
      agentBody: `Start with renewals and near-award conversations where you already have relationship heat — those close fastest while your win rate is up.

Then rank remaining Private prospects by (1) fit to your current programs, (2) typical check size vs. your ask band, and (3) last meaningful touch. Anything stale 90+ days without a path to a decision should drop to a nurture lane so it doesn’t crowd your week.

If you want this in the table next, filter to Private + active stages and sort by deadline — I can walk you through who to call first.`,
    }
  }

  if (t === chipFederal) {
    return {
      effects: [],
      sources: [
        INSIGHT_PROSPECT_MIX_SOURCE,
        UG_COMPLIANCE_SOURCE,
        {
          title: "Grants.gov program discovery",
          detail: "Keyword + CFDA alignment patterns for comparable org profiles (prototype)",
          href: "https://www.grants.gov/",
        },
      ],
      agentBody: `Federal is quiet in your pipeline right now, so the honest answer is: you’re not “missing obvious awards” in this slice — you’re under-exposed at the top of the funnel.

Look for agencies whose NOFOs repeat on a cadence you can plan around (annual program lines, set-asides, or partnerships where you can subcontract). Match matters more than volume: indirects, cost principles, and single-audit readiness are where federal diligence diverges from private foundations.

Practical next step: pick two program offices that fund outcomes like yours, capture their eligibility guardrails in a one-pager, and decide whether pursuit is worth the compliance lift this year vs. doubling down on private.`,
    }
  }

  if (t === chipBoard) {
    return {
      effects: [],
      sources: [
        INSIGHT_PORTFOLIO_SOURCE,
        BOARD_GOVERNANCE_SOURCE,
        {
          title: "Win rate vs. pipeline breadth",
          detail: "Internal roll-up: trailing win rate + considered funder-type concentration",
          href: "https://www.instrumentl.com/",
        },
      ],
      agentBody: `Lead with the good news: win rate moved from 22% to 31% — that’s evidence your qualification discipline is working.

Then name the concentration risk plainly: most considered prospects are Private, and you have no federal/state in flight, so diversification is thin if private giving softens. Pair that with the dollar-at-risk framing (in-flight dollars concentrated across a small set of applications) so it feels operational, not alarmist.

Close with the ask: one diversification experiment (even modest) and a single “pipeline health” metric you’ll report next meeting — boards govern what gets measured.`,
    }
  }

  return null
}
