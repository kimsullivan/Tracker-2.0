import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarState } from "./use-sidebar"
import { SidebarHeader, SidebarCollapseButtons } from "./shared/sidebar-header"
import { SidebarFooter } from "./shared/sidebar-footer"
import { PinnedSidebar } from "./shared/pinned-sidebar"
import { SidebarDialogs } from "./shared/sidebar-dialogs"
import { getProjectNameFromId } from "@/lib/project-utils"

interface SidebarShellProps {
  sidebarState: SidebarState
  children: React.ReactNode
}

export function SidebarShell({ sidebarState, children }: SidebarShellProps) {
  const {
    collapsed,
    handleMouseEnterPinnedSection,
    handleMouseLeavePinnedSection,
    isDebugMode,
  } = sidebarState

  // Helper function to get project name
  const getProjectName = (id: string | null) => {
    if (isDebugMode) return "No Project"
    if (!id || id === "all") return "All Projects"
    return getProjectNameFromId(id)
  }

  return (
    <TooltipProvider>
      <div className="group/sidebar relative flex-shrink-0">
        {/* Floating collapse buttons - positioned with fixed, outside main sidebar div */}
        <SidebarCollapseButtons sidebarState={sidebarState} />
        
        <div 
          className={cn(
            "app-sidebar border-r border-border bg-white flex flex-col h-full overflow-x-visible transition-all duration-300",
            collapsed ? "w-14" : "w-64"
          )}
          onMouseEnter={handleMouseEnterPinnedSection}
          onMouseLeave={handleMouseLeavePinnedSection}
        >
          {/* Header with logo and project selector */}
          <SidebarHeader sidebarState={sidebarState} getProjectName={getProjectName} />
          
          {/* Content area */}
          <div className={cn("pt-1.5 pb-4 flex-1 min-h-0 overflow-x-visible", collapsed ? "px-3" : "px-4")}>
            {children}
          </div>

          <SidebarFooter sidebarState={sidebarState} />
        </div>

        <PinnedSidebar sidebarState={sidebarState} />
      </div>
      
      <SidebarDialogs sidebarState={sidebarState} />
    </TooltipProvider>
  )
}
