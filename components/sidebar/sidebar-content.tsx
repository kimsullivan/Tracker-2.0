import { MoreHorizontal, Search } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SidebarState } from "./use-sidebar"
import { SearchInput } from "./shared/search-input"
import { SidebarSections } from "./sidebar-sections"
import { ProjectsDropdown } from "./projects-dropdown"
import type { TabType } from "@/components/dashboard"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

interface SidebarContentProps {
  sidebarState: SidebarState
}

function CollapsedNavIcon({
  icon: Icon,
  label,
  isActive,
  isDebugMode,
  onClick,
}: {
  icon: LucideIcon
  label: string
  isActive: boolean
  isDebugMode: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={isDebugMode}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            isDebugMode
              ? "cursor-not-allowed text-smoke-200"
              : isActive
                ? "bg-secondary text-secondary-foreground"
                : "text-[#333] hover:bg-muted/50",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function CollapsedSidebarContent({ sidebarState }: SidebarContentProps) {
  const {
    grantLifecycleItems,
    matchesSubItems,
    enterpriseToolsItems,
    managementToolsItems,
    isDebugMode,
    onTabChange,
    activeTab,
    setIsSearchModalOpen,
    allProjects,
    trackingOnlyProjects,
    onSelectProject,
    handleNewProject,
  } = sidebarState

  const projectDotColors = ["bg-emerald-400", "bg-rose-400", "bg-amber-400"]
  const [isProjectsDropdownVisible, setIsProjectsDropdownVisible] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [projectsDropdownPosition, setProjectsDropdownPosition] = useState({ top: 0, left: 0 })
  const projectsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const projectsCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearProjectsCloseTimeout = () => {
    if (projectsCloseTimeoutRef.current) {
      clearTimeout(projectsCloseTimeoutRef.current)
      projectsCloseTimeoutRef.current = null
    }
  }

  const updateProjectsDropdownPosition = () => {
    if (!projectsTriggerRef.current) return
    const rect = projectsTriggerRef.current.getBoundingClientRect()
    const menuWidth = 256
    const menuMaxHeight = 492
    const viewportPadding = 8
    const flyoutGap = 8
    const preferredLeft = rect.right + flyoutGap
    const flippedLeft = rect.left - menuWidth - flyoutGap
    let left = preferredLeft
    if (preferredLeft + menuWidth > window.innerWidth - viewportPadding) {
      left = flippedLeft
    }
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - menuWidth - viewportPadding))
    const maxTop = window.innerHeight - menuMaxHeight - viewportPadding
    const top = Math.max(viewportPadding, Math.min(rect.top, maxTop))

    setProjectsDropdownPosition({ top, left })
  }

  const openProjectsDropdown = () => {
    clearProjectsCloseTimeout()
    updateProjectsDropdownPosition()
    setIsProjectsDropdownVisible(true)
  }

  const scheduleProjectsDropdownClose = () => {
    clearProjectsCloseTimeout()
    projectsCloseTimeoutRef.current = setTimeout(() => {
      setIsProjectsDropdownVisible(false)
    }, 120)
  }

  useEffect(() => setIsClient(true), [])

  useEffect(() => {
    if (!isProjectsDropdownVisible) return
    updateProjectsDropdownPosition()
    const handlePositionUpdate = () => updateProjectsDropdownPosition()
    window.addEventListener("resize", handlePositionUpdate)
    window.addEventListener("scroll", handlePositionUpdate, true)
    return () => {
      window.removeEventListener("resize", handlePositionUpdate)
      window.removeEventListener("scroll", handlePositionUpdate, true)
    }
  }, [isProjectsDropdownVisible])

  useEffect(() => () => clearProjectsCloseTimeout(), [])

  return (
    <div className="flex flex-col items-center gap-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-silver-200 text-[#333] transition-colors hover:bg-muted/50"
          >
            <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>Quick find</p>
        </TooltipContent>
      </Tooltip>

      <div className="border-b border-smoke-100 pb-4 w-full">
        <div className="flex flex-col items-center gap-2">
          {grantLifecycleItems.map((item) => (
            <div key={item.id} className="flex flex-col items-center gap-2">
              <CollapsedNavIcon
                icon={item.icon}
                label={item.label}
                isActive={activeTab === item.id}
                isDebugMode={isDebugMode}
                onClick={() => !isDebugMode && onTabChange(item.id as TabType)}
              />
              {item.id === "matches" && matchesSubItems.map((sub) => (
                <CollapsedNavIcon
                  key={sub.id}
                  icon={sub.icon}
                  label={sub.label}
                  isActive={activeTab === sub.id}
                  isDebugMode={isDebugMode}
                  onClick={() => !isDebugMode && onTabChange(sub.id as TabType)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-smoke-100 pb-4 w-full">
        <div className="flex flex-col items-center gap-2">
          {enterpriseToolsItems.map((item) => (
            <CollapsedNavIcon
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeTab === item.id}
              isDebugMode={isDebugMode}
              onClick={() => !isDebugMode && onTabChange(item.id as TabType)}
            />
          ))}
        </div>
      </div>

      <div className="border-b border-smoke-100 pb-4 w-full">
        <div className="flex flex-col items-center gap-2">
          {managementToolsItems.map((item) => (
            <CollapsedNavIcon
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeTab === item.id}
              isDebugMode={isDebugMode}
              onClick={() => !isDebugMode && onTabChange(item.id as TabType)}
            />
          ))}
        </div>
      </div>

      <div className="w-full">
        <button
          type="button"
          ref={projectsTriggerRef}
          onMouseEnter={() => !isDebugMode && openProjectsDropdown()}
          onMouseLeave={() => !isDebugMode && scheduleProjectsDropdownClose()}
          onClick={() => !isDebugMode && onTabChange("projects" as TabType)}
          disabled={isDebugMode}
          className={cn(
            "project-dots-trigger group mx-auto flex h-auto w-8 flex-col items-center justify-center rounded-lg border py-2 transition-all",
            isDebugMode
              ? "cursor-not-allowed border-background text-smoke-200"
              : activeTab === "projects"
                ? "border-border bg-secondary"
                : "border-background hover:border-border hover:bg-muted/50",
          )}
        >
          <div className="project-dots-stack flex flex-col items-center">
            {projectDotColors.map((color, i) => (
              <span
                key={i}
                className={cn(
                  "project-dot relative h-2.5 w-2.5 rounded-full outline outline-2 outline-background transition-colors",
                  color,
                  "group-hover:outline-border/60",
                  activeTab === "projects" && "outline-border",
                )}
                style={{ zIndex: i + 1 }}
              />
            ))}
          </div>
          <MoreHorizontal className="mt-0.5 h-2 w-3 text-[#333]" strokeWidth={1.5} aria-hidden />
        </button>

        {isClient && isProjectsDropdownVisible && !isDebugMode &&
          createPortal(
            <div
              className="fixed z-[120]"
              style={{ top: projectsDropdownPosition.top, left: projectsDropdownPosition.left }}
              onMouseEnter={openProjectsDropdown}
              onMouseLeave={scheduleProjectsDropdownClose}
            >
              <ProjectsDropdown
                allProjects={allProjects}
                trackingOnlyProjects={trackingOnlyProjects}
                onSelectProject={onSelectProject}
                onTabChange={onTabChange}
                isDebugMode={isDebugMode}
                handleNewProject={handleNewProject}
              />
            </div>,
            document.body
          )}
      </div>
    </div>
  )
}

export function SidebarContent({ sidebarState }: SidebarContentProps) {
  const { collapsed, searchQuery, setSearchQuery, setIsSearchModalOpen } = sidebarState

  if (collapsed) {
    return (
      <div className="sidebar-scrollbar h-full overflow-y-auto overflow-x-visible masked-overflow">
        <CollapsedSidebarContent sidebarState={sidebarState} />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <div className="pb-2">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClick={() => setIsSearchModalOpen(true)}
            placeholder="Quick find"
            size="sm"
          />
        </div>
        <SidebarSections {...sidebarState} sections="lifecycle" />
      </div>

      <div className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-visible masked-overflow">
        <SidebarSections {...sidebarState} sections="tools-and-projects" />
      </div>
    </div>
  )
}
