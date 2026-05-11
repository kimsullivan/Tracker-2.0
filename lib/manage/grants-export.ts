/**
 * Client-only: build PDF / CSV from the current grants table scope (prototype).
 */

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { team } from "@/lib/manage/data"
import { grantDisplayTitle } from "@/lib/manage/grant-context"
import type { Grant } from "@/lib/manage/types"
import { awardedSumGrant, renewalStatusForGrant } from "@/lib/manage/funder-portfolio"

export type GrantExportColumn = { key: string; label: string }

function ownerName(id: string): string {
  return team.find((t) => t.id === id)?.name ?? id
}

function fmtAwardK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function fmtBoardAward(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

/** Plain-text cell values aligned with the All grants table rendering. */
export function formatGrantExportCell(grant: Grant, columnKey: string): string {
  switch (columnKey) {
    case "grant":
      return `${grantDisplayTitle(grant)} (${grant.id})${grant.flagged ? " · Flagged" : ""}${grant.blocked ? " · Blocked" : ""}`
    case "funder":
      return grant.funder
    case "status":
      return grant.stage
    case "deadline": {
      const short = new Date(grant.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      return `${short} · ${grant.daysToDeadline}d`
    }
    case "award":
      return fmtAwardK(grant.award)
    case "amountRequested": {
      const w = grant.weighted ?? 0
      return w > 0 ? fmtAwardK(w) : "—"
    }
    case "notificationDate":
      return grant.lastUpdated
    case "owner":
      return ownerName(grant.ownerId)
    case "cycle":
      return grant.cycle
    case "fundingSource":
      return grant.fundingSource
    case "fain":
      return grant.fain ?? "—"
    case "cfda":
      return grant.cfda ?? "—"
    case "period":
      return grant.period ?? "—"
    case "indirect":
      return grant.indirect != null ? `${(grant.indirect * 100).toFixed(1)}%` : "—"
    case "match":
      return grant.matchRequired === undefined ? "—" : grant.matchRequired ? "Required" : "—"
    case "lastUpdated":
      return grant.lastUpdated
    case "projectGroup":
      return grant.projectGroup
    case "priority":
      return grant.priority
    case "renewal":
      return grant.renewalLikelihood
    case "fpFunder":
      return grant.funder
    case "fpFunderType":
      return grant.funderType
    case "fpTotalAwarded":
      return fmtBoardAward(awardedSumGrant(grant))
    case "fpLastActivity":
      return grant.lastUpdated
    case "fpRenewalStatus":
      return renewalStatusForGrant(grant, new Date())
    default:
      return "—"
  }
}

function buildTableRows(grants: Grant[], columns: GrantExportColumn[]): string[][] {
  return grants.map((g) => columns.map((c) => formatGrantExportCell(g, c.key)))
}

export type GrantExportPdfGroup = { title: string; items: Grant[] }

export type GrantExportPdfMetrics = {
  /** E.g. "Stage", "Deadline month" — shown in the summary band. */
  groupedByLabel?: string
  totalGrants: number
  /** Non-empty when export is grouped. */
  groupCount?: number
  sumAwardTotal: number
  sumWeightedTotal: number
}

const TWILIGHT_RGB: [number, number, number] = [109, 106, 188]
const TWILIGHT_BAND_RGB: [number, number, number] = [237, 235, 252]
const TWILIGHT_ROW_RGB: [number, number, number] = [245, 244, 251]

function groupPipelineTotals(items: Grant[]): { sumAward: number; sumWeighted: number } {
  return {
    sumAward: items.reduce((s, g) => s + g.award, 0),
    sumWeighted: items.reduce((s, g) => s + (g.weighted ?? 0), 0),
  }
}

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[/\\?%*:|"<>.\s]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "grants-export"
}

export function downloadGrantsCsvReport(opts: {
  grants: Grant[]
  columns: GrantExportColumn[]
  filenameBase: string
  /** When set with `includeGroupColumn`, rows are emitted in section order with a leading Group column. */
  groups?: GrantExportPdfGroup[]
  includeGroupColumn?: boolean
}): void {
  const { grants, columns, filenameBase, groups, includeGroupColumn } = opts
  const useGroups = Boolean(includeGroupColumn && groups && groups.length)
  const headers = useGroups ? ["Group", ...columns.map((c) => c.label)] : columns.map((c) => c.label)
  const rows = useGroups
    ? groups!.flatMap((section) =>
        buildTableRows(section.items, columns).map((r) => [section.title, ...r]),
      )
    : buildTableRows(grants, columns)
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))]
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${sanitizeFilenamePart(filenameBase)}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadGrantsPdfReport(opts: {
  grants: Grant[]
  columns: GrantExportColumn[]
  title: string
  subtitle: string
  filenameBase: string
  /** Per-section tables; omit for one flat table (same as `grants`). */
  groups?: GrantExportPdfGroup[]
  metrics?: GrantExportPdfMetrics
}): void {
  const { grants, columns, title, subtitle, filenameBase, groups, metrics } = opts

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  let y = 44

  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(28, 28, 32)
  doc.text(title, margin, y)
  y += 6
  doc.setFillColor(...TWILIGHT_RGB)
  doc.rect(margin, y, Math.min(180, pageW - margin * 2), 3, "F")
  y += 18
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 85)
  const subLines = doc.splitTextToSize(
    subtitle || `Generated ${new Date().toLocaleString()} · ${grants.length} grants`,
    pageW - margin * 2,
  )
  doc.text(subLines, margin, y)
  y += 12 + (Array.isArray(subLines) ? subLines.length * 12 : 12)

  const summaryH = metrics ? 50 : 0
  if (metrics) {
    doc.setFillColor(...TWILIGHT_BAND_RGB)
    doc.rect(margin, y, pageW - margin * 2, summaryH, "F")
    doc.setDrawColor(215, 208, 235)
    doc.setLineWidth(0.4)
    doc.line(margin, y + summaryH, pageW - margin, y + summaryH)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...TWILIGHT_RGB)
    const leftPad = margin + 12
    let line1 = `${metrics.totalGrants} grant${metrics.totalGrants === 1 ? "" : "s"}`
    if (metrics.groupedByLabel && metrics.groupCount != null) {
      line1 += ` · ${metrics.groupCount} ${metrics.groupedByLabel.toLowerCase()} group${metrics.groupCount === 1 ? "" : "s"}`
    }
    doc.text(line1, leftPad, y + 22)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(72, 72, 78)
    let line2 = `Pipeline (unweighted) ${fmtAwardK(metrics.sumAwardTotal)}`
    if (metrics.sumWeightedTotal > 0) {
      line2 += ` · Weighted ask ${fmtAwardK(metrics.sumWeightedTotal)}`
    }
    doc.text(line2, leftPad, y + 40)

    y += summaryH + 6
  }

  const head = [columns.map((c) => c.label)]
  const sections: GrantExportPdfGroup[] =
    groups && groups.length > 0 ? groups : [{ title: "", items: grants }]

  const tableCommon = {
    head,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" as const, valign: "middle" as const },
    headStyles: {
      fillColor: TWILIGHT_RGB,
      textColor: 255,
      fontStyle: "bold" as const,
    },
    alternateRowStyles: { fillColor: TWILIGHT_ROW_RGB },
    tableWidth: "auto" as const,
  }

  let cursorY = y + (metrics ? 4 : 8)
  const bottomPad = 56
  const multiSection = Boolean(groups && groups.length > 0)

  for (const section of sections) {
    if (section.items.length === 0) continue

    const needHeader = multiSection && section.title.length > 0
    let bandH = 0
    let titleLines: string | string[] = section.title
    if (needHeader) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      titleLines = doc.splitTextToSize(section.title, pageW - margin * 2 - 20)
      const nTitle = Array.isArray(titleLines) ? titleLines.length : 1
      bandH = 12 + nTitle * 13 + 16
    }

    const minTableTail = 72
    while (cursorY + bandH + minTableTail > pageH - bottomPad) {
      doc.addPage()
      cursorY = 44
    }

    if (needHeader) {
      const bandY = cursorY
      doc.setFillColor(...TWILIGHT_ROW_RGB)
      doc.rect(margin, bandY, pageW - margin * 2, bandH, "F")
      doc.setDrawColor(220, 215, 235)
      doc.line(margin, bandY + bandH, pageW - margin, bandY + bandH)

      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(...TWILIGHT_RGB)
      doc.text(titleLines, margin + 10, bandY + 14)

      const { sumAward, sumWeighted } = groupPipelineTotals(section.items)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(88, 88, 94)
      const nTitle = Array.isArray(titleLines) ? titleLines.length : 1
      let meta = `${section.items.length} grant${section.items.length === 1 ? "" : "s"} · ${fmtAwardK(sumAward)} pipeline`
      if (sumWeighted > 0) meta += ` · ${fmtAwardK(sumWeighted)} weighted`
      doc.text(meta, margin + 10, bandY + 12 + nTitle * 13 + 12)

      cursorY = bandY + bandH + 6
    }

    autoTable(doc, {
      ...tableCommon,
      startY: cursorY + 4,
      body: buildTableRows(section.items, columns),
    })

    const finalY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? cursorY
    cursorY = finalY + 16
  }

  doc.save(`${sanitizeFilenamePart(filenameBase)}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
