"use client"

import { SidebarProps } from "./types"
import { useSidebar } from "./use-sidebar"
import { SidebarShell } from "./sidebar-shell"
import { SidebarContent } from "./sidebar-content"

export function Sidebar(props: SidebarProps) {
  const sidebarState = useSidebar(props)

  return (
    <SidebarShell sidebarState={sidebarState}>
      <SidebarContent sidebarState={sidebarState} />
    </SidebarShell>
  )
}

