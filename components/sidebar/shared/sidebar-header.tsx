import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { InstrumentlLogoIcon } from "@/components/ui/instrumentl-logo-icon"
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
        <div className="sidebar-iris-stage relative flex h-8 w-8 items-center justify-center">
          <InstrumentlLogoIcon className="sidebar-iris-logo h-8 w-8 text-persimmon-400" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="sidebar-iris-expand absolute inset-0 flex items-center justify-center"
                onClick={() => setManuallyCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <ChevronRight
                  className="sidebar-iris-expand-icon h-4 w-4 text-[#333]"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>Expand sidebar</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-2 pt-4">
      <div className="flex items-center justify-between">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Instrumental%20logo-hqIjYK77hEnNjoiLqYurKw5fR8kyFW.svg"
          alt="Instrumentl"
          className="h-6 cursor-pointer"
          onClick={() => {
            onSelectProject(null)
            onTabChange("tracker")
          }}
        />
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
