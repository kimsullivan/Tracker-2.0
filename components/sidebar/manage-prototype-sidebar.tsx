"use client"

import { useCallback, useState } from "react"
import type { TabType } from "@/components/dashboard"
import type { Grain } from "@/components/manage/grain-bar"
import { Sidebar } from "./index"
import type { SidebarProps } from "@/components/sidebar/types"

const DEFAULT_COUNTS: SidebarProps["counts"] = {
  matches: 12,
  tracker: 4,
  applications: 2,
  awards: 3,
}

/** Prototype shells always show Tracker as the active nav lane; clicks still navigate. */
const PROTOTYPE_SIDEBAR_ACTIVE_TAB: TabType = "tracker"

/**
 * Lookback `Sidebar` with local prototype state, wired loosely to Traver grain navigation.
 */
export function ManagePrototypeSidebar({
  grain,
  onRequestGrain,
  onClearGrant,
  mixedSavedViewLabels,
}: {
  grain: Grain
  onRequestGrain: (g: Grain) => void
  onClearGrant: () => void
  /** Mixed-alt chat agent — surfaced under sidebar chrome */
  mixedSavedViewLabels?: string[]
}) {
  const [selectedProject, setSelectedProject] = useState<string | null>("all")
  const [showPinnedSidebar, setShowPinnedSidebar] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const onTabChange = useCallback(
    (tab: TabType) => {
      if (tab === "hq-dashboard" || tab === "calendar" || tab === "reports") {
        onRequestGrain("command")
        onClearGrant()
        return
      }
      if (
        tab === "tracker" ||
        tab === "matches" ||
        tab === "awards" ||
        tab === "peers" ||
        tab === "hidden" ||
        tab === "tasks" ||
        tab === "documents" ||
        tab === "hq-approvals" ||
        tab === "projects"
      ) {
        onRequestGrain("all-grants")
        onClearGrant()
      }
    },
    [onClearGrant, onRequestGrain],
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 shrink-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <Sidebar
          activeTab={PROTOTYPE_SIDEBAR_ACTIVE_TAB}
          onTabChange={onTabChange}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          counts={DEFAULT_COUNTS}
          allProjectsCounts={DEFAULT_COUNTS}
          showPinnedSidebar={showPinnedSidebar}
          setShowPinnedSidebar={setShowPinnedSidebar}
          searchModalOpen={searchModalOpen}
          onSearchModalOpenChange={setSearchModalOpen}
        />
      </div>
      {mixedSavedViewLabels && mixedSavedViewLabels.length > 0 ? (
        <div className="border-t border-border/70 border-r border-border px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">My views</p>
          <ul className="mt-2 space-y-1">
            {mixedSavedViewLabels.map((label, i) => (
              <li key={`${label}-${i}`} className="truncate text-[13px] text-foreground" title={label}>
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
