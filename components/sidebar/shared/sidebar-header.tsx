import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SidebarState } from "../use-sidebar"

interface SidebarHeaderProps {
  sidebarState: SidebarState
  getProjectName: (id: string | null) => string
}

export function SidebarCollapseButtons({ sidebarState: _sidebarState }: { sidebarState: SidebarState }) {
  return null
}

export function SidebarHeader({ sidebarState, getProjectName: _getProjectName }: SidebarHeaderProps) {
  const { collapsed, onSelectProject, onTabChange, setManuallyCollapsed } = sidebarState

  if (collapsed) {
    return (
      <div className="flex h-16 items-center justify-center px-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-0 bg-transparent p-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
              onClick={() => setManuallyCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <img
                src="/sidebar-icon.svg"
                alt=""
                className="pointer-events-none h-full w-full object-contain"
                draggable={false}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p>Expand sidebar</p>
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="px-4 pb-2 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left"
          onClick={() => {
            onSelectProject(null)
            onTabChange("tracker")
          }}
          aria-label="Go to Tracker"
        >
          <img
            src="/sidebar-logo.svg"
            alt=""
            className="pointer-events-none h-10 w-auto max-w-[min(100%,22rem)] object-left object-contain"
          />
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setManuallyCollapsed(true)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-[#333] transition-colors",
                "hover:bg-muted/50",
              )}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p>Collapse sidebar</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
