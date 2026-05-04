"use client"

import { useState } from "react"
import { EllipsisVertical, Filter, Heart, Inbox, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { getProjectColorClassById } from "@/lib/project-utils"
import type { TabType } from "@/components/dashboard"

interface Project {
  id: string
  name: string
  grantOwner?: string
}

interface ProjectsDropdownProps {
  allProjects: Project[]
  trackingOnlyProjects?: Project[]
  onSelectProject: (id: string) => void
  onTabChange: (tab: TabType) => void
  isDebugMode: boolean
  handleNewProject?: () => void
}

const rowClass =
  "group/item relative flex h-8 w-full items-center border-none pl-2 pr-1 text-left font-sans text-[14px] font-light leading-[142%] text-[#333] transition-colors [font-feature-settings:'liga'_off,'clig'_off]"

export function ProjectsDropdown({
  allProjects,
  trackingOnlyProjects = [],
  onSelectProject,
  onTabChange,
  isDebugMode,
  handleNewProject,
}: ProjectsDropdownProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const handleProjectSelect = (projectId: string) => {
    if (isDebugMode) return
    onSelectProject(projectId)
    onTabChange("tracker" as TabType)
  }

  const filteredAllProjects = allProjects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredTrackingOnly = trackingOnlyProjects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div
      className="app-sidebar flex max-h-[420px] w-64 flex-col rounded-lg border border-silver-300 bg-background shadow-[0px_4px_16px_0px_rgba(0,0,0,0.1)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5 pb-1.5">
          <p className="flex-1 text-[14px] font-light leading-[142%] text-[#333] [font-feature-settings:'liga'_off,'clig'_off]">
            Projects
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (isDebugMode) return
                handleNewProject?.()
              }}
              disabled={isDebugMode}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[14px] font-light leading-[0] transition-colors",
                isDebugMode
                  ? "cursor-not-allowed border-smoke-200 bg-background text-smoke-200"
                  : "border-silver-300 bg-background text-[#333] hover:bg-muted/50",
              )}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              <span>New</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
              }}
              disabled={isDebugMode}
              className={cn(
                "flex h-[10px] w-[13px] items-center justify-center transition-colors",
                isDebugMode ? "cursor-not-allowed text-smoke-200" : "text-[#333] hover:opacity-80",
              )}
            >
              <Filter className="h-2.5 w-3" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search for ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full rounded-lg border border-silver-300 bg-background pl-2 pr-3 py-2 text-[14px] font-light leading-[0] text-[#333] transition-all placeholder:text-smoke-300 focus:border-[#66afe9] focus:shadow-[0px_0px_8px_0px_rgba(102,175,233,0.6)] focus:outline-none [font-feature-settings:'liga'_off,'clig'_off]"
        />
      </div>

      <div className="masked-overflow flex min-h-0 flex-1 flex-col overflow-x-visible overflow-y-auto px-3 pb-3">
        <div className="mb-3 space-y-0.5 border-b border-smoke-100 pb-2">
          <div
            onClick={(e) => {
              e.stopPropagation()
              handleProjectSelect("all")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleProjectSelect("all")
              }
            }}
            role="button"
            tabIndex={isDebugMode ? -1 : 0}
            aria-disabled={isDebugMode}
            className={cn(rowClass, isDebugMode ? "cursor-not-allowed text-smoke-200" : "cursor-pointer")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 right-0 rounded-md transition-colors",
                isDebugMode ? "bg-transparent" : "bg-transparent group-hover/item:bg-muted/50",
              )}
            />
            <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pr-3 pl-0">
              <Heart className="h-4 w-4 shrink-0 text-[#333]" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 flex-1 truncate">All Projects</span>
            </div>
          </div>

          <div
            onClick={(e) => {
              e.stopPropagation()
              handleProjectSelect("unassigned")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleProjectSelect("unassigned")
              }
            }}
            role="button"
            tabIndex={isDebugMode ? -1 : 0}
            aria-disabled={isDebugMode}
            className={cn(rowClass, isDebugMode ? "cursor-not-allowed text-smoke-200" : "cursor-pointer")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 right-0 rounded-md transition-colors",
                isDebugMode ? "bg-transparent" : "bg-transparent group-hover/item:bg-muted/50",
              )}
            />
            <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pr-3 pl-0">
              <Inbox className="h-4 w-4 shrink-0 text-[#333]" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 flex-1 truncate">No project</span>
            </div>
          </div>
        </div>

        {filteredAllProjects.length > 0 && (
          <div>
            <p className="px-2 pb-1 text-[11px] font-light uppercase tracking-wide text-smoke-300">
              MATCHES & TRACKING
            </p>
            <div className="space-y-0.5">
              {filteredAllProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleProjectSelect(project.id)
                  }}
                  role="button"
                  tabIndex={isDebugMode ? -1 : 0}
                  aria-disabled={isDebugMode}
                  className={cn(rowClass, isDebugMode ? "cursor-not-allowed text-smoke-200" : "cursor-pointer")}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-y-0 left-0 right-0 rounded-md transition-colors",
                      isDebugMode ? "bg-transparent" : "bg-transparent group-hover/item:bg-muted/50",
                    )}
                  />
                  <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pr-3 pl-0">
                    <span
                      className={cn("h-[10px] w-[10px] shrink-0 rounded-full", getProjectColorClassById(project.id))}
                    />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isDebugMode}
                    className={cn(
                      "relative z-10 flex h-[14px] w-[18px] shrink-0 items-center justify-center opacity-0 transition-opacity group-hover/item:opacity-100",
                      isDebugMode ? "cursor-not-allowed" : "text-[#333] hover:bg-muted/50 rounded",
                    )}
                  >
                    <EllipsisVertical className="h-3.5 w-[18px]" strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredTrackingOnly.length > 0 && (
          <div className="mt-3 border-t border-smoke-100 pt-2">
            <p className="px-2 pb-1 text-[11px] font-light uppercase tracking-wide text-smoke-300">Tracking only</p>
            <div className="space-y-0.5">
              {filteredTrackingOnly.map((project) => (
                <div
                  key={project.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleProjectSelect(project.id)
                  }}
                  role="button"
                  tabIndex={isDebugMode ? -1 : 0}
                  aria-disabled={isDebugMode}
                  className={cn(rowClass, isDebugMode ? "cursor-not-allowed text-smoke-200" : "cursor-pointer")}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-y-0 left-0 right-0 rounded-md transition-colors",
                      isDebugMode ? "bg-transparent" : "bg-transparent group-hover/item:bg-muted/50",
                    )}
                  />
                  <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pr-3 pl-0">
                    <span
                      className={cn("h-[10px] w-[10px] shrink-0 rounded-full", getProjectColorClassById(project.id))}
                    />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredAllProjects.length === 0 && filteredTrackingOnly.length === 0 && searchQuery ? (
          <div className="py-8 text-center text-[14px] font-light text-smoke-300">No projects found</div>
        ) : null}
      </div>
    </div>
  )
}
