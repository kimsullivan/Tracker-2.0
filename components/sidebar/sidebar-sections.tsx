import { cn } from "@/lib/utils"
import { getProjectColorClassById } from "@/lib/project-utils"
import { ChevronRight, Filter, Heart, LayoutList, Plus } from "lucide-react"
import { SidebarState } from "./use-sidebar"
import type { TabType } from "@/components/dashboard"
import { useState } from "react"

const rowButtonBaseClass =
  "group relative flex items-center w-full h-8 rounded-md pl-2 text-[14px] border-none transition-colors text-left font-sans not-italic font-light leading-[142%] text-[#333] [font-feature-settings:'liga'_off,'clig'_off]"
const activeRowClass = "text-secondary-foreground"
const inactiveRowClass = "text-[#333]"
const disabledRowClass = "text-smoke-200 cursor-not-allowed"
const projectItemBaseClass =
  "group relative flex items-center w-full h-8 rounded-md pl-2 text-[14px] border-none transition-colors text-left font-sans font-light leading-[142%] text-[#333] [font-feature-settings:'liga'_off,'clig'_off]"

/** Match `GrainTab` in `grain-bar.tsx`: active `bg-secondary`, hover `hover:bg-muted/50`. */
function navRowSurface(isDebugMode: boolean, active: boolean) {
  if (isDebugMode) return ""
  return active ? "bg-secondary text-secondary-foreground" : "hover:bg-muted/50"
}

type SidebarSectionGroup = "all" | "lifecycle" | "tools-and-projects"

interface SidebarSectionsProps extends SidebarState {
  sections?: SidebarSectionGroup
}

export function SidebarSections(props: SidebarSectionsProps) {
  const {
    grantLifecycleItems,
    matchesSubItems,
    enterpriseToolsItems,
    managementToolsItems,
    isDebugMode,
    onTabChange,
    activeTab,
    onSelectProject,
    selectedProject,
    plusOneOpacity,
    plusOneValue,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isMatchesExpanded,
    setIsMatchesExpanded,
    allProjects,
    trackingOnlyProjects,
    handleNewProject,
    sections = "all",
  } = props

  const [isProjectsHovered, setIsProjectsHovered] = useState(false)
  const [isMatchesHovered, setIsMatchesHovered] = useState(false)
  const renderLifecycle = sections === "all" || sections === "lifecycle"
  const renderToolsAndProjects = sections === "all" || sections === "tools-and-projects"
  const projectSelectionTargetTab: TabType =
    activeTab === "matches" || activeTab === "calendar" || activeTab === "reports"
      ? activeTab
      : "tracker"

  return (
    <div>
      {renderLifecycle && <div className="border-b border-smoke-100 pb-2 mb-4">
        <div className="flex flex-col gap-2">
          {grantLifecycleItems.map((item) => (
            <div key={item.id}>
              <button
                data-tracker-button={item.id === "tracker" ? "true" : undefined}
                data-tour={item.dataTour}
                onClick={() => {
                  if (isDebugMode) return
                  if (item.id === "matches") {
                    onTabChange("matches")
                    setIsMatchesExpanded(!isMatchesExpanded)
                    return
                  }
                  onTabChange(item.id as TabType)
                }}
                disabled={isDebugMode}
                onMouseEnter={item.id === "matches" ? () => setIsMatchesHovered(true) : undefined}
                onMouseLeave={item.id === "matches" ? () => setIsMatchesHovered(false) : undefined}
                className={cn(
                  rowButtonBaseClass,
                  isDebugMode
                    ? disabledRowClass
                    : activeTab === item.id
                      ? activeRowClass
                      : inactiveRowClass,
                  navRowSurface(isDebugMode, activeTab === item.id),
                )}
              >
                <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
                  {(() => {
                    const Glyph = item.id === "matches" && isMatchesHovered ? ChevronRight : item.icon
                    return (
                      <Glyph
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors text-[#333]",
                          item.id === "matches" && isMatchesHovered && isMatchesExpanded && "rotate-90",
                          isDebugMode && "text-smoke-200",
                        )}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    )
                  })()}
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <div className="relative z-10 ml-auto">
                    {item.id === "matches" && item.hasNew && !isDebugMode ? (
                      <span className="inline-flex h-5 items-center justify-center rounded-full border border-silver-150 bg-background px-2 text-[12px] font-light leading-none text-[#333] [font-feature-settings:'liga'_off,'clig'_off]">
                        {item.count} New
                      </span>
                    ) : (
                      <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-silver-150 px-1.5 py-0.5 text-sm font-light text-smoke-300 opacity-0">
                        {item.count}
                      </span>
                    )}

                    {item.id === "tracker" && plusOneOpacity > 0 && !isDebugMode && (
                      <span
                        className="ml-1 text-sm font-medium text-persimmon-700 transition-all duration-500 ease-out"
                        style={{
                          opacity: plusOneOpacity,
                          transform: `translateX(${-10 + (10 * plusOneOpacity)}px)`
                        }}
                      >
                        +{plusOneValue}
                      </span>
                    )}

                    {item.id === "tracker" && item.showNotification && !isDebugMode && (
                      <span className="absolute -top-1 -right-3 flex h-2 w-2 animate-pulse">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                      </span>
                    )}
                  </div>
                )}
              </button>

              {item.id === "matches" && isMatchesExpanded && (
                <div className="relative mt-1">
                  <div className="absolute left-[8px] top-0 bottom-0 w-px bg-smoke-100 -translate-x-1/2" />
                  <div className="flex flex-col gap-1">
                    {matchesSubItems.map((sub) => {
                      const SubIcon = sub.icon
                      return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          if (isDebugMode) return
                          onTabChange(sub.id as TabType)
                        }}
                        disabled={isDebugMode}
                        className={cn(
                          rowButtonBaseClass,
                          isDebugMode
                            ? disabledRowClass
                            : activeTab === sub.id
                              ? activeRowClass
                              : inactiveRowClass,
                          navRowSurface(isDebugMode, activeTab === sub.id),
                        )}
                      >
                        <div className="relative z-10 ml-[22px] flex min-w-0 flex-1 items-center gap-1.5">
                          <SubIcon
                            className={cn("h-4 w-4 shrink-0 text-[#333]", isDebugMode && "text-smoke-200")}
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          <span>{sub.label}</span>
                        </div>
                      </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>}

      {renderToolsAndProjects && <>
      <div className="border-b border-smoke-100 pb-2 mb-4">
        <div className="flex flex-col gap-2">
          {enterpriseToolsItems.map((item) => {
            const ItemIcon = item.icon
            return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (isDebugMode) return
                  onTabChange(item.id as TabType)
                }}
                disabled={isDebugMode}
                className={cn(
                  rowButtonBaseClass,
                  isDebugMode
                    ? disabledRowClass
                    : activeTab === item.id
                      ? activeRowClass
                      : inactiveRowClass,
                  navRowSurface(isDebugMode, activeTab === item.id),
                )}
              >
                <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
                  <ItemIcon
                    className={cn("h-4 w-4 shrink-0 text-[#333]", isDebugMode && "text-smoke-200")}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                </div>
              </button>
            </div>
            )
          })}
        </div>
      </div>

      <div className="border-b border-smoke-100 pb-2 mb-4">
        <div className="flex flex-col gap-2">
          {managementToolsItems.map((item) => {
            const ItemIcon = item.icon
            return (
            <button
              key={item.id}
              onClick={() => {
                if (isDebugMode) return
                onTabChange(item.id as TabType)
              }}
              disabled={isDebugMode}
              className={cn(
                rowButtonBaseClass,
                isDebugMode
                  ? disabledRowClass
                  : activeTab === item.id
                    ? activeRowClass
                    : inactiveRowClass,
                navRowSurface(isDebugMode, activeTab === item.id),
              )}
            >
              <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
                <ItemIcon
                  className={cn("h-4 w-4 shrink-0 text-[#333]", isDebugMode && "text-smoke-200")}
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span>{item.label}</span>
              </div>
            </button>
            )
          })}
        </div>
      </div>

      <div>
        <div
          onMouseEnter={() => setIsProjectsHovered(true)}
          onMouseLeave={() => setIsProjectsHovered(false)}
          className={cn(
            rowButtonBaseClass,
            isDebugMode
              ? disabledRowClass
              : activeTab === "projects"
                ? activeRowClass
                : inactiveRowClass,
            !isDebugMode &&
              (activeTab === "projects" ? "bg-secondary text-secondary-foreground" : "hover:bg-muted/50"),
          )}
        >
          <button
            onClick={() => {
              if (isDebugMode) return
              setIsProjectsExpanded(!isProjectsExpanded)
            }}
            disabled={isDebugMode}
            className="relative z-10 flex h-full min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            {(() => {
              const ProjectsGlyph = isProjectsHovered ? ChevronRight : LayoutList
              return (
                <ProjectsGlyph
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#333] transition-all",
                    isProjectsHovered && isProjectsExpanded && "rotate-90",
                    isDebugMode && "text-smoke-200",
                  )}
                  strokeWidth={1.5}
                  aria-hidden
                />
              )
            })()}
            <span>Projects</span>
          </button>
          <div className="relative z-10 ml-auto flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isDebugMode) return
                handleNewProject()
              }}
              disabled={isDebugMode}
              className={cn(
                "flex shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs font-light transition-colors",
                isDebugMode
                  ? "cursor-not-allowed border-smoke-200 bg-background text-smoke-200"
                  : "border-silver-300 bg-background text-[#333] hover:bg-muted/50",
              )}
            >
              <Plus className="h-2.5 w-2.5" strokeWidth={1.5} aria-hidden />
              <span>New</span>
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              disabled={isDebugMode}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
                isDebugMode ? "cursor-not-allowed text-smoke-200" : "text-[#333] hover:bg-muted/50 rounded",
              )}
            >
              <Filter className="h-2.5 w-2.5" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </div>

        {isProjectsExpanded && !isDebugMode && (
          <div className="mt-2 relative">
            <div className="mb-2">
              <input
                type="text"
                placeholder="Search for ..."
                className="w-full h-8 pl-2 pr-3 text-[14px] rounded-lg border border-silver-200 bg-background placeholder:text-smoke-300 focus:outline-none focus:border-[#66afe9] focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)] transition-colors [font-feature-settings:'liga'_off,'clig'_off]"
              />
            </div>

            <div className="space-y-0.5 pb-2 mb-3 border-b border-smoke-100">
              <button
                onClick={() => {
                  onSelectProject("all")
                  onTabChange(projectSelectionTargetTab)
                }}
                className={cn(projectItemBaseClass, navRowSurface(false, selectedProject === "all"))}
              >
                <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pr-3 pl-0">
                  <Heart className="h-4 w-4 shrink-0 text-[#333]" strokeWidth={1.5} aria-hidden />
                  <span className="truncate">All Projects</span>
                </div>
              </button>
            </div>

            {allProjects.length > 0 && (
              <div>
                <p className="pl-2 pr-3 pb-1 text-[11px] font-light uppercase tracking-wide text-smoke-300">
                  MATCHES & TRACKING
                </p>
                <div className="space-y-0.5 pb-2 mb-3 border-b border-smoke-100">
                  {allProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        onSelectProject(project.id)
                        onTabChange(projectSelectionTargetTab)
                      }}
                      className={cn(
                        projectItemBaseClass,
                        "text-[#333]",
                        navRowSurface(false, selectedProject === project.id),
                      )}
                    >
                      <div className="relative z-10 flex items-center gap-2 flex-1 min-w-0 pr-3 pl-0">
                        <span
                          className={cn("w-2.5 h-2.5 rounded-full shrink-0", getProjectColorClassById(project.id))}
                        />
                        <span className="truncate">{project.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {trackingOnlyProjects.length > 0 && (
              <div className="mt-3">
                <p className="pl-2 pr-3 pb-1 text-[11px] font-light uppercase tracking-wide text-smoke-300">
                  Tracking only
                </p>
                <div className="space-y-0.5">
                  {trackingOnlyProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        onSelectProject(project.id)
                        onTabChange(projectSelectionTargetTab)
                      }}
                      className={cn(projectItemBaseClass, "text-[#333]", navRowSurface(false, selectedProject === project.id))}
                    >
                      <div className="relative z-10 flex items-center gap-2 flex-1 min-w-0 pr-3 pl-0">
                        <span
                          className={cn("w-2.5 h-2.5 rounded-full shrink-0", getProjectColorClassById(project.id))}
                        />
                        <span className="truncate">{project.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </>}
    </div>
  )
}
