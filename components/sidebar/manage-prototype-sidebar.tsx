"use client"

import { useCallback, useEffect, useState } from "react"
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

/**
 * Lookback `Sidebar` with local prototype state, wired loosely to Traver grain navigation.
 */
export function ManagePrototypeSidebar({
  grain,
  onRequestGrain,
  onClearGrant,
}: {
  grain: Grain
  onRequestGrain: (g: Grain) => void
  onClearGrant: () => void
}) {
  const [activeTab, setActiveTab] = useState<TabType>("tracker")
  const [selectedProject, setSelectedProject] = useState<string | null>("all")
  const [showPinnedSidebar, setShowPinnedSidebar] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  useEffect(() => {
    if (grain === "command") {
      setActiveTab("hq-dashboard")
    } else if (grain === "all-grants") {
      setActiveTab("tracker")
    }
  }, [grain])

  const onTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab)
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
    <Sidebar
      activeTab={activeTab}
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
  )
}
