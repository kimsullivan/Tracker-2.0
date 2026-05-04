import { Pin } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProjectIcon } from "./project-icon"
import { SidebarState } from "../use-sidebar"

interface PinnedSidebarProps {
  sidebarState: SidebarState
}

export function PinnedSidebar({ sidebarState }: PinnedSidebarProps) {
  const {
    collapsed,
    pinnedProjects,
    getPinnedProjectDetails,
    togglePinProject,
    showPinnedSidebar,
    setShowPinnedSidebar,
    handleMouseEnterPinnedSection,
    handleMouseLeavePinnedSection,
    onSelectProject,
    selectedProject,
  } = sidebarState

  if (pinnedProjects.length === 0) {
    return null
  }

  return (
    <div 
      className={cn(
        "app-sidebar absolute top-0 z-20 h-full w-64 border-r-2 border-border bg-background",
        "transition-all duration-300 ease-out",
        collapsed ? "left-20" : "left-64",
        showPinnedSidebar ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onMouseEnter={handleMouseEnterPinnedSection}
      onMouseLeave={handleMouseLeavePinnedSection}
    >
      <div className="flex items-center px-4 pt-4">
        <h3 className="text-[14px] font-light text-[#333]">Pinned Projects</h3>
      </div>
      <div className="space-y-2 px-4 pb-4 pt-0">
        {getPinnedProjectDetails.map((project: any) => (
          <button
            key={project.id}
            onClick={() => {
              onSelectProject(project.id)
              setShowPinnedSidebar(false)
            }}
            className={cn(
              "group flex w-full items-center gap-2 rounded-md py-2 pl-2 pr-3 text-left text-[14px] font-light text-[#333] transition-colors",
              selectedProject === project.id ? "bg-secondary text-secondary-foreground" : "hover:bg-muted/50",
            )}
          >
            <ProjectIcon projectId={project.id} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="truncate text-[14px] font-light">{project.name}</span>
              <span className="truncate text-xs font-light text-smoke-300">
                {project.organization || project.owner}
              </span>
            </div>
            <button
              onClick={(e) => togglePinProject(project.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted/50 transition-opacity"
            >
              <Pin className="h-3 w-3 text-[#333] transition-colors hover:opacity-70" strokeWidth={1.5} />
            </button>
          </button>
        ))}
        {pinnedProjects.length === 0 && (
          <div className="text-sm text-smoke-300 text-center py-8">
            <Pin className="h-8 w-8 mx-auto mb-3 text-smoke-200" />
            <p>No pinned projects yet</p>
            <p className="text-xs mt-1">Pin projects from the dropdown above</p>
          </div>
        )}
      </div>
    </div>
  )
}
