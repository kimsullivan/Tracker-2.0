import type { Grant, ProjectGroup, Stage } from "@/lib/manage/types"

/**
 * User-facing grant name: drop “Funder · program” / trailing “ · {funder}” patterns so the title is the grant
 * program line, not a second funder label (funder stays on `grant.funder`).
 */
export function grantDisplayTitle(g: Pick<Grant, "title" | "funder">): string {
  const t = g.title.trim()
  const f = g.funder.trim()
  if (!t) return t
  if (!f) return t

  const fLower = f.toLowerCase()
  const tLower = t.toLowerCase()
  const suffix = ` · ${f}`
  if (tLower.endsWith(suffix.toLowerCase())) {
    return t.slice(0, t.length - suffix.length).trim()
  }

  const parts = t.split(/\s*·\s*/)
  if (parts.length < 2) return t

  const first = parts[0]!.trim()
  const rest = parts.slice(1).join(" · ").trim()
  if (!rest) return t

  // “Program · Skoll” where funder is “Skoll Foundation” — second token is a short funder prefix.
  if (parts.length === 2) {
    const restLower = rest.toLowerCase()
    if (restLower.length >= 3 && restLower.length <= 32 && fLower.startsWith(restLower)) {
      return first
    }
  }

  // Keep titles like “Skoll Award · …” — first segment is a grant line, not the funder org.
  if (/\b(award|cohort|pilot|rfp)\b/i.test(first)) return t

  const firstLower = first.toLowerCase()
  if (firstLower === fLower) return rest

  if (fLower.includes(firstLower) && firstLower.length >= 6) return rest

  const fw = firstLower.split(/[/\s]+/).filter(Boolean)[0] ?? ""
  const f0 = fLower.split(/[/\s]+/).filter(Boolean)[0] ?? ""
  if (fw.length >= 4 && fw === f0 && first.length <= f.length + 8) return rest

  return t
}

const SERVICE_AREA_BY_PROJECT: Record<ProjectGroup, string> = {
  "Health Equity": "FQHC-led cohorts across Hampden & Hartford counties (MA / CT)",
  Workforce: "Greater Boston, Worcester, and Gateway Cities — employer + training partners",
  "General Op": "Greater Hartford nonprofit hub — HQ and satellite program offices",
  Capacity: "Statewide partners — regional TA providers and backbone orgs",
  Research: "Academic medical center + community field sites (IRB-governed)",
}

function moneyFmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

export function resolvedServiceArea(g: Grant): string {
  return g.serviceArea ?? SERVICE_AREA_BY_PROJECT[g.projectGroup]
}

export function resolvedGeography(g: Grant): string {
  if (g.geography) return g.geography
  if (g.funderType === "Federal") {
    return "Prime · Springfield Clinical Consortium (MA) · federal pass-through to sites"
  }
  if (g.funderType === "State" || g.funderType === "Local") {
    return "Lead applicant · state-registered nonprofit (MA)"
  }
  return "Lead applicant · Community Care Collaborative (MA)"
}

export function resolvedProgramSummary(g: Grant, stage: Stage): string {
  if (g.programSummary) return g.programSummary
  const period = g.period ? `Award window ${g.period}. ` : ""
  const ask = moneyFmt(g.award)
  const weighted = g.weighted != null && g.weighted !== g.award ? ` Weighted pipeline ≈ ${moneyFmt(g.weighted)}.` : ""
  const match = g.matchRequired ? " Formal match / cost-share is in scope for this funder." : ""
  const indirect = g.indirect != null ? ` Indirect rate modeled at ${Math.round(g.indirect * 100)}%.` : ""
  const risk = g.flagged
    ? " Flagged for portfolio review (capacity or relationship)."
    : g.blocked
      ? ` Blocked: ${g.blockedReason ?? "see queue"}.`
      : ""
  return `${grantDisplayTitle(g)} is tracked as ${g.projectGroup} with ${g.funder} (${g.funderType}). Status is ${stage}. ${period}Planning basis is about ${ask} for this cycle.${weighted}${match}${indirect}${risk} Next action on file: ${g.nextAction}.`
}

export function formatPortfolioDeadline(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

export function deadlineRelativeLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `in ${days} days`
}

/** Organization / applicant location — not service-area “where we operate.” */
export function resolvedOpportunityLocation(g: Grant): string {
  return g.opportunityLocation ?? g.geography ?? "Applicant location not set — add HQ / legal domicile in grant settings (demo)."
}

export function resolvedProjectLocation(g: Grant): string {
  if (g.projectLocation) return g.projectLocation
  if (g.funderType === "Federal") {
    return "Project activity at sites and subcontractors listed in the NOFO, budget, and federal site assurances; update with formal site roster post-award."
  }
  return "Project activity at sites and markets described in the proposal narrative and budget (demo)."
}

export function resolvedResidencyLocation(g: Grant): string {
  if (g.residencyLocation) return g.residencyLocation
  return "No applicant or trainee residency requirement on file for this opportunity (demo)."
}

export function resolvedIrs990Snapshot(g: Grant): string {
  if (g.irs990Snapshot) return g.irs990Snapshot
  if (g.funderType === "Federal") {
    return "Federal awards are not summarized on a private foundation 990-PF. Track obligation and subaward data via USASpending / SAM.gov and your audit package (demo)."
  }
  return "Link the latest 990 or 990-PF when diligence is complete — snapshot fields (assets, payouts, lobbying) populate here (demo)."
}

export function resolvedIneligibility(g: Grant): string {
  return (
    g.ineligibility ??
    "Common exclusions: for-profit entities, individuals (except where explicitly allowed), lobbying with restricted funds, duplicate federal funding for the same cost period, and activities outside the funder’s stated purpose (demo)."
  )
}

export function resolvedOpportunityComplianceEtc(g: Grant): string {
  if (g.opportunityCompliance) return g.opportunityCompliance
  const parts: string[] = []
  parts.push(`Funding stream: ${g.fundingSource}.`)
  if (g.cfda || g.fain) {
    parts.push(
      `Identifiers: ${[g.cfda ? `CFDA ${g.cfda}` : "", g.fain ? `FAIN ${g.fain}` : ""].filter(Boolean).join(" · ")}.`,
    )
  } else {
    parts.push("Identifiers: private / foundation stream (no CFDA).")
  }
  parts.push(g.matchRequired ? "Match or cost-share required — confirm allowable sources in budget." : "Match not modeled as required.")
  if (g.indirect != null) {
    parts.push(`Indirect modeled at ${Math.round(g.indirect * 100)}% (verify NICRA / de minimis vs. award terms).`)
  }
  return parts.join(" ")
}
